[CmdletBinding()]
param(
    [string]$AdapterName,
    [string]$ClientIp = '192.168.50.11',
    [string]$ServerIp = '192.168.50.10',
    [ValidateRange(1, 65535)][int]$AppPort = 80
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'OfflineInstaller.psm1') -Force

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from PowerShell as Administrator.'
}
if ($ClientIp -eq $ServerIp) {
    throw 'The server and client must have different IP addresses.'
}
$adapter = Get-SunnySmileEthernetAdapter -AdapterName $AdapterName
Set-SunnySmileDirectCableAddress -Adapter $adapter -Address $ClientIp

$result = Test-NetConnection -ComputerName $ServerIp -Port $AppPort -InformationLevel Quiet
if (-not $result) {
    throw "The cable connection is configured, but Dental ERP is not reachable at ${ServerIp}:$AppPort. Check the cable and server."
}
$url = "http://${ServerIp}:$AppPort"
Write-Host "Connection successful. Opening $url" -ForegroundColor Green
Start-Process $url
