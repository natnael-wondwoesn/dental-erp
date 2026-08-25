"""Native host workflow joining protected identity, request export, and license import."""

from __future__ import annotations

import json
import os
import tempfile
from collections.abc import Mapping
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from app.licensing.decision import LicenseDecision, LicenseEvidence, evaluate_license
from app.licensing.identity_store import InstallationIdentityStore
from app.licensing.material_store import MAX_LICENSE_BYTES, FileLicenseMaterialStore


@dataclass(frozen=True, slots=True)
class ActivationExport:
    installation_id: str
    output_path: Path
    delivery: Literal["online", "offline"]


class HostLicenseAgent:
    def __init__(
        self,
        identity_store: InstallationIdentityStore,
        public_keys: Mapping[str, str],
    ):
        self.identity_store = identity_store
        self.public_keys = public_keys
        self.material_store = FileLicenseMaterialStore(identity_store.state_dir)

    @staticmethod
    def _atomic_write(path: Path, value: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
        try:
            if hasattr(os, "fchmod"):
                os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as temporary:
                temporary.write(value)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_name, path)
        except BaseException:
            with suppress(FileNotFoundError):
                os.unlink(temporary_name)
            raise

    def export_activation_request(
        self,
        output_path: Path,
        *,
        app_version: str,
        delivery: Literal["online", "offline"],
        now: datetime | None = None,
    ) -> ActivationExport:
        identity = self.identity_store.load_or_create(now=now)
        request = self.identity_store.create_activation_request(
            app_version=app_version,
            delivery=delivery,
            now=now,
        )
        self._atomic_write(output_path, request.encode("utf-8"))
        return ActivationExport(identity.installation_id, output_path, delivery)

    def import_license_document(
        self,
        raw_license: str,
        *,
        now: datetime | None = None,
    ) -> LicenseDecision:
        if len(raw_license.encode("utf-8")) > MAX_LICENSE_BYTES:
            raise ValueError("License file is too large")
        now = now or datetime.now(UTC)
        if now.tzinfo is None:
            raise ValueError("License import time must be timezone-aware")
        now = now.astimezone(UTC)
        identity = self.identity_store.load_or_create(now=now)
        try:
            evidence = self.material_store.read_evidence()
        except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
            evidence = LicenseEvidence(max_observed_at="corrupt")
        decision = evaluate_license(
            license=raw_license,
            product_id=self.identity_store.product_id,
            installation_id=identity.installation_id,
            public_keys=self.public_keys,
            now=now,
            evidence=evidence,
        )
        if not decision.allows_write:
            raise ValueError(f"License cannot be installed: {decision.reason}")
        self.material_store.write_license(raw_license)
        self.material_store.write_evidence(decision.next_evidence)
        return decision
