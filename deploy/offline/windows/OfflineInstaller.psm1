Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-SunnySmileSecret {
    param([ValidateRange(16, 128)][int]$Bytes = 32)

    $buffer = New-Object byte[] $Bytes
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($buffer)
    }
    finally {
        $generator.Dispose()
    }
    return ([System.BitConverter]::ToString($buffer)).Replace('-', '').ToLowerInvariant()
}

function Test-PrivateIPv4Address {
    param([Parameter(Mandatory)][string]$Address)

    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsed)) {
        return $false
    }
    $bytes = $parsed.GetAddressBytes()
    if ($bytes.Length -ne 4) {
        return $false
    }
    return (
        $bytes[0] -eq 10 -or
        ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
        ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
    )
}

function Resolve-SunnySmileBundleFile {
    param(
        [Parameter(Mandatory)][string]$BundleRoot,
        [Parameter(Mandatory)][string]$RelativePath
    )

    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "Bundle paths must be relative: $RelativePath"
    }
    $root = [System.IO.Path]::GetFullPath($BundleRoot).TrimEnd('\', '/')
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $RelativePath))
    if (-not $candidate.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Bundle path escapes its root: $RelativePath"
    }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw "Required bundle file is missing: $RelativePath"
    }
    return $candidate
}

function Read-SunnySmileBundleManifest {
    param([Parameter(Mandatory)][string]$BundleRoot)

    $manifestPath = Resolve-SunnySmileBundleFile -BundleRoot $BundleRoot -RelativePath 'bundle-manifest.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.schema_version -ne 1 -or $manifest.product_id -ne 'dental-erp') {
        throw 'This bundle is not a supported Dental ERP offline release.'
    }
    if ([string]::IsNullOrWhiteSpace($manifest.app_image) -or [string]::IsNullOrWhiteSpace($manifest.database_image)) {
        throw 'The bundle manifest does not name both container images.'
    }
    if ($null -eq $manifest.files -or $manifest.files.Count -lt 3) {
        throw 'The bundle manifest is incomplete.'
    }
    return $manifest
}

function Test-SunnySmileBundleIntegrity {
    param(
        [Parameter(Mandatory)][string]$BundleRoot,
        [Parameter(Mandatory)]$Manifest
    )

    foreach ($entry in $Manifest.files) {
        $file = Resolve-SunnySmileBundleFile -BundleRoot $BundleRoot -RelativePath $entry.path
        if ($entry.sha256 -notmatch '^[0-9a-fA-F]{64}$') {
            throw "Invalid SHA-256 value for $($entry.path)"
        }
        $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        if ($actual -ne $entry.sha256) {
            throw "Bundle integrity check failed for $($entry.path)"
        }
    }
}

function Get-SunnySmileEthernetAdapter {
    param(
        [string]$AdapterName,
        [object[]]$AvailableAdapters
    )

    if ($null -eq $AvailableAdapters) {
        $AvailableAdapters = @(Get-NetAdapter -Physical | Where-Object {
            $_.Status -ne 'Disabled' -and
            ($_.PhysicalMediaType -eq '802.3' -or $_.InterfaceDescription -match 'Ethernet')
        })
    }
    if (-not [string]::IsNullOrWhiteSpace($AdapterName)) {
        $matched = @($AvailableAdapters | Where-Object { $_.Name -eq $AdapterName })
        if ($matched.Count -ne 1) {
            throw "Ethernet adapter '$AdapterName' was not found."
        }
        return $matched[0]
    }
    if ($AvailableAdapters.Count -ne 1) {
        $names = ($AvailableAdapters | ForEach-Object { $_.Name }) -join ', '
        throw "Expected one Ethernet adapter but found $($AvailableAdapters.Count): $names. Re-run with -AdapterName."
    }
    return $AvailableAdapters[0]
}

function Get-SunnySmileConnectedProfile {
    param(
        [string]$AdapterName,
        [object[]]$AvailableProfiles
    )

    if ($null -eq $AvailableProfiles) {
        $AvailableProfiles = @(Get-NetConnectionProfile | Where-Object {
            $_.IPv4Connectivity -ne 'Disconnected'
        })
    }
    if (-not [string]::IsNullOrWhiteSpace($AdapterName)) {
        $matched = @($AvailableProfiles | Where-Object { $_.InterfaceAlias -eq $AdapterName })
        if ($matched.Count -ne 1) {
            throw "Connected network adapter '$AdapterName' was not found."
        }
        return $matched[0]
    }
    if ($AvailableProfiles.Count -ne 1) {
        $names = ($AvailableProfiles | ForEach-Object { $_.InterfaceAlias }) -join ', '
        throw "Expected one connected network but found $($AvailableProfiles.Count): $names. Re-run with -AdapterName."
    }
    return $AvailableProfiles[0]
}

function Set-SunnySmileExistingNetworkPrivate {
    param([Parameter(Mandatory)]$Profile)

    if ($Profile.NetworkCategory -ne 'DomainAuthenticated') {
        Set-NetConnectionProfile -InterfaceIndex $Profile.InterfaceIndex -NetworkCategory Private
    }
}

function Set-SunnySmileDirectCableAddress {
    param(
        [Parameter(Mandatory)]$Adapter,
        [Parameter(Mandatory)][string]$Address
    )

    if (-not (Test-PrivateIPv4Address $Address)) {
        throw 'Direct-cable addresses must be private IPv4 addresses.'
    }
    $collision = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -eq $Address -and $_.InterfaceIndex -ne $Adapter.ifIndex }
    if ($collision) {
        throw "IP address $Address is already assigned to another adapter."
    }
    $existing = Get-NetIPAddress -InterfaceIndex $Adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -eq $Address -and $_.PrefixLength -eq 24 }
    if (-not $existing) {
        Set-NetIPInterface -InterfaceIndex $Adapter.ifIndex -AddressFamily IPv4 -Dhcp Disabled
        New-NetIPAddress -InterfaceIndex $Adapter.ifIndex -IPAddress $Address -PrefixLength 24 | Out-Null
    }
    Set-NetConnectionProfile -InterfaceIndex $Adapter.ifIndex -NetworkCategory Private
}

