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
        [ValidateRange(1, 65535)][int]$Port = 80
    )

    if (Test-Path -LiteralPath $Path) {
        return
    }
    $lines = @(
        "DENTAL_ERP_IMAGE=$($Manifest.app_image)",
        "MYSQL_IMAGE=$($Manifest.database_image)",
        'MYSQL_DATABASE=dental_erp',
        'MYSQL_USER=dental',
        "MYSQL_PASSWORD=$(New-SunnySmileSecret)",
        "MYSQL_ROOT_PASSWORD=$(New-SunnySmileSecret)",
        "NEXTAUTH_SECRET=$(New-SunnySmileSecret)",
        'LICENSE_ENFORCEMENT=required',
        'LICENSE_PRODUCT_ID=dental-erp',
        "LICENSE_STATE_HOST_DIR=$LicenseStateDirectory",
        "APP_BIND=$BindAddress",
        "APP_PORT=$Port"
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $lines, $encoding)
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
    'Write-SunnySmileEnvironment'
)
