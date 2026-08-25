# Offline License Format v1

## Encoding

A `.lic` file is UTF-8 JSON using the flattened JWS shape:

```json
{
  "format": "sunny-smile-offline-license/v1",
  "protected": "base64url(JWS protected header)",
  "payload": "base64url(license payload)",
  "signature": "base64url(Ed25519 signature)"
}
```

The Ed25519 signing input is the ASCII bytes of `protected + "." + payload`. Base64url values are unpadded and canonical. Issuers serialize the header and payload with RFC 8785 JSON Canonicalization. Verifiers validate the exact encoded bytes and therefore do not reconstruct the signing input.

## Protected header

| Field | Rule                                         |
| ----- | -------------------------------------------- |
| `alg` | Exactly `EdDSA`                              |
| `kid` | Identifier in the verifier's public-key ring |
| `typ` | Exactly `sunny-smile-offline-license+jws`    |

Unknown critical header parameters are rejected.

## Payload

| Field             | Rule                                                    |
| ----------------- | ------------------------------------------------------- |
| `schema_version`  | Integer `1`                                             |
| `license_id`      | Unique UUID                                             |
| `customer_id`     | Issuer customer identifier                              |
| `product_id`      | Product identifier expected by the installed adapter    |
| `installation_id` | SHA-256 fingerprint of the installation public identity |
| `sequence`        | Positive integer; renewals must increase it             |
| `issued_at`       | UTC RFC 3339 timestamp                                  |
| `not_before`      | UTC RFC 3339 timestamp                                  |
| `expires_at`      | UTC RFC 3339 timestamp after `not_before`               |
| `mode`            | `standard` or `emergency`                               |
| `grace_days`      | Exactly `5` for standard and `0` for emergency          |
| `entitlements`    | Unique product-defined identifiers                      |

The payload contains no clinic operational data and no patient data.

## Decisions

| Decision            | Ordinary reads                    | Ordinary writes                                  | Backup/export/license administration |
| ------------------- | --------------------------------- | ------------------------------------------------ | ------------------------------------ |
| `active`            | Allowed                           | Allowed                                          | Allowed                              |
| `grace`             | Allowed                           | Allowed, with prominent warnings                 | Allowed                              |
| `expired_read_only` | Allowed                           | Denied                                           | Allowed                              |
| `invalid`           | Allowed after user authentication | Denied                                           | Allowed                              |
| `recovery`          | Allowed after user authentication | Only actions authorized by the recovery artifact | Allowed                              |

The grace interval is five 24-hour periods from `expires_at`. Applications store and compare UTC instants; local Ethiopian time is presentation only.

## Persisted evidence

Each installation persists the latest observed trusted time, the highest accepted sequence, and the corresponding license identifier in both the product database and Windows machine-scoped storage. A decision rejects a wall clock that moves backwards beyond a small operational tolerance or a license sequence lower than the recorded maximum. Issuer public keys are shipped as read-only product trust anchors, never loaded from clinic-writable license state.

When connectivity exists, a signed issuer timestamp can strengthen the time evidence. When TPM protection exists, the Windows adapter seals the installation key and time evidence to that machine. Neither is required for offline operation.

## Recovery

- Minor repairs do not change the installation identity.
- A lost identity or replaced computer produces a new activation request and follows rehosting approval.
- A database restore retains the Windows identity and reconciles the two persisted evidence copies by choosing the strictest valid values.
- A suspected issuer-key compromise requires an application update containing a revised public-key ring or a signed revocation artifact delivered by USB.
