"""Small command interface intended for packaging as the Windows license agent."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import TextIO

from app.licensing.host_agent import HostLicenseAgent
from app.licensing.identity_store import (
    InstallationIdentityStore,
    SecretProtector,
    WindowsDpapiMachineProtector,
)
from app.licensing.trust_anchors import ISSUER_PUBLIC_KEYS


def default_state_dir(product_id: str) -> Path:
    program_data = os.environ.get("PROGRAMDATA")
    if os.name != "nt" or not program_data:
        raise OSError("The default licensing directory is available only on Windows")
    return Path(program_data) / "SunnySmile" / "Licensing" / product_id


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(prog="sunny-smile-license-agent")
    command.add_argument("--product-id", required=True)
    command.add_argument("--state-dir", type=Path)
    actions = command.add_subparsers(dest="action", required=True)
    actions.add_parser("init")
    request = actions.add_parser("request")
    request.add_argument("--app-version", required=True)
    request.add_argument("--delivery", choices=("online", "offline"), required=True)
    request.add_argument("--output", type=Path, required=True)
    install = actions.add_parser("install-license")
    install.add_argument("--input", type=Path, required=True)
    return command


def run(
    argv: Sequence[str],
    *,
    protector: SecretProtector | None = None,
    public_keys: Mapping[str, str] = ISSUER_PUBLIC_KEYS,
    now: datetime | None = None,
    output: TextIO = sys.stdout,
) -> int:
    arguments = parser().parse_args(argv)
    state_dir = arguments.state_dir or default_state_dir(arguments.product_id)
    protector = protector or WindowsDpapiMachineProtector(arguments.product_id)
    identity_store = InstallationIdentityStore(state_dir, arguments.product_id, protector)
    agent = HostLicenseAgent(identity_store, public_keys)
    now = now or datetime.now(UTC)

    if arguments.action == "init":
        identity = identity_store.load_or_create(now=now)
        result = {"status": "ready", "installation_id": identity.installation_id}
    elif arguments.action == "request":
        exported = agent.export_activation_request(
            arguments.output,
            app_version=arguments.app_version,
            delivery=arguments.delivery,
            now=now,
        )
        result = {
            "status": "request_created",
            "installation_id": exported.installation_id,
            "delivery": exported.delivery,
            "output": str(exported.output_path),
        }
    else:
        decision = agent.import_license_document(
            arguments.input.read_text(encoding="utf-8"),
            now=now,
        )
        result = {
            "status": "license_installed",
            "state": decision.state,
            "expires_at": decision.payload.expires_at if decision.payload else None,
        }
    output.write(json.dumps(result, separators=(",", ":")) + "\n")
    return 0


def main() -> None:
    try:
        raise SystemExit(run(sys.argv[1:]))
    except (OSError, RuntimeError, ValueError) as exc:
        sys.stderr.write(json.dumps({"status": "error", "message": str(exc)}) + "\n")
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()
