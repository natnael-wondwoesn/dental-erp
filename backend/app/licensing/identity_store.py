"""Machine-protected installation identity storage for the Windows host agent."""

from __future__ import annotations

import ctypes
import json
import os
import tempfile
import threading
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from ctypes import wintypes
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Protocol

from app.licensing.activation import (
    InstallationIdentity,
    create_activation_request,
    generate_installation_identity,
)


class SecretProtector(Protocol):
    def protect(self, plaintext: bytes) -> bytes: ...

    def unprotect(self, ciphertext: bytes) -> bytes: ...


class InstallationIdentityError(RuntimeError):
    pass


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


class WindowsDpapiMachineProtector:
    """DPAPI LocalMachine adapter; directory ACLs remain mandatory."""

    _UI_FORBIDDEN = 0x1
    _LOCAL_MACHINE = 0x4

    def __init__(self, product_id: str):
        if os.name != "nt":
            raise OSError("Windows DPAPI is available only on Windows")
        self._entropy = f"sunny-smile:{product_id}:installation-identity:v1".encode()
        self._crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
        self._kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        transform_arguments = [
            ctypes.POINTER(_DataBlob),
            wintypes.LPCWSTR,
            ctypes.POINTER(_DataBlob),
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(_DataBlob),
        ]
        self._crypt32.CryptProtectData.argtypes = transform_arguments
        self._crypt32.CryptProtectData.restype = wintypes.BOOL
        self._crypt32.CryptUnprotectData.argtypes = transform_arguments
        self._crypt32.CryptUnprotectData.restype = wintypes.BOOL
        self._kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        self._kernel32.LocalFree.restype = ctypes.c_void_p

    @staticmethod
    def _input_blob(value: bytes) -> tuple[_DataBlob, ctypes.Array]:
        buffer = ctypes.create_string_buffer(value)
        blob = _DataBlob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
        return blob, buffer

    def _transform(self, value: bytes, *, protect: bool) -> bytes:
        input_blob, input_buffer = self._input_blob(value)
        entropy_blob, entropy_buffer = self._input_blob(self._entropy)
        output_blob = _DataBlob()
        function = self._crypt32.CryptProtectData if protect else self._crypt32.CryptUnprotectData
        if protect:
            success = function(
                ctypes.byref(input_blob),
                None,
                ctypes.byref(entropy_blob),
                None,
                None,
                self._UI_FORBIDDEN | self._LOCAL_MACHINE,
                ctypes.byref(output_blob),
            )
        else:
            success = function(
                ctypes.byref(input_blob),
                None,
                ctypes.byref(entropy_blob),
                None,
                None,
                self._UI_FORBIDDEN,
                ctypes.byref(output_blob),
            )
        _ = input_buffer, entropy_buffer
        if not success:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            return ctypes.string_at(output_blob.pbData, output_blob.cbData)
        finally:
            self._kernel32.LocalFree(output_blob.pbData)

    def protect(self, plaintext: bytes) -> bytes:
        return self._transform(plaintext, protect=True)

    def unprotect(self, ciphertext: bytes) -> bytes:
        return self._transform(ciphertext, protect=False)


@dataclass(frozen=True, slots=True)
class InstallationMetadata:
    schema_version: Literal[1]
    product_id: str
    installation_id: str
    installation_public_key: dict[str, str]
    created_at: str


class InstallationIdentityStore:
    def __init__(self, state_dir: Path, product_id: str, protector: SecretProtector):
        self.state_dir = state_dir
        self.product_id = product_id
        self.protector = protector
        self._thread_lock = threading.Lock()

    @property
    def _private_path(self) -> Path:
        return self.state_dir / "identity.key.dpapi"

    @property
    def _public_path(self) -> Path:
        return self.state_dir / "installation.json"

    @contextmanager
    def _file_lock(self) -> Iterator[None]:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        lock_path = self.state_dir / ".identity.lock"
        with lock_path.open("a+b") as handle:
            if handle.tell() == 0:
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                try:
                    yield
                finally:
                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def _atomic_write(self, path: Path, value: bytes) -> None:
        descriptor, temporary_name = tempfile.mkstemp(dir=self.state_dir, prefix=f".{path.name}.")
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

    def _load(self) -> InstallationIdentity:
        try:
            metadata_value = json.loads(self._public_path.read_text(encoding="utf-8"))
            metadata = InstallationMetadata(**metadata_value)
            seed = self.protector.unprotect(self._private_path.read_bytes())
            identity = generate_installation_identity(seed)
        except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
            raise InstallationIdentityError("Installation identity is damaged") from exc
        if metadata.schema_version != 1 or metadata.product_id != self.product_id:
            raise InstallationIdentityError("Installation identity belongs to another product")
        if (
            metadata.installation_id != identity.installation_id
            or metadata.installation_public_key != identity.public_jwk
        ):
            raise InstallationIdentityError("Installation identity metadata was changed")
        return identity

    def load_or_create(self, *, now: datetime | None = None) -> InstallationIdentity:
        with self._thread_lock, self._file_lock():
            private_exists = self._private_path.exists()
            public_exists = self._public_path.exists()
            if private_exists != public_exists:
                raise InstallationIdentityError("Installation identity is incomplete")
            if private_exists:
                return self._load()
            now = now or datetime.now(UTC)
            if now.tzinfo is None:
                raise ValueError("Identity creation time must be timezone-aware")
            identity = generate_installation_identity()
            metadata = InstallationMetadata(
                schema_version=1,
                product_id=self.product_id,
                installation_id=identity.installation_id,
                installation_public_key=identity.public_jwk,
                created_at=now.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            )
            self._atomic_write(self._private_path, self.protector.protect(identity.private_seed))
            try:
                self._atomic_write(
                    self._public_path,
                    json.dumps(
                        {
                            "schema_version": metadata.schema_version,
                            "product_id": metadata.product_id,
                            "installation_id": metadata.installation_id,
                            "installation_public_key": metadata.installation_public_key,
                            "created_at": metadata.created_at,
                        },
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode(),
                )
            except BaseException:
                self._private_path.unlink(missing_ok=True)
                raise
            return identity

    def create_activation_request(
        self,
        *,
        app_version: str,
        delivery: Literal["online", "offline"],
        now: datetime | None = None,
    ) -> str:
        identity = self.load_or_create(now=now)
        return create_activation_request(
            identity,
            product_id=self.product_id,
            app_version=app_version,
            delivery=delivery,
            now=now,
        )
