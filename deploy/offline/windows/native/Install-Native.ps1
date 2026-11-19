<#
  Install-Native.ps1 - installs the Dental ERP on one Windows PC WITHOUT Docker or WSL.

  Run from PowerShell as Administrator, in the folder that holds this script:
      Set-ExecutionPolicy -Scope Process Bypass
      .\Install-Native.ps1

  It installs Node.js, MySQL (as a Windows service), the app, creates the tables,
  and registers start-up so the system runs after every restart. Safe to re-run.
  Lifetime install: no license, no backup. Everything goes to C:\DentalERP.
#>
[CmdletBinding()]
param(
    [string]$InstallRoot = 'C:\DentalERP',
    [ValidateRange(1, 65535)][int]$Port = 80
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$kit = $PSScriptRoot

function Write-Step($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }

function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$File,
        [string]$Arguments = '',
        [string]$StdIn,
        [string]$LogFile
    )
    $out = if ($LogFile) { $LogFile } else { Join-Path $env:TEMP ('dental-native-' + [guid]::NewGuid().ToString('N') + '.out') }
    $err = $out + '.err'
    $parameters = @{
        FilePath               = $File
        Wait                   = $true
        PassThru               = $true
        NoNewWindow            = $true
        RedirectStandardOutput = $out
        RedirectStandardError  = $err
    }
    if ($Arguments) { $parameters.ArgumentList = $Arguments }
    if ($StdIn) { $parameters.RedirectStandardInput = $StdIn }
    $process = Start-Process @parameters
    $text = ''
    if (Test-Path -LiteralPath $out) { $text += (Get-Content -LiteralPath $out -Raw -ErrorAction SilentlyContinue) }
    if (Test-Path -LiteralPath $err) { $text += (Get-Content -LiteralPath $err -Raw -ErrorAction SilentlyContinue) }
    if (-not $LogFile) { Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue }
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Output = $text }
}

function Wait-Port {
    param([string]$Address = '127.0.0.1', [int]$PortNumber, [int]$Seconds = 120)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect($Address, $PortNumber)
            $client.Close()
            return $true
        }
        catch { Start-Sleep -Seconds 2 }
        finally { $client.Dispose() }
    }
    return $false
}

function New-Secret($bytes) {
    $buffer = New-Object byte[] $bytes
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($buffer)
    $generator.Dispose()
    return (($buffer | ForEach-Object { $_.ToString('x2') }) -join '')
}

# ---- 0. Checks ---------------------------------------------------------------
Write-Step 'Checking this computer'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this from PowerShell as Administrator.'
}
if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'This needs 64-bit Windows.'
}
$required = @(
    'app.zip',
    'node-v22.23.5-win-x64.zip',
    'mysql-8.4.13-winx64.zip',
    'vc_redist.x64.exe',
    'start-dental-erp.cmd',
    'my.ini',
    'starting.html',
    'Clinic System.url'
)
foreach ($name in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $kit $name))) { throw "Missing file next to this script: $name" }
}
if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
    throw 'tar.exe was not found. This needs Windows 10 (version 1803 or later) or Windows 11.'
}
$memoryGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Write-Host "Memory: $memoryGb GB. Install folder: $InstallRoot. Web port: $Port."
$drive = Get-PSDrive -Name ($InstallRoot.Substring(0, 1)) -ErrorAction SilentlyContinue
if ($drive -and $drive.Free -lt 4GB) { throw 'Less than 4 GB free on the install drive.' }

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
$nodeExe = Join-Path $InstallRoot 'node\node.exe'
$mysqlBin = Join-Path $InstallRoot 'mysql\bin'
$dataDir = Join-Path $InstallRoot 'mysql-data'
$appDir = Join-Path $InstallRoot 'app'
$secretsPath = Join-Path $InstallRoot 'secrets.cmd'

# ---- 1. Visual C++ runtime ---------------------------------------------------
Write-Step 'Visual C++ runtime (needed by MySQL)'
$vcKey = 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'
$vcInstalled = $false
if (Test-Path $vcKey) {
    $vcProperties = Get-ItemProperty $vcKey
    if ($vcProperties.PSObject.Properties['Installed'] -and $vcProperties.Installed -eq 1) { $vcInstalled = $true }
}
if ($vcInstalled) {
    Write-Host 'Already installed.'
}
else {
    $result = Invoke-Native -File (Join-Path $kit 'vc_redist.x64.exe') -Arguments '/install /quiet /norestart'
    if ($result.ExitCode -notin 0, 1638, 3010) { throw "The Visual C++ runtime did not install (exit code $($result.ExitCode))." }
    Write-Host "Installed (exit code $($result.ExitCode))."
}

