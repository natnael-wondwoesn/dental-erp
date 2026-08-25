# Offline licensing and LAN field acceptance

Run this checklist on the exact Windows 10/11 computer and release ZIP intended
for the clinic. Record the release version, Windows version, operator, date, and
result for every case. Never use real patient data during acceptance testing.

## Release and installation

- Verify the ZIP came from the expected GitHub release or matches a separately
  supplied vendor hash/signature.
- Disconnect internet, run PowerShell as Administrator, and install in
  `LocalOnly` mode without a license. Confirm setup creates an activation
  request and does not download container images.
- Confirm the application opens locally, existing records remain readable, and
  ordinary create/update/delete actions are blocked until activation.
- Transfer the request by USB, issue a license for `dental-erp`, rerun setup with
  `-LicenseFile`, and confirm writes become available without reinstalling data.
- Try a modified `.lic`, a Clinic CMS license, and a license from another test
  computer. Confirm all three are rejected.

## Five-day grace and recovery

Use test licenses with controlled dates; do not alter production license dates.

- Confirm normal writes work through the stated expiry instant.
- Confirm writes work during days 1–5 after expiry and the UI/API reports
  `grace`.
- Confirm writes stop immediately after the fifth grace day while reads,
  backups, exports, audit access, and license import remain available.
- Move the Windows clock backwards by more than five minutes. Confirm ordinary
  licenses fail closed, then restore the correct time.
- Import a newer signed emergency license valid for no more than 72 hours.
  Confirm it restores recovery access, has no grace, and cannot be replayed
  after a higher sequence license has been installed.

## Direct Ethernet: two computers, no router and no internet

- Connect one ordinary Cat5e/Cat6 cable from server to client.
- Run `Install-Offline.ps1 -LanMode DirectCable` on the server and
  `Configure-Direct-Cable-Client.ps1` on the client.
- Confirm server/client addresses are `192.168.50.10/24` and
  `192.168.50.11/24`, with blank gateway and DNS.
- Confirm the client opens `http://192.168.50.10`, can sign in, and sees a
  record created on the server.
- Confirm an unrelated Public network cannot reach the application and the
  firewall rule is limited to Private/LocalSubnet.

## Existing LAN or unmanaged switch

- Test `ExistingNetwork` mode on a LAN with internet, then repeat after
  disconnecting internet. Confirm application behavior is unchanged.
- For a no-router switch test, connect at least three PCs; assign the server
  `.10` and clients `.11`, `.12`, and onward on `192.168.50.0/24`, with blank
  gateway/DNS. Confirm simultaneous clients can create and read test records.
- If multiple adapters exist, confirm setup refuses to guess until
  `-AdapterName` is supplied.

## Restart, persistence, and failure handling

- Restart Windows and Docker Desktop. Confirm the stack returns without a new
  activation or changed installation ID.
- Rerun setup. Confirm secrets, database volumes, records, and license sequence
  are preserved.
- Stop the database container and confirm the application reports unavailable
  rather than silently losing writes. Start it and confirm recovery.
- Export and restore a test backup. Confirm license state is not replaced by a
  backup from another machine.

Acceptance requires every applicable item to pass. Windows DPAPI, packaged
`.exe`, and PowerShell contract tests must also be green in GitHub Actions for
the same commit/tag.
