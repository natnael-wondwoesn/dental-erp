"""Portable file storage for public installation state and signed licenses."""

import json
import os
import tempfile
from contextlib import suppress
from dataclasses import asdict
from pathlib import Path
from typing import Protocol

from app.licensing.decision import LicenseEvidence

MAX_LICENSE_BYTES = 64 * 1024
MAX_STATE_BYTES = 256 * 1024


class LicenseMaterialStore(Protocol):
    def read_license(self) -> str: ...

    def read_installation_id(self) -> str: ...

    def read_evidence(self) -> LicenseEvidence: ...

    def write_license(self, raw_license: str) -> None: ...

    def write_evidence(self, evidence: LicenseEvidence) -> None: ...


class FileLicenseMaterialStore:
    def __init__(self, state_dir: Path):
        self.state_dir = state_dir

    def _read(self, name: str, maximum: int = MAX_STATE_BYTES) -> str:
        path = self.state_dir / name
        if path.is_symlink():
            raise ValueError(f"Refusing symbolic link: {name}")
        data = path.read_bytes()
        if len(data) > maximum:
            raise ValueError(f"License state file is too large: {name}")
        return data.decode("utf-8")

    def _write(self, name: str, value: str) -> None:
        self.state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            dir=self.state_dir, prefix=f".{name}.", text=True
        )
        try:
            if hasattr(os, "fchmod"):
                os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as temporary:
                temporary.write(value)
                temporary.flush()
                os.fsync(temporary.fileno())
            os.replace(temporary_name, self.state_dir / name)
        except BaseException:
            with suppress(FileNotFoundError):
                os.unlink(temporary_name)
            raise

    def read_license(self) -> str:
        return self._read("current.lic", MAX_LICENSE_BYTES)

    def read_installation_id(self) -> str:
        value = json.loads(self._read("installation.json"))
        if not isinstance(value, dict) or not isinstance(value.get("installation_id"), str):
            raise ValueError("Invalid installation identity")
        return value["installation_id"]

    def read_evidence(self) -> LicenseEvidence:
        try:
            value = json.loads(self._read("evidence.json"))
        except FileNotFoundError:
            return LicenseEvidence()
        if not isinstance(value, dict):
            raise ValueError("Invalid license evidence")
        return LicenseEvidence(
            max_observed_at=value.get("max_observed_at"),
            highest_sequence=value.get("highest_sequence"),
            highest_sequence_license_id=value.get("highest_sequence_license_id"),
        )

    def write_license(self, raw_license: str) -> None:
        if len(raw_license.encode("utf-8")) > MAX_LICENSE_BYTES:
            raise ValueError("License file is too large")
        self._write("current.lic", raw_license)

    def write_evidence(self, evidence: LicenseEvidence) -> None:
        self._write("evidence.json", json.dumps(asdict(evidence), separators=(",", ":")))
