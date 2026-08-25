"""Runtime adapter joining signed decisions to installation-owned files."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.config import Settings, get_settings
from app.licensing.decision import LicenseDecision, evaluate_license
from app.licensing.material_store import (
    MAX_LICENSE_BYTES,
    FileLicenseMaterialStore,
    LicenseMaterialStore,
)
from app.licensing.trust_anchors import ISSUER_PUBLIC_KEYS


@dataclass(frozen=True, slots=True)
class RuntimeLicenseDecision:
    enforcement: Literal["disabled", "audit", "required"]
    state: str
    reason: str
    allows_read: bool
    allows_write: bool
    allows_recovery: bool
    product_id: str
    installation_id: str | None
    expires_at: str | None
    entitlements: tuple[str, ...]


class LicenseRuntime:
    def __init__(
        self,
        settings: Settings,
        store: LicenseMaterialStore,
        public_keys: Mapping[str, str],
    ):
        self.settings = settings
        self.store = store
        self.public_keys = public_keys
        self._lock = asyncio.Lock()

    def _disabled(self) -> RuntimeLicenseDecision:
        return RuntimeLicenseDecision(
            enforcement="disabled",
            state="active",
            reason="enforcement_disabled",
            allows_read=True,
            allows_write=True,
            allows_recovery=True,
            product_id=self.settings.license_product_id,
            installation_id=None,
            expires_at=None,
            entitlements=(),
        )

    @staticmethod
    def _runtime_decision(
        core: LicenseDecision,
        *,
        enforcement: Literal["disabled", "audit", "required"],
        product_id: str,
        installation_id: str | None,
    ) -> RuntimeLicenseDecision:
        return RuntimeLicenseDecision(
            enforcement=enforcement,
            state=core.state,
            reason=core.reason,
            allows_read=core.allows_read,
            allows_write=core.allows_write,
            allows_recovery=core.allows_recovery,
            product_id=product_id,
            installation_id=installation_id,
            expires_at=core.payload.expires_at if core.payload else None,
            entitlements=core.payload.entitlements if core.payload else (),
        )

    async def decide(self, *, now: datetime | None = None) -> RuntimeLicenseDecision:
        if self.settings.license_enforcement == "disabled":
            return self._disabled()
        now = (now or datetime.now(UTC)).astimezone(UTC)
        async with self._lock:
            installation_id: str | None = None
            try:
                installation_id = self.store.read_installation_id()
                raw_license = self.store.read_license()
                evidence = self.store.read_evidence()
                core = evaluate_license(
                    license=raw_license,
                    product_id=self.settings.license_product_id,
                    installation_id=installation_id,
                    public_keys=self.public_keys,
                    now=now,
                    evidence=evidence,
                )
                self.store.write_evidence(core.next_evidence)
            except (OSError, ValueError, TypeError, json.JSONDecodeError):
                core = evaluate_license(
                    license={},
                    product_id=self.settings.license_product_id,
                    installation_id=installation_id or "missing-installation",
                    public_keys={},
                    now=now,
                )
            return self._runtime_decision(
                core,
                enforcement=self.settings.license_enforcement,
                product_id=self.settings.license_product_id,
                installation_id=installation_id,
            )

    async def import_license(
        self, raw_license: str, *, now: datetime | None = None
    ) -> RuntimeLicenseDecision:
        if len(raw_license.encode("utf-8")) > MAX_LICENSE_BYTES:
            raise ValueError("License file is too large")
        now = (now or datetime.now(UTC)).astimezone(UTC)
        async with self._lock:
            installation_id = self.store.read_installation_id()
            evidence = self.store.read_evidence()
            core = evaluate_license(
                license=raw_license,
                product_id=self.settings.license_product_id,
                installation_id=installation_id,
                public_keys=self.public_keys,
                now=now,
                evidence=evidence,
            )
            if not core.allows_write:
                raise ValueError(f"License cannot be activated: {core.reason}")
            self.store.write_license(raw_license)
            self.store.write_evidence(core.next_evidence)
            return self._runtime_decision(
                core,
                enforcement=self.settings.license_enforcement,
                product_id=self.settings.license_product_id,
                installation_id=installation_id,
            )


def create_license_runtime(settings: Settings | None = None) -> LicenseRuntime:
    settings = settings or get_settings()
    return LicenseRuntime(
        settings,
        FileLicenseMaterialStore(settings.license_state_dir),
        ISSUER_PUBLIC_KEYS,
    )


_runtime: LicenseRuntime | None = None


def get_license_runtime() -> LicenseRuntime:
    global _runtime
    if _runtime is None:
        _runtime = create_license_runtime()
    return _runtime