# ---- 2. Unpack Node, MySQL, app ----------------------------------------------
Write-Step 'Unpacking Node.js, MySQL and the app'
if (-not (Test-Path -LiteralPath $nodeExe)) {
    $result = Invoke-Native -File 'tar.exe' -Arguments ('-xf "{0}" -C "{1}"' -f (Join-Path $kit 'node-v22.23.5-win-x64.zip'), $InstallRoot)
    if ($result.ExitCode -ne 0) { throw "Could not unpack Node.js: $($result.Output)" }
    if (Test-Path (Join-Path $InstallRoot 'node')) { Remove-Item (Join-Path $InstallRoot 'node') -Recurse -Force }
    Rename-Item (Join-Path $InstallRoot 'node-v22.23.5-win-x64') 'node'
}
Write-Host 'Node.js ready.'
if (-not (Test-Path -LiteralPath (Join-Path $mysqlBin 'mysqld.exe'))) {
    $result = Invoke-Native -File 'tar.exe' -Arguments ('-xf "{0}" -C "{1}"' -f (Join-Path $kit 'mysql-8.4.13-winx64.zip'), $InstallRoot)
    if ($result.ExitCode -ne 0) { throw "Could not unpack MySQL: $($result.Output)" }
    if (Test-Path (Join-Path $InstallRoot 'mysql')) { Remove-Item (Join-Path $InstallRoot 'mysql') -Recurse -Force }
    Rename-Item (Join-Path $InstallRoot 'mysql-8.4.13-winx64') 'mysql'
}
Write-Host 'MySQL ready.'
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'server.js'))) {
    New-Item -ItemType Directory -Path $appDir -Force | Out-Null
    Write-Host 'Unpacking the app (a few minutes on an old computer)...'
    $result = Invoke-Native -File 'tar.exe' -Arguments ('-xf "{0}" -C "{1}"' -f (Join-Path $kit 'app.zip'), $appDir)
    if ($result.ExitCode -ne 0) { throw "Could not unpack the app: $($result.Output)" }
}
Write-Host 'App ready.'

# Config files (the start script keeps the chosen port).
Copy-Item -LiteralPath (Join-Path $kit 'my.ini') -Destination (Join-Path $InstallRoot 'my.ini') -Force
$startScript = (Get-Content -LiteralPath (Join-Path $kit 'start-dental-erp.cmd') -Raw) -replace 'set PORT=\d+', "set PORT=$Port"
[System.IO.File]::WriteAllText((Join-Path $InstallRoot 'start-dental-erp.cmd'), $startScript, (New-Object System.Text.ASCIIEncoding))
$targetUrl = if ($Port -eq 80) { 'http://localhost/' } else { "http://localhost:$Port/" }
$startPage = (Get-Content -LiteralPath (Join-Path $kit 'starting.html') -Raw) -replace "var target = '[^']*';", "var target = '$targetUrl';"
[System.IO.File]::WriteAllText((Join-Path $InstallRoot 'starting.html'), $startPage, (New-Object System.Text.UTF8Encoding($false)))

# ---- 3. Secrets --------------------------------------------------------------
Write-Step 'Passwords'
if (-not (Test-Path -LiteralPath $secretsPath)) {
    $dbPassword = New-Secret 16
    $rootPassword = New-Secret 16
    $authSecret = New-Secret 32
    $lines = @("set DB_PASSWORD=$dbPassword", "set ROOT_PASSWORD=$rootPassword", "set AUTH_SECRET=$authSecret")
    [System.IO.File]::WriteAllLines($secretsPath, $lines, (New-Object System.Text.ASCIIEncoding))
    & icacls.exe $secretsPath /inheritance:r /grant 'SYSTEM:F' 'Administrators:F' | Out-Null
    Write-Host 'Created new passwords (stored in secrets.cmd, readable by administrators only).'
}
else {
    Write-Host 'Using the existing passwords.'
}
$secrets = @{}
foreach ($line in Get-Content -LiteralPath $secretsPath) {
    if ($line -match '^set\s+([A-Z_]+)=(.*)$') { $secrets[$Matches[1]] = $Matches[2].Trim() }
}
foreach ($key in 'DB_PASSWORD', 'ROOT_PASSWORD', 'AUTH_SECRET') {
    if (-not $secrets.ContainsKey($key) -or -not $secrets[$key]) { throw "secrets.cmd is missing $key." }
}

# ---- 4. MySQL ----------------------------------------------------------------
Write-Step 'MySQL database'
$defaults = Join-Path $InstallRoot 'my.ini'
$service = Get-Service -Name 'DentalMySQL' -ErrorAction SilentlyContinue
if (-not $service) {
    if ((Test-Path -LiteralPath $dataDir) -and (Get-ChildItem -LiteralPath $dataDir -Force | Select-Object -First 1)) {
        throw "The folder $dataDir already has files but the DentalMySQL service is missing. If this is a failed first attempt with no real data, delete that folder and run this again."
    }
    $result = Invoke-Native -File (Join-Path $mysqlBin 'mysqld.exe') -Arguments ('--defaults-file="{0}" --initialize-insecure --console' -f $defaults)
    if ($result.ExitCode -ne 0) { throw "MySQL could not initialise its data folder: $($result.Output)" }
    $result = Invoke-Native -File (Join-Path $mysqlBin 'mysqld.exe') -Arguments ('--install DentalMySQL --defaults-file="{0}"' -f $defaults)
    if ($result.ExitCode -ne 0) { throw "MySQL service could not be installed: $($result.Output)" }
    Set-Service -Name 'DentalMySQL' -StartupType Automatic
}
Set-Service -Name 'DentalMySQL' -StartupType Automatic
if ((Get-Service -Name 'DentalMySQL').Status -ne 'Running') { Start-Service -Name 'DentalMySQL' }
if (-not (Wait-Port -PortNumber 3306 -Seconds 120)) {
    throw "MySQL did not start. Read the newest .err file in $dataDir."
}

