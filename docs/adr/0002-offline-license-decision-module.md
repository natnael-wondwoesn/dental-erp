# ADR-0002: Shared offline license decision module

- Status: Accepted
- Date: 2026-08-24

## Context

Dental ERP, Clinic CMS, and future custom products must support existing Windows 10/11 clinic computers with intermittent or no internet. A clinic may use one computer or connect additional computers over an internet-free Ethernet LAN. License enforcement must therefore work locally without making clinical data inaccessible after a commercial term expires.

The customer controls the Windows computer and may have administrator access. Software-only enforcement cannot be perfect against a determined administrator who can patch executables or restore complete disk snapshots. The design must provide strong practical tamper resistance, honest failure behavior, and optional stronger protection when Windows exposes TPM-backed keys.

## Decision

Create a deep Signed License Decision Module with Python and TypeScript adapters that implement one versioned signed format and pass the same golden test vectors.

Licenses use JWS-style Ed25519 signatures. The protected header identifies the signing key and format. The payload binds a product, customer, installation, license sequence, validity period, mode, and entitlements. Verifiers carry a public-key ring; private signing keys remain exclusively in the online issuer's managed key store.

The installation identity is a locally generated keypair protected with Windows machine-scoped facilities. TPM-backed protection is used automatically when available but is not required. Hardware facts are recovery evidence rather than a single brittle lock.

The decision module combines signature verification with persisted time evidence and the highest accepted license sequence. It detects ordinary clock rollback, old-license replay, wrong-product use, wrong-installation use, malformed licenses, and unknown signing keys.

A standard license has exactly five days of grace. After grace, authenticated clinical and commercial records remain readable and the installation continues to allow audit access, backup, export, and license administration. Ordinary business writes are denied. A short vendor-signed emergency license may temporarily restore writes.

Online and offline activation use the same signed format. Online installations exchange activation and renewal data automatically. Offline installations export an activation request and import a signed license using removable media.

## Consequences

- Licensing policy gains locality: changes are concentrated in one module and its cross-language vectors.
- Product authorization remains responsible for user permissions; the license decision is an additional server-side gate.
- Key rotation is possible through key identifiers and product updates that carry a new public-key ring.
- Urgent offline revocation is not immediate; it requires a signed revocation artifact delivered to the installation, while ordinary non-renewal takes effect after expiry and grace.
- Software-only installations provide tamper resistance rather than absolute DRM. TPM-backed Windows installations raise the cost of key extraction and state cloning.
- Full installation cloning and simultaneous rollback of all software state cannot be reliably defeated without trusted hardware or connectivity. Commercial terms and audited rehosting remain part of the control model.
