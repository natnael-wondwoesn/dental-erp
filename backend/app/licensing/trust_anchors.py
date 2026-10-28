"""Issuer trust anchors shipped read-only with the product.

Public keys are intentionally code-owned rather than loaded from the clinic state
directory. Production release automation inserts active issuer public keys here.
Private keys never enter this repository or any clinic installation.
"""

from types import MappingProxyType

ISSUER_PUBLIC_KEYS: MappingProxyType[str, str] = MappingProxyType(
    {
        "vendor-2026-10": "-----BEGIN PUBLIC KEY-----\n"
        "MCowBQYDK2VwAyEAUYfJ/dB+d5j5L0t4oinLDX+tYwIKRIVKPPk+OOnbsL8=\n"
        "-----END PUBLIC KEY-----\n",
    }
)
