# Activation Request Format v1

An installation creates the same signed request for online activation or USB transfer. The request contains no patient data, credentials, raw hardware serial numbers, or private key.

The flattened JWS envelope uses format `sunny-smile-activation-request/v1`, type `sunny-smile-activation-request+jws`, and Ed25519. Its payload contains `schema_version`, a random `request_id`, `product_id`, `installation_id`, the installation public JWK, `created_at`, a 192-bit random `nonce`, `app_version`, `platform`, and `delivery` (`online` or `offline`).

`installation_id` is the RFC 7638 SHA-256 thumbprint of the canonical public JWK `{crv,kty,x}`. The header key identifier, payload installation identifier, and calculated thumbprint must match.

The issuer verifies the self-signature and consumes each `(request_id, nonce)` once. Self-signing does not prove payment or device authenticity; it proves possession of the installation private key. Payment and rehost approval remain issuer decisions. Offline requests do not expire locally because USB transfer may take days, but the issuer may require a new request according to operator policy.
