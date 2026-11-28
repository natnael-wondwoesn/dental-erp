<#
  Set-SiteConfig.ps1 - puts the clinic's own name, phone, email, hours and map on the
  app's public pages (instead of the default clinic's). Works for both install routes.

  Run in PowerShell as Administrator, from the folder that holds this script:
      Set-ExecutionPolicy -Scope Process Bypass
      .\Set-SiteConfig.ps1 -ClinicName "Selina Speciality Dental Clinic"
  It asks for anything you leave out. Safe to run again to change the details.
  Note: the browser tab title is built into the app and does not change.
#>
[CmdletBinding()]
param(
    [string]$ClinicName,
    [string]$Phone,
    [string]$Email,
    [string]$Open,
    [string]$Close,
    [string]$Days = 'Monday - Saturday',
    [string]$City = 'Addis Ababa',
    [string]$SubCity = 'Addis Ababa',
    [string]$MapLat = '',
    [string]$MapLng = '',
    [string]$NativeRoot = 'C:\DentalERP',
    [string]$DockerRoot = (Join-Path $env:ProgramData 'SunnySmile\DentalERP')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-Required($label, $current) {
    while (-not $current) { $current = (Read-Host $label).Trim() }
    return $current
}

$ClinicName = Read-Required 'Clinic name' $ClinicName
if ($ClinicName -notmatch '^[A-Za-z0-9 .,&()-]{2,80}$') {
    throw 'Use only letters, numbers, spaces and . , & ( ) - in the clinic name (no quotes or apostrophes).'
}
$oldBrand = 'D/R Abiy Special Dental Clinic'
$Phone = Read-Required 'Clinic phone (for example 0911234567)' $Phone
$Email = Read-Required 'Clinic email' $Email
$Open = Read-Required 'Opening time (for example 08:30)' $Open
$Close = Read-Required 'Closing time (for example 18:00)' $Close

$compact = ($Phone -replace '[\s()-]', '')
if ($compact.StartsWith('00251')) { $compact = '+' + $compact.Substring(2) }
elseif ($compact.StartsWith('0')) { $compact = '+251' + $compact.Substring(1) }
elseif ($compact.StartsWith('251')) { $compact = '+' + $compact }
elseif ($compact -match '^9\d{8}$') { $compact = '+251' + $compact }
if ($compact -notmatch '^\+251\d{9}$') { throw "The phone number '$Phone' is not a valid Ethiopian number (for example 0911234567)." }
if ($Email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw "The email '$Email' is not valid." }
if ($Open -notmatch '^\d{2}:\d{2}$' -or $Close -notmatch '^\d{2}:\d{2}$') { throw 'Times must look like 08:30 and 18:00.' }

if ($MapLat -and $MapLng) { $mapQuery = "$MapLat,$MapLng" }
else { $mapQuery = [uri]::EscapeDataString("$ClinicName $City") }
$mapUrl = "https://www.google.com/maps?q=$mapQuery&output=embed"

function Get-Json($text) { return ($text | ConvertTo-Json -Compress) }
$name = Get-Json $ClinicName
$tagline = Get-Json "Speciality dental care in $City"
$story = Get-Json "$ClinicName provides speciality dental care in $City."
$json = @"
{
  "clinic": { "name": { "en": $name, "am": "" }, "tagline": { "en": $tagline, "am": "" } },
  "location": { "region": $(Get-Json $City), "city": $(Get-Json $City), "subCity": $(Get-Json $SubCity), "mapEmbedUrl": $(Get-Json $mapUrl) },
  "contact": { "phones": [$(Get-Json $compact)], "email": $(Get-Json $Email) },
  "hours": [ { "day": { "en": $(Get-Json $Days), "am": "" }, "open": "$Open", "close": "$Close" } ],
  "services": [ { "title": { "en": "Dental Care", "am": "" }, "copy": { "en": "Speciality dental care for the whole family.", "am": "" } } ],
  "doctors": [],
  "about": { "story": { "en": $story, "am": "" }, "metrics": [] }
}
"@
$noBom = New-Object System.Text.UTF8Encoding($false)

function Wait-Healthy($url) {
    $deadline = (Get-Date).AddMinutes(4)
    while ((Get-Date) -lt $deadline) {
        try { if ((Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

$nodeExe = Join-Path $NativeRoot 'node\node.exe'
if (Test-Path -LiteralPath $nodeExe) {
    Write-Host 'Using the no-Docker install.'
    $sitePath = Join-Path $NativeRoot 'site.json'
    [System.IO.File]::WriteAllText($sitePath, $json, $noBom)
    $cmdPath = Join-Path $NativeRoot 'start-dental-erp.cmd'
    $cmd = Get-Content -LiteralPath $cmdPath -Raw
    if ($cmd -notmatch 'SITE_CONFIG_PATH') {
        $cmd = $cmd -replace '(set SITE_ID=[^\r\n]*)', ('$1' + "`r`n" + "set SITE_CONFIG_PATH=$sitePath")
        [System.IO.File]::WriteAllText($cmdPath, $cmd, (New-Object System.Text.ASCIIEncoding))
    }
    # The page title and link-preview text are built into the app; replace the default clinic's name.
    $patched = 0
    $serverDir = Join-Path $NativeRoot 'app\.next\server'
    if (Test-Path -LiteralPath $serverDir) {
        Get-ChildItem -LiteralPath $serverDir -Recurse -File -Include '*.js', '*.html', '*.rsc', '*.json', '*.body', '*.meta' | ForEach-Object {
            $text = [System.IO.File]::ReadAllText($_.FullName)
            if ($text.Contains($oldBrand)) {
                [System.IO.File]::WriteAllText($_.FullName, $text.Replace($oldBrand, $ClinicName), $noBom)
                $patched++
            }
        }
    }
    Write-Host "Updated the page title in $patched file(s)."
    Stop-ScheduledTask -TaskName 'DentalERP-App' -ErrorAction SilentlyContinue
    Get-Process -Name 'node' -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-ScheduledTask -TaskName 'DentalERP-App'
    $portMatch = [regex]::Match($cmd, 'set PORT=(\d+)')
    $port = if ($portMatch.Success) { $portMatch.Groups[1].Value } else { '80' }
    $url = if ($port -eq '80') { 'http://localhost/' } else { "http://localhost:$port/" }
}
elseif (Test-Path -LiteralPath (Join-Path $DockerRoot 'compose.yml')) {
    Write-Host 'Using the Docker install.'
    $sitePath = Join-Path $DockerRoot 'site.json'
    [System.IO.File]::WriteAllText($sitePath, $json, $noBom)
    $composePath = Join-Path $DockerRoot 'compose.yml'
    $compose = Get-Content -LiteralPath $composePath -Raw
    if ($compose -notmatch 'SITE_CONFIG_PATH') {
        Copy-Item -LiteralPath $composePath -Destination ($composePath + '.bak-' + (Get-Date -Format 'yyyyMMddHHmmss'))
        $before = $compose
        $compose = $compose -replace '(\s+SITE_ID:[^\r\n]*)', ('$1' + "`n" + '      SITE_CONFIG_PATH: /app/site.json')
        $compose = $compose -replace '(\s+- uploads:/app/uploads)', ('$1' + "`n" + '      - ./site.json:/app/site.json:ro')
        if ($compose -eq $before -or $compose -notmatch 'SITE_CONFIG_PATH' -or $compose -notmatch 'site\.json:/app/site\.json') {
            throw 'Could not update compose.yml (the lines to change were not found). Nothing was changed except site.json.'
        }
        [System.IO.File]::WriteAllText($composePath, $compose, $noBom)
    }
    Push-Location $DockerRoot
    try {
        $up = Start-Process -FilePath 'docker' -ArgumentList 'compose --env-file .env -f compose.yml up -d' -NoNewWindow -Wait -PassThru
        if ($up.ExitCode -ne 0) { throw 'docker compose could not restart the app. Is Docker running?' }
    }
    finally { Pop-Location }
    # The page title and link-preview text are built into the app image; replace the default clinic's name
    # inside the running container (kept until the container is recreated; run this script again after an update).
    $patchScript = Join-Path $DockerRoot 'brand-patch.sh'
    $shell = "#!/bin/sh`n" + 'set -e' + "`n" + 'esc=$(printf ''%s'' "$CLINIC_NAME" | sed -e ''s/[\\&|]/\\&/g'')' + "`n" + 'grep -rl ''D/R Abiy Special Dental Clinic'' /app/.next/server | xargs -r sed -i "s|D/R Abiy Special Dental Clinic|$esc|g"' + "`n" + 'echo patched' + "`n"
    [System.IO.File]::WriteAllText($patchScript, $shell, $noBom)
    Push-Location $DockerRoot
    try {
        $copy = Start-Process -FilePath 'docker' -ArgumentList 'compose --env-file .env -f compose.yml cp brand-patch.sh app:/tmp/brand-patch.sh' -NoNewWindow -Wait -PassThru
        if ($copy.ExitCode -ne 0) { throw 'Could not copy the title patch into the app container.' }
        $run = Start-Process -FilePath 'docker' -ArgumentList ('compose --env-file .env -f compose.yml exec -T -u root -e "CLINIC_NAME={0}" app sh /tmp/brand-patch.sh' -f $ClinicName) -NoNewWindow -Wait -PassThru
        if ($run.ExitCode -ne 0) { throw 'The page-title patch failed inside the app container.' }
        $restart = Start-Process -FilePath 'docker' -ArgumentList 'compose --env-file .env -f compose.yml restart app' -NoNewWindow -Wait -PassThru
        if ($restart.ExitCode -ne 0) { throw 'Could not restart the app after the title patch.' }
    }
    finally { Pop-Location }
    $portLine = Select-String -Path (Join-Path $DockerRoot '.env') -Pattern '^APP_PORT=(\d+)' | Select-Object -First 1
    $port = if ($portLine) { $portLine.Matches[0].Groups[1].Value } else { '80' }
    $url = if ($port -eq '80') { 'http://localhost/' } else { "http://localhost:$port/" }
}
else {
    throw "No install found. Looked for $NativeRoot and $DockerRoot."
}

Write-Host "Restarting the app (about a minute)..."
if (Wait-Healthy ($url + 'api/health')) {
    Write-Host "Done. Press Ctrl+F5 in the browser at $url" -ForegroundColor Green
    exit 0
}
Write-Warning 'The app did not answer in 4 minutes. If the content was rejected, the log lists the field: C:\DentalERP\app.log (no-Docker) or: docker compose logs --tail=30 app (Docker).'
exit 1
