# Offline Windows and LAN installation

This deployment is designed for an Ethiopian clinic that always has at least one Windows 10/11 desktop but may have no internet, router, Wi-Fi card, or working wireless driver.

## What the customer needs

- One Windows 10/11 server computer with Ethernet and Docker Desktop installed.
- For two computers: one ordinary Cat5e/Cat6 Ethernet cable. Modern network cards normally support direct connection; no crossover cable is required.
- For three or more computers: an unmanaged Ethernet switch and one cable per computer. The switch does not need internet.
- The signed Sunny Smile USB release bundle and a current `.lic` file. If no license is present, setup creates an activation request that can be carried by USB to an internet-connected device.

Docker Desktop is the only large prerequisite. For a truly air-gapped clinic, place its approved offline installer and any required WSL package in the same USB delivery kit before travelling to the clinic.

## One-command server setup

Open Windows PowerShell **as Administrator**, change into the USB bundle directory, and choose one mode:

```powershell
# Only this computer
.\Install-Offline.ps1 -LanMode LocalOnly -LicenseFile .\customer.lic

# The clinic already has a LAN, even if that LAN has no internet
.\Install-Offline.ps1 -LanMode ExistingNetwork -LicenseFile .\customer.lic

# Exactly two computers connected directly by Ethernet cable
.\Install-Offline.ps1 -LanMode DirectCable -LicenseFile .\customer.lic
```

Direct-cable mode gives the server `192.168.50.10/24`, with no gateway and no DNS. On the second computer, open PowerShell as Administrator from the same USB and run:

```powershell
.\Configure-Direct-Cable-Client.ps1
```

That assigns `192.168.50.11/24`, verifies port 80, and opens `http://192.168.50.10`. If a computer has multiple Ethernet adapters, pass `-AdapterName "Ethernet 2"` explicitly; the scripts refuse to guess.

Existing-network mode also refuses to guess when both Wi-Fi and Ethernet are
connected. Pass the desired Windows adapter name, for example
`-AdapterName "Wi-Fi"`. Setup marks only that network Private and prints its
exact clinic URL.

For three or more PCs without a router, connect all PCs to an unmanaged switch. Use `192.168.50.10` for the server, then assign clients `192.168.50.11`, `.12`, `.13`, and so on, all with prefix length 24 and blank gateway/DNS fields.

## Safety behavior

- Container archives are loaded from USB with `--pull never`; installation never downloads an image.
- Every bundled file is checked against its SHA-256 manifest before execution.
- Database passwords and the application session secret are generated cryptographically and retained across reruns.
- Local-only mode binds to `127.0.0.1`. LAN modes bind to all interfaces but create a Windows firewall rule limited to the Private profile and `LocalSubnet`.
- Direct-cable mode refuses public IP addresses and refuses ambiguous network-adapter selection.
- Patient data, uploads, license state, and the database are stored outside disposable app containers.
- Re-running setup is idempotent and does not replace the generated secrets or erase volumes.

SHA-256 checks detect corruption. Release authenticity must additionally come from a vendor-signed ZIP/installer or an out-of-band published release hash; a manifest stored beside altered files is not, by itself, proof of vendor origin.

## Expected USB bundle layout

```text
Install-Offline.ps1
Configure-Direct-Cable-Client.ps1
OfflineInstaller.psm1
compose.offline.yml
bundle-manifest.json
bin/dental-license-agent.exe
images/dental-erp.tar
images/mysql-8.4.tar
customer.lic                 # optional
```

The release pipeline creates `bundle-manifest.json`; it contains the exact image tags, app version, relative paths, and SHA-256 values. Do not hand-edit it at the clinic.

## Release preparation

Before creating the first version tag, configure the GitHub Actions secret
`LICENSE_ISSUER_PUBLIC_KEYS_JSON` as a JSON object mapping each active key ID to
its Ed25519 public-key PEM. A tagged release refuses to build with an empty or
invalid key ring. Only public keys belong there; the issuer private key remains
in the separate license portal/key-custody system.

The tag workflow embeds the same public ring into the app and Windows agent,
smoke-tests the compiled `.exe` on Windows, exports Linux/amd64 Docker images,
generates the manifest hashes, and attaches
`dental-erp-offline-windows-<version>.zip` to the GitHub release.