$mysqlExe = Join-Path $mysqlBin 'mysql.exe'
$sqlFile = Join-Path $InstallRoot 'setup.sql'
$db = $secrets['DB_PASSWORD']
$root = $secrets['ROOT_PASSWORD']
$sql = @(
    'CREATE DATABASE IF NOT EXISTS dental_erp CHARACTER SET utf8mb4;',
    "CREATE USER IF NOT EXISTS 'dental'@'localhost' IDENTIFIED BY '$db';",
    "CREATE USER IF NOT EXISTS 'dental'@'127.0.0.1' IDENTIFIED BY '$db';",
    "ALTER USER 'dental'@'localhost' IDENTIFIED BY '$db';",
    "ALTER USER 'dental'@'127.0.0.1' IDENTIFIED BY '$db';",
    "GRANT ALL ON dental_erp.* TO 'dental'@'localhost';",
    "GRANT ALL ON dental_erp.* TO 'dental'@'127.0.0.1';",
    "ALTER USER 'root'@'localhost' IDENTIFIED BY '$root';"
)
[System.IO.File]::WriteAllLines($sqlFile, $sql, (New-Object System.Text.ASCIIEncoding))
try {
    # First run: root has no password yet. Later runs: root already has the generated password.
    $env:MYSQL_PWD = $null
    $result = Invoke-Native -File $mysqlExe -Arguments '--user=root --protocol=TCP' -StdIn $sqlFile
    if ($result.ExitCode -ne 0) {
        $env:MYSQL_PWD = $root
        $result = Invoke-Native -File $mysqlExe -Arguments '--user=root --protocol=TCP' -StdIn $sqlFile
    }
    if ($result.ExitCode -ne 0) { throw "Could not create the database and user: $($result.Output)" }
}
finally {
    $env:MYSQL_PWD = $null
    Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
}
Write-Host 'Database and user ready.'

# ---- 5. Tables (migrations) --------------------------------------------------
Write-Step 'Creating the tables'
$env:DATABASE_URL = "mysql://dental:$db@127.0.0.1:3306/dental_erp"
$env:PRISMA_QUERY_ENGINE_LIBRARY = Join-Path $appDir 'node_modules\.prisma\client\query_engine-windows.dll.node'
$env:PRISMA_SCHEMA_ENGINE_BINARY = Join-Path $appDir 'node_modules\@prisma\engines\schema-engine-windows.exe'
Push-Location $appDir
try {
    $migrateLog = Join-Path $InstallRoot 'migrate.log'
    $result = Invoke-Native -File $nodeExe -Arguments 'node_modules\prisma\build\index.js migrate deploy' -LogFile $migrateLog
    if ($result.ExitCode -ne 0) { throw "Creating the tables failed. See $migrateLog.`n$($result.Output)" }
    Write-Host 'Tables ready.'
}
finally {
    Pop-Location
    $env:DATABASE_URL = $null
}

# ---- 6. Start-up -------------------------------------------------------------
Write-Step 'Start-up'
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "{0}"' -f (Join-Path $InstallRoot 'start-dental-erp.cmd'))
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'DentalERP-App' -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Force | Out-Null

$startup = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\StartUp'
$shortcut = '[InternetShortcut]' + "`r`n" + 'URL=file:///' + (Join-Path $InstallRoot 'starting.html').Replace('\', '/') + "`r`n"
[System.IO.File]::WriteAllText((Join-Path $startup 'Clinic System.url'), $shortcut, (New-Object System.Text.ASCIIEncoding))
Write-Host 'The system will start with Windows, and a page opens at every sign-in.'

Write-Step 'Starting the app now'
$existing = Get-ScheduledTask -TaskName 'DentalERP-App'
if ($existing.State -ne 'Running') { Start-ScheduledTask -TaskName 'DentalERP-App' }

$healthy = $false
$deadline = (Get-Date).AddMinutes(4)
while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -Uri ($targetUrl + 'api/health') -UseBasicParsing -TimeoutSec 4
        if ($response.StatusCode -eq 200) { $healthy = $true; break }
    }
    catch { }
    Start-Sleep -Seconds 3
}

if ($healthy) {
    Write-Host ""
    Write-Host "Dental ERP is ready: $targetUrl" -ForegroundColor Green
    Write-Host 'Open it, create the administrator and the clinic, and add the users.'
    Start-Process $targetUrl
}
else {
    Write-Warning "The app did not answer within 4 minutes. Read $InstallRoot\app.log, and check: Get-Service DentalMySQL ; schtasks /query /tn DentalERP-App"
    exit 1
}
