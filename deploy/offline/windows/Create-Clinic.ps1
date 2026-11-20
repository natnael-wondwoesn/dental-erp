<#
  Create-Clinic.ps1 - creates the clinic and its first administrator on an offline install.
  (The sign-up page is switched off in this product, so this replaces it.)

  Run in PowerShell as Administrator, from the folder that holds this script:
      Set-ExecutionPolicy -Scope Process Bypass
      .\Create-Clinic.ps1
  It asks for the clinic name, administrator name, mobile number and password.
  Works for both routes: it uses the no-Docker install in C:\DentalERP if it is there,
  otherwise the Docker install in C:\ProgramData\SunnySmile\DentalERP.
#>
[CmdletBinding()]
param(
    [string]$HospitalName,
    [string]$AdminName,
    [string]$Phone,
    [string]$Email = '',
    [string]$Address = '',
    [string]$City = 'Addis Ababa',
    [securestring]$Password,
    [string]$PasswordText,
    [string]$NativeRoot = 'C:\DentalERP',
    [string]$DockerRoot = (Join-Path $env:ProgramData 'SunnySmile\DentalERP')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$tools = Join-Path $PSScriptRoot 'tools'
if (-not (Test-Path -LiteralPath (Join-Path $tools 'create-clinic.js'))) { throw "The tools folder is missing next to this script: $tools" }
if (-not (Test-Path -LiteralPath (Join-Path $tools 'node_modules\bcryptjs\package.json'))) { throw 'tools\node_modules\bcryptjs is missing.' }

while (-not $HospitalName) { $HospitalName = (Read-Host 'Clinic name').Trim() }
while (-not $AdminName) { $AdminName = (Read-Host 'Administrator full name').Trim() }
while (-not $Phone) { $Phone = (Read-Host 'Administrator mobile number (for example 0911234567)').Trim() }

if (-not $PasswordText) {
    if (-not $Password) {
        $first = Read-Host 'Choose a password (8 or more characters)' -AsSecureString
        $second = Read-Host 'Type the password again' -AsSecureString
        $a = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($first))
        $b = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($second))
        if ($a -ne $b) { throw 'The two passwords do not match.' }
        $PasswordText = $a
    }
    else {
        $PasswordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
    }
}

$payload = @{
    hospitalName = $HospitalName
    adminName    = $AdminName
    phone        = $Phone
    email        = $Email
    address      = $Address
    city         = $City
    password     = $PasswordText
} | ConvertTo-Json -Compress

$inputFile = Join-Path $env:TEMP ('clinic-input-' + [guid]::NewGuid().ToString('N') + '.json')
$outFile = $inputFile + '.out'
$errFile = $inputFile + '.err'
[System.IO.File]::WriteAllText($inputFile, $payload, (New-Object System.Text.UTF8Encoding($false)))

function Invoke-WithStdin($file, $arguments) {
    $process = Start-Process -FilePath $file -ArgumentList $arguments -RedirectStandardInput $inputFile `
        -RedirectStandardOutput $outFile -RedirectStandardError $errFile -NoNewWindow -Wait -PassThru
    $text = ''
    if (Test-Path -LiteralPath $outFile) { $text += (Get-Content -LiteralPath $outFile -Raw) }
    if (Test-Path -LiteralPath $errFile) { $text += (Get-Content -LiteralPath $errFile -Raw) }
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Output = $text }
}

try {
    $nodeExe = Join-Path $NativeRoot 'node\node.exe'
    if (Test-Path -LiteralPath $nodeExe) {
        Write-Host 'Using the no-Docker install.'
        $secrets = @{}
        foreach ($line in Get-Content -LiteralPath (Join-Path $NativeRoot 'secrets.cmd')) {
            if ($line -match '^set\s+([A-Z_]+)=(.*)$') { $secrets[$Matches[1]] = $Matches[2].Trim() }
        }
        $appDir = Join-Path $NativeRoot 'app'
        $env:DATABASE_URL = 'mysql://dental:{0}@127.0.0.1:3306/dental_erp' -f $secrets['DB_PASSWORD']
        $env:PRISMA_QUERY_ENGINE_LIBRARY = Join-Path $appDir 'node_modules\.prisma\client\query_engine-windows.dll.node'
        $env:APP_DIR = $appDir
        $result = Invoke-WithStdin $nodeExe ('"{0}"' -f (Join-Path $tools 'create-clinic.js'))
    }
    elseif (Test-Path -LiteralPath (Join-Path $DockerRoot 'compose.yml')) {
        Write-Host 'Using the Docker install.'
        Push-Location $DockerRoot
        try {
            $copy = Start-Process -FilePath 'docker' -ArgumentList ('compose --env-file .env -f compose.yml cp "{0}\." app:/tmp/clinic-tools' -f $tools) -NoNewWindow -Wait -PassThru
            if ($copy.ExitCode -ne 0) { throw 'Could not copy the tools into the app container. Is the system running?' }
            $result = Invoke-WithStdin 'docker' 'compose --env-file .env -f compose.yml exec -T app node /tmp/clinic-tools/create-clinic.js'
        }
        finally { Pop-Location }
    }
    else {
        throw "No install found. Looked for $NativeRoot and $DockerRoot."
    }
}
finally {
    $env:DATABASE_URL = $null
    $PasswordText = $null
    Remove-Item -LiteralPath $inputFile, $outFile, $errFile -Force -ErrorAction SilentlyContinue
}

if ($result.ExitCode -ne 0) {
    Write-Host $result.Output -ForegroundColor Red
    exit 1
}
Write-Host $result.Output
Write-Host ''
Write-Host 'Clinic and administrator created. Open http://localhost and sign in with the mobile number and the password you chose.' -ForegroundColor Green