function Enable-SunnySmileLanFirewall {
    param([ValidateRange(1, 65535)][int]$Port)

    $ruleName = "SunnySmile-DentalERP-$Port"
    $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule `
            -Name $ruleName `
            -DisplayName "Sunny Smile Dental ERP (TCP $Port)" `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $Port `
            -Profile Private `
            -RemoteAddress LocalSubnet | Out-Null
    }
}

function Write-SunnySmileEnvironment {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)]$Manifest,
        [Parameter(Mandatory)][string]$LicenseStateDirectory,
        [Parameter(Mandatory)][string]$BindAddress,
        [string]$ClinicId = '',
        [string]$CustomerId = '',
        [ValidateRange(1, 65535)][int]$Port = 80,
        [switch]$NoLicense
    )

    if (Test-Path -LiteralPath $Path) {
        return
    }
    $licenseMode = if ($NoLicense) { 'disabled' } else { 'required' }
    $saasMode = if ($NoLicense) { 'local' } else { 'offline' }
    $lines = @(
        "DENTAL_ERP_IMAGE=$($Manifest.app_image)",
        "MYSQL_IMAGE=$($Manifest.database_image)",
        'MYSQL_DATABASE=dental_erp',
        'MYSQL_USER=dental',
        "MYSQL_PASSWORD=$(New-SunnySmileSecret)",
        "MYSQL_ROOT_PASSWORD=$(New-SunnySmileSecret)",
        "NEXTAUTH_SECRET=$(New-SunnySmileSecret)",
        "LICENSE_ENFORCEMENT=$licenseMode",
        "SAAS_ENFORCEMENT=$saasMode",
        'SAAS_MODULES=all',
        "SAAS_TENANT_ID=$ClinicId",
        "SAAS_CUSTOMER_ID=$CustomerId",
        'LICENSE_PRODUCT_ID=dental-erp',
        "LICENSE_STATE_HOST_DIR=$LicenseStateDirectory",
        "APP_BIND=$BindAddress",
        "APP_PORT=$Port"
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $lines, $encoding)
}

function Get-SunnySmileStartingPage {
    param([ValidateRange(1, 65535)][int]$Port = 80)

    $url = if ($Port -eq 80) { 'http://localhost/' } else { "http://localhost:$Port/" }
    @"
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Starting the clinic system...</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f5f8fb;color:#12324a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
.box{max-width:460px;padding:32px}h1{font-size:24px;margin:0 0 12px}p{margin:0;color:#4a6478}</style></head>
<body><div class="box"><h1>Starting the clinic system...</h1>
<p>Please wait a moment. This page opens the system automatically when it is ready.</p></div>
<script>
var target = '$url';
function check() {
  fetch(target + 'api/health', { mode: 'no-cors', cache: 'no-store' })
    .then(function () { location.replace(target + 'login'); })
    .catch(function () { setTimeout(check, 4000); });
}
check();
</script></body></html>
"@
}

function Get-SunnySmileStartupScript {
    @'
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$log = Join-Path $root 'startup.log'
function Write-Log($message) { Add-Content -LiteralPath $log -Value ('{0} {1}' -f (Get-Date -Format s), $message) }
Write-Log 'Sign-in start'
try { Start-Process -FilePath (Join-Path $root 'starting.html') } catch { Write-Log "Could not open the starting page: $_" }
$desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $desktop)) {
    Start-Process -FilePath $desktop
    Write-Log 'Started Docker Desktop'
}
$ready = $false
for ($i = 0; $i -lt 120; $i++) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $ready) { Write-Log 'Docker did not become ready within 10 minutes'; exit 1 }
Set-Location -LiteralPath $root
docker compose --env-file .env -f compose.yml up -d --pull never *>> $log
Write-Log "Compose finished with exit code $LASTEXITCODE"
'@
}

function Register-SunnySmileAutoStart {
    param(
        [Parameter(Mandatory)][string]$InstallRoot,
        [ValidateRange(1, 65535)][int]$Port = 80
    )

    $scriptPath = Join-Path $InstallRoot 'Start-DentalERP.ps1'
    $pagePath = Join-Path $InstallRoot 'starting.html'
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($scriptPath, (Get-SunnySmileStartupScript), $encoding)
    [System.IO.File]::WriteAllText($pagePath, (Get-SunnySmileStartingPage -Port $Port), $encoding)

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -GroupId 'BUILTIN\Users' -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName 'SunnySmile-DentalERP-Start' -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null
}

Export-ModuleMember -Function @(
    'New-SunnySmileSecret',
    'Test-PrivateIPv4Address',
    'Resolve-SunnySmileBundleFile',
    'Read-SunnySmileBundleManifest',
    'Test-SunnySmileBundleIntegrity',
    'Get-SunnySmileEthernetAdapter',
    'Get-SunnySmileConnectedProfile',
    'Set-SunnySmileExistingNetworkPrivate',
    'Set-SunnySmileDirectCableAddress',
    'Enable-SunnySmileLanFirewall',
    'Write-SunnySmileEnvironment',
    'Get-SunnySmileStartingPage',
    'Get-SunnySmileStartupScript',
    'Register-SunnySmileAutoStart'
)
