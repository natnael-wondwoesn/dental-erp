<#
  Update-App.ps1 - loads a newer app image from a .tar file and switches the Docker install to it.
  Keeps all data. Puts the old settings back if the new app does not start.

  Run in PowerShell as Administrator:
      Set-ExecutionPolicy -Scope Process Bypass
      .\Update-App.ps1 -Tar .\dental-erp-local-modules.tar
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Tar,
    [string]$Image = 'ghcr.io/natnael-wondwoesn/dental-erp:0.1.57-local-modules',
    [string]$DockerRoot = (Join-Path $env:ProgramData 'SunnySmile\DentalERP')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$noBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath $Tar)) { throw "File not found: $Tar" }
$envPath = Join-Path $DockerRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw "No Docker install found at $DockerRoot." }

function Invoke-Docker([string]$arguments) {
    $p = Start-Process -FilePath 'docker' -ArgumentList $arguments -NoNewWindow -Wait -PassThru
    return $p.ExitCode
}

Write-Host 'Loading the new app image (a minute or two)...'
if ((Invoke-Docker ('load --input "{0}"' -f (Resolve-Path -LiteralPath $Tar))) -ne 0) { throw 'Docker could not load the image. Is Docker running?' }

$backup = $envPath + '.bak-' + (Get-Date -Format 'yyyyMMddHHmmss')
Copy-Item -LiteralPath $envPath -Destination $backup
$text = Get-Content -LiteralPath $envPath -Raw
if ($text -notmatch '(?m)^DENTAL_ERP_IMAGE=') { throw '.env has no DENTAL_ERP_IMAGE line.' }
$text = $text -replace '(?m)^DENTAL_ERP_IMAGE=[^\r\n]*', "DENTAL_ERP_IMAGE=$Image"
[System.IO.File]::WriteAllText($envPath, $text, $noBom)

$portLine = Select-String -Path $envPath -Pattern '^APP_PORT=(\d+)' | Select-Object -First 1
$port = if ($portLine) { $portLine.Matches[0].Groups[1].Value } else { '80' }
$url = if ($port -eq '80') { 'http://localhost/' } else { "http://localhost:$port/" }

function Restart-Stack {
    Push-Location $DockerRoot
    try { return (Invoke-Docker 'compose --env-file .env -f compose.yml up -d') }
    finally { Pop-Location }
}
function Wait-Healthy {
    $deadline = (Get-Date).AddMinutes(4)
    Start-Sleep -Seconds 5
    while ((Get-Date) -lt $deadline) {
        try { if ((Invoke-WebRequest -Uri ($url + 'api/health') -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

Write-Host 'Switching to the new app...'
$code = Restart-Stack
if ($code -eq 0 -and (Wait-Healthy)) {
    Write-Host 'Done. The app is updated and running. Next: .\Set-Modules.ps1' -ForegroundColor Green
    exit 0
}
Write-Warning 'The new app did not start. Putting the old one back...'
Copy-Item -LiteralPath $backup -Destination $envPath -Force
[void](Restart-Stack)
if (Wait-Healthy) { Write-Warning 'The old app is running again. Nothing was lost.' } else { Write-Warning "Still not answering. The old settings are in $backup." }
exit 1
