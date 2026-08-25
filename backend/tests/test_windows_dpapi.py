import os
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.licensing.identity_store import (
    InstallationIdentityStore,
    WindowsDpapiMachineProtector,
)

pytestmark = pytest.mark.skipif(os.name != "nt", reason="Windows DPAPI test")


def test_machine_scope_dpapi_round_trip_and_product_entropy() -> None:
    protector = WindowsDpapiMachineProtector("dental-erp")
    ciphertext = protector.protect(b"installation-private-seed")
    assert ciphertext != b"installation-private-seed"
    assert protector.unprotect(ciphertext) == b"installation-private-seed"

    other_product = WindowsDpapiMachineProtector("clinic-cms")
    with pytest.raises(OSError):
        other_product.unprotect(ciphertext)


def test_real_dpapi_identity_survives_reload(tmp_path: Path) -> None:
    first_store = InstallationIdentityStore(
        tmp_path,
        "dental-erp",
        WindowsDpapiMachineProtector("dental-erp"),
    )
    first = first_store.load_or_create(now=datetime(2026, 8, 24, tzinfo=UTC))
    second = InstallationIdentityStore(
        tmp_path,
        "dental-erp",
        WindowsDpapiMachineProtector("dental-erp"),
    ).load_or_create()
    assert second.installation_id == first.installation_id
    assert second.private_seed == first.private_seed
