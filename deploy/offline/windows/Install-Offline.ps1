[CmdletBinding()]
param(
    [ValidateSet('LocalOnly', 'ExistingNetwork', 'DirectCable')]
    [string]$LanMode = 'LocalOnly',
    [string]$AdapterName,
    [string]$ServerIp = '192.168.50.10',
    [ValidateRange(1, 65535)][int]$AppPort = 80,
    [string]$InstallRoot = "$env:ProgramData\SunnySmile\DentalERP",
    [string]$LicenseFile,
    [string]$RequestOutput
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'OfflineInstaller.psm1') -Force

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this installer from PowerShell as Administrator.'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop is not installed. Use the supplied prerequisite installer, then run this again.'
}
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop is installed but is not running.'
}

$manifest = Read-SunnySmileBundleManifest -BundleRoot $PSScriptRoot
Write-Host 'Checking USB bundle integrity...'
Test-SunnySmileBundleIntegrity -BundleRoot $PSScriptRoot -Manifest $manifest

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
$licenseState = Join-Path $env:ProgramData 'SunnySmile\Licensing\dental-erp'
New-Item -ItemType Directory -Path $licenseState -Force | Out-Null

$agentSource = Resolve-SunnySmileBundleFile -BundleRoot $PSScriptRoot -RelativePath $manifest.license_agent
$agent = Join-Path $InstallRoot 'dental-license-agent.exe'
Copy-Item -LiteralPath $agentSource -Destination $agent -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'compose.offline.yml') -Destination (Join-Path $InstallRoot 'compose.yml') -Force

& $agent --product-id dental-erp --state-dir $licenseState init
if ($LASTEXITCODE -ne 0) {
    throw 'The installation identity could not be initialized.'
}

if (-not [string]::IsNullOrWhiteSpace($LicenseFile)) {
    & $agent --product-id dental-erp --state-dir $licenseState install-license --input $LicenseFile
    if ($LASTEXITCODE -ne 0) {
        throw 'The supplied license was rejected.'
    }
}
else {
    if ([string]::IsNullOrWhiteSpace($RequestOutput)) {
        $RequestOutput = Join-Path ([Environment]::GetFolderPath('Desktop')) 'dental-erp-activation.req'
    }
    & $agent --product-id dental-erp --state-dir $licenseState request --app-version $manifest.app_version --delivery offline --output $RequestOutput
    if ($LASTEXITCODE -ne 0) {
        throw 'The activation request could not be created.'
    }
    Write-Warning "No license was supplied. Give this request file to Sunny Smile: $RequestOutput"
}

$bindAddress = if ($LanMode -eq 'LocalOnly') { '127.0.0.1' } else { '0.0.0.0' }
if ($LanMode -eq 'DirectCable') {
    $adapter = Get-SunnySmileEthernetAdapter -AdapterName $AdapterName
    Set-SunnySmileDirectCableAddress -Adapter $adapter -Address $ServerIp
}
elseif ($LanMode -eq 'ExistingNetwork') {
    $networkProfile = Get-SunnySmileConnectedProfile -AdapterName $AdapterName
    Set-SunnySmileExistingNetworkPrivate -Profile $networkProfile
}
if ($LanMode -ne 'LocalOnly') {
    Enable-SunnySmileLanFirewall -Port $AppPort
}

$environmentPath = Join-Path $InstallRoot '.env'
Write-SunnySmileEnvironment `
    -Path $environmentPath `
    -Manifest $manifest `
    -LicenseStateDirectory $licenseState `
    -BindAddress $bindAddress `
    -Port $AppPort

foreach ($image in $manifest.container_archives) {
    $archive = Resolve-SunnySmileBundleFile -BundleRoot $PSScriptRoot -RelativePath $image
    Write-Host "Loading $image..."
    docker load --input $archive
    if ($LASTEXITCODE -ne 0) {
        throw "Docker could not load $image"
    }
}

Push-Location $InstallRoot
try {
    docker compose --env-file .env -f compose.yml up -d --pull never
    if ($LASTEXITCODE -ne 0) {
        throw 'The Dental ERP containers did not start.'
    }
}
finally {
    Pop-Location
}

$localUrl = "http://localhost:$AppPort"
for ($attempt = 1; $attempt -le 60; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri "$localUrl/api/health" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) { break }
    }
    catch {
        if ($attempt -eq 60) { throw 'Dental ERP did not become healthy within two minutes.' }
    }
    Start-Sleep -Seconds 2
}

Write-Host "Dental ERP is ready on this computer: $localUrl" -ForegroundColor Green
if ($LanMode -eq 'DirectCable') {
    Write-Host "On the second computer run Configure-Direct-Cable-Client.ps1, then open http://${ServerIp}:$AppPort" -ForegroundColor Green
}
elseif ($LanMode -eq 'ExistingNetwork') {
    $addresses = @(Get-NetIPAddress -InterfaceIndex $networkProfile.InterfaceIndex -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '169.254.*' })
    foreach ($address in $addresses) {
        Write-Host "Other computers on this LAN can open http://$($address.IPAddress):$AppPort" -ForegroundColor Green
    }
}
