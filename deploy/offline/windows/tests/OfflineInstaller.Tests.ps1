BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '..\OfflineInstaller.psm1') -Force
}

Describe 'Offline installer safety contracts' {
    It 'creates long, distinct secrets' {
        $first = New-SunnySmileSecret
        $second = New-SunnySmileSecret
        $first | Should -Match '^[0-9a-f]{64}$'
        $second | Should -Match '^[0-9a-f]{64}$'
        $first | Should -Not -Be $second
    }

    It 'accepts only RFC1918 IPv4 addresses for direct cable mode' {
        Test-PrivateIPv4Address '192.168.50.10' | Should -BeTrue
        Test-PrivateIPv4Address '10.20.30.40' | Should -BeTrue
        Test-PrivateIPv4Address '172.16.0.1' | Should -BeTrue
        Test-PrivateIPv4Address '8.8.8.8' | Should -BeFalse
        Test-PrivateIPv4Address '127.0.0.1' | Should -BeFalse
        Test-PrivateIPv4Address 'not-an-ip' | Should -BeFalse
    }

    It 'refuses bundle path traversal' {
        { Resolve-SunnySmileBundleFile -BundleRoot $TestDrive -RelativePath '..\secret.txt' } |
            Should -Throw '*escapes its root*'
    }

    It 'requires explicit adapter selection when more than one exists' {
        $adapters = @(
            [pscustomobject]@{ Name = 'Ethernet 1'; ifIndex = 1 },
            [pscustomobject]@{ Name = 'Ethernet 2'; ifIndex = 2 }
        )
        { Get-SunnySmileEthernetAdapter -AvailableAdapters $adapters } |
            Should -Throw '*Re-run with -AdapterName*'
        (Get-SunnySmileEthernetAdapter -AdapterName 'Ethernet 2' -AvailableAdapters $adapters).ifIndex |
            Should -Be 2
    }

    It 'requires explicit existing-network selection when more than one is connected' {
        $profiles = @(
            [pscustomobject]@{ InterfaceAlias = 'Ethernet'; InterfaceIndex = 1 },
            [pscustomobject]@{ InterfaceAlias = 'Wi-Fi'; InterfaceIndex = 2 }
        )
        { Get-SunnySmileConnectedProfile -AvailableProfiles $profiles } |
            Should -Throw '*Re-run with -AdapterName*'
        (Get-SunnySmileConnectedProfile -AdapterName 'Wi-Fi' -AvailableProfiles $profiles).InterfaceIndex |
            Should -Be 2
    }

    It 'writes an idempotent environment with required enforcement and no weak defaults' {
        $manifest = [pscustomobject]@{
            app_image = 'sunny-smile/dental-erp:1.0.0'
            database_image = 'mysql:8.4'
        }
        $path = Join-Path $TestDrive '.env'
        Write-SunnySmileEnvironment -Path $path -Manifest $manifest -LicenseStateDirectory 'C:\ProgramData\SunnySmile\Licensing\dental-erp' -BindAddress '0.0.0.0' -Port 80
        $first = Get-Content $path -Raw
        Write-SunnySmileEnvironment -Path $path -Manifest $manifest -LicenseStateDirectory 'changed' -BindAddress '127.0.0.1' -Port 3000
        Get-Content $path -Raw | Should -BeExactly $first
        $first | Should -Match 'LICENSE_ENFORCEMENT=required'
        $first | Should -Match 'APP_BIND=0.0.0.0'
        $first | Should -Not -Match '=(password|changeme|dental123)(\r?\n|$)'
    }
}
