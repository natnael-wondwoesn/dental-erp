import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.config import Settings
from app.licensing.material_store import FileLicenseMaterialStore
from app.licensing.runtime import LicenseRuntime

VECTOR_PATH = Path(__file__).parents[2] / "docs" / "licensing" / "test-vectors" / "v1-valid.json"
VECTOR = json.loads(VECTOR_PATH.read_text())


def create_runtime(tmp_path: Path, *, enforcement: str = "required") -> LicenseRuntime:
    (tmp_path / "installation.json").write_text(
        json.dumps({"installation_id": "installation-test-01"})
    )
    (tmp_path / "current.lic").write_text(json.dumps(VECTOR["license"]))
    settings = Settings(
        license_enforcement=enforcement,
        license_product_id="dental-erp",
        license_state_dir=tmp_path,
    )
    return LicenseRuntime(
        settings,
        FileLicenseMaterialStore(tmp_path),
        {"test-2026-01": VECTOR["public_key_pem"]},
    )


@pytest.mark.asyncio
async def test_runtime_persists_evidence_for_valid_license(tmp_path: Path) -> None:
    runtime = create_runtime(tmp_path)
    decision = await runtime.decide(now=datetime(2026, 8, 20, 12, tzinfo=UTC))

    assert decision.state == "active"
    assert decision.allows_write is True
    evidence = json.loads((tmp_path / "evidence.json").read_text())
    assert evidence["highest_sequence"] == 1
    assert evidence["highest_sequence_license_id"] == ("018f47a7-5b9c-7d31-8e1a-c7c77d79f401")


@pytest.mark.asyncio
async def test_runtime_becomes_read_only_after_five_day_grace(tmp_path: Path) -> None:
    runtime = create_runtime(tmp_path)
    decision = await runtime.decide(now=datetime(2026, 9, 6, tzinfo=UTC))

    assert decision.state == "expired_read_only"
    assert decision.allows_read is True
    assert decision.allows_write is False


@pytest.mark.asyncio
async def test_required_runtime_fails_closed_when_state_is_missing(tmp_path: Path) -> None:
    settings = Settings(
        license_enforcement="required",
        license_product_id="dental-erp",
        license_state_dir=tmp_path,
    )
    runtime = LicenseRuntime(settings, FileLicenseMaterialStore(tmp_path), {})

    decision = await runtime.decide(now=datetime(2026, 8, 20, tzinfo=UTC))

    assert decision.state == "invalid"
    assert decision.allows_write is False
    assert decision.allows_read is True
    assert decision.allows_recovery is True


@pytest.mark.asyncio
async def test_disabled_mode_preserves_existing_deployments(tmp_path: Path) -> None:
    settings = Settings(
        license_enforcement="disabled",
        license_product_id="dental-erp",
        license_state_dir=tmp_path,
    )
    runtime = LicenseRuntime(settings, FileLicenseMaterialStore(tmp_path), {})

    decision = await runtime.decide(now=datetime(2026, 8, 20, tzinfo=UTC))

    assert decision.reason == "enforcement_disabled"
    assert decision.allows_write is True


@pytest.mark.asyncio
async def test_import_refuses_expired_license(tmp_path: Path) -> None:
    runtime = create_runtime(tmp_path)

    with pytest.raises(ValueError, match="expired"):
        await runtime.import_license(
            json.dumps(VECTOR["license"]), now=datetime(2026, 9, 6, tzinfo=UTC)
        )
