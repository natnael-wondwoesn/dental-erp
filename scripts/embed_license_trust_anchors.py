"""Generate code-owned issuer public-key rings for a product release."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


def parse_keys(raw: str, *, require_nonempty: bool) -> dict[str, str]:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("issuer public keys must be a JSON object") from exc
    if not isinstance(value, dict) or any(
        not isinstance(key, str) or not isinstance(pem, str) for key, pem in value.items()
    ):
        raise ValueError("issuer public keys must map key IDs to PEM strings")
    if require_nonempty and not value:
        raise ValueError("a tagged release requires at least one issuer public key")
    result: dict[str, str] = {}
    for key_id, pem in sorted(value.items()):
        if not ID_PATTERN.fullmatch(key_id):
            raise ValueError(f"invalid issuer key ID: {key_id}")
        try:
            public_key = serialization.load_pem_public_key(pem.encode("ascii"))
        except (ValueError, UnicodeEncodeError) as exc:
            raise ValueError(f"invalid PEM for issuer key: {key_id}") from exc
        if not isinstance(public_key, Ed25519PublicKey):
            raise ValueError(f"issuer key is not Ed25519: {key_id}")
        result[key_id] = pem
    return result


def render_python(keys: dict[str, str]) -> str:
    encoded = json.dumps(keys, sort_keys=True, indent=4)
    return (
        '"""Generated issuer public keys. Never place private keys here."""\n\n'
        "from types import MappingProxyType\n\n"
        f"ISSUER_PUBLIC_KEYS = MappingProxyType({encoded})\n"
    )


def render_typescript(keys: dict[str, str]) -> str:
    encoded = json.dumps(keys, sort_keys=True, indent=2)
    return (
        "/** Generated issuer public keys. Never place private keys here. */\n"
        "export const ISSUER_PUBLIC_KEYS: Readonly<Record<string, string>> = "
        f"Object.freeze({encoded})\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--keys-json",
        default=os.environ.get("LICENSE_ISSUER_PUBLIC_KEYS_JSON", "{}"),
        help="JSON object; defaults to LICENSE_ISSUER_PUBLIC_KEYS_JSON",
    )
    parser.add_argument("--require-nonempty", action="store_true")
    parser.add_argument(
        "--python-output",
        type=Path,
        default=Path("backend/app/licensing/trust_anchors.py"),
    )
    parser.add_argument(
        "--typescript-output",
        type=Path,
        default=Path("lib/licensing/trust-anchors.ts"),
    )
    arguments = parser.parse_args()
    keys = parse_keys(arguments.keys_json, require_nonempty=arguments.require_nonempty)
    arguments.python_output.write_text(render_python(keys), encoding="utf-8")
    arguments.typescript_output.write_text(render_typescript(keys), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
