<#
  Set-Modules.ps1 - switch modules on and off on this clinic's computer. Works for both install routes.

  Run in PowerShell as Administrator, in the folder that holds this script:
      Set-ExecutionPolicy -Scope Process Bypass
      .\Set-Modules.ps1                       # shows the list, then lets you switch modules
      .\Set-Modules.ps1 -List                 # only shows the list
      .\Set-Modules.ps1 -Disable lab,braces   # switch these off (and anything that needs them)
      .\Set-Modules.ps1 -Enable lab           # switch these on (and what they need)
      .\Set-Modules.ps1 -Only core,patients,appointments   # exactly these (plus what they need)
      .\Set-Modules.ps1 -All                  # everything on

  The app restarts after a change (about a minute). If the installed app is too old to support
  module control, the script puts the old settings back and tells you.
#>
[CmdletBinding()]
param(
    [string[]]$Enable,
    [string[]]$Disable,
    [string[]]$Only,
    [switch]$All,
    [switch]$List,
    [string]$NativeRoot = 'C:\DentalERP',
    [string]$DockerRoot = (Join-Path $env:ProgramData 'SunnySmile\DentalERP')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Keep in sync with config/saas-modules.json (a test checks this).
$catalogJson = @'
{
  "core": [],
  "patients": ["core"],
  "appointments": ["patients"],
  "clinical": ["patients"],
  "billing": ["patients"],
  "insurance": ["billing"],
  "lab": ["clinical"],
  "braces": ["clinical"],
  "imaging": ["braces"],
  "finance": ["billing"],
  "inventory": ["core"],
  "staff": ["core"],
  "reports": ["core"],
  "crm": ["patients"],
  "communications": ["patients"],
  "forms": ["patients"],
  "portal": ["patients"],
  "video": ["appointments", "clinical"],
  "ai": ["core"],
  "sterilization": ["core"],
  "devices": ["core"],
  "data_import": ["core"]
}
'@
$catalog = [ordered]@{}
foreach ($property in ($catalogJson | ConvertFrom-Json).PSObject.Properties) {
    $catalog[$property.Name] = @($property.Value)
}
$names = @($catalog.Keys)

function Add-WithDependencies([System.Collections.Generic.HashSet[string]]$set, [string]$name) {
    if (-not $set.Add($name)) { return }
    foreach ($dependency in $catalog[$name]) { Add-WithDependencies $set $dependency }
}

function Resolve-Names([string[]]$requested) {
    $result = @()
    foreach ($item in $requested) {
        foreach ($part in ($item -split ',')) {
            $name = $part.Trim().ToLower()
            if (-not $name) { continue }
            if (-not $catalog.Contains($name)) { throw "Unknown module '$name'. Valid names: $($names -join ', ')" }
            $result += $name
        }
    }
    return $result
}

# ---- Where the settings live ---------------------------------------------------
$nodeExe = Join-Path $NativeRoot 'node\node.exe'
if (Test-Path -LiteralPath $nodeExe) { $route = 'native' }
elseif (Test-Path -LiteralPath (Join-Path $DockerRoot 'compose.yml')) { $route = 'docker' }
else { throw "No install found. Looked for $NativeRoot and $DockerRoot." }
Write-Host "Using the $route install."

if ($route -eq 'native') {
    $settingsPath = Join-Path $NativeRoot 'start-dental-erp.cmd'
    $portMatch = [regex]::Match((Get-Content -LiteralPath $settingsPath -Raw), 'set PORT=(\d+)')
    $port = if ($portMatch.Success) { $portMatch.Groups[1].Value } else { '80' }
}
else {
    $settingsPath = Join-Path $DockerRoot '.env'
    $portLine = Select-String -Path $settingsPath -Pattern '^APP_PORT=(\d+)' | Select-Object -First 1
    $port = if ($portLine) { $portLine.Matches[0].Groups[1].Value } else { '80' }
}
$baseUrl = if ($port -eq '80') { 'http://localhost/' } else { "http://localhost:$port/" }
$noBom = New-Object System.Text.UTF8Encoding($false)

function Get-CurrentModules {
    $text = Get-Content -LiteralPath $settingsPath -Raw
    $pattern = if ($route -eq 'native') { '(?m)^set SAAS_MODULES=([^\r\n]*)' } else { '(?m)^SAAS_MODULES=([^\r\n]*)' }
    $modeOn = if ($route -eq 'native') { $text -match '(?m)^set SAAS_ENFORCEMENT=local' } else { $text -match '(?m)^SAAS_ENFORCEMENT=local' }
    $match = [regex]::Match($text, $pattern)
    if (-not $modeOn -or -not $match.Success -or -not $match.Groups[1].Value.Trim() -or $match.Groups[1].Value.Trim().ToLower() -eq 'all') {
        return [pscustomobject]@{ Names = $names; ModeOn = $modeOn }
    }
    return [pscustomobject]@{ Names = @($match.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }); ModeOn = $modeOn }
}

function Show-Modules($enabledNames) {
    Write-Host ''
    foreach ($name in $names) {
        $mark = if ($enabledNames -contains $name) { '[x]' } else { '[ ]' }
        $needs = if ($catalog[$name].Count -gt 0) { '  (needs: ' + ($catalog[$name] -join ', ') + ')' } else { '' }
        Write-Host ("  {0} {1}{2}" -f $mark, $name, $needs)
    }
    Write-Host ''
}

$current = Get-CurrentModules
$enabled = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($name in $current.Names) { [void]$enabled.Add($name) }

if ($List -or (-not $Enable -and -not $Disable -and -not $Only -and -not $All)) {
    Show-Modules $enabled
    if ($List) { exit 0 }
    $answer = Read-Host 'Type the module names to switch on/off (comma separated, e.g. lab,braces), or press Enter to quit'
    if (-not $answer.Trim()) { exit 0 }
    foreach ($name in (Resolve-Names @($answer))) {
        if ($enabled.Contains($name)) { $Disable += $name } else { $Enable += $name }
    }
}

# ---- Work out the new list ------------------------------------------------------
$wanted = New-Object 'System.Collections.Generic.HashSet[string]'
if ($All) { foreach ($name in $names) { [void]$wanted.Add($name) } }
elseif ($Only) {
    [void]$wanted.Add('core')
    foreach ($name in (Resolve-Names $Only)) { Add-WithDependencies $wanted $name }
}
else {
    foreach ($name in $enabled) { [void]$wanted.Add($name) }
    foreach ($name in (Resolve-Names $Enable)) { Add-WithDependencies $wanted $name }
    foreach ($name in (Resolve-Names $Disable)) {
        if ($name -eq 'core') { throw "'core' cannot be switched off." }
        # Switching a module off also switches off everything that needs it.
        $queue = New-Object System.Collections.Generic.Queue[string]
        $queue.Enqueue($name)
        while ($queue.Count -gt 0) {
            $item = $queue.Dequeue()
            if ($wanted.Remove($item)) {
                foreach ($other in $names) { if ($catalog[$other] -contains $item) { $queue.Enqueue($other) } }
            }
        }
    }
}
$final = @($names | Where-Object { $wanted.Contains($_) })
$allOn = ($final.Count -eq $names.Count)
$value = if ($allOn) { 'all' } else { $final -join ',' }

Write-Host 'After this change:'
Show-Modules $wanted
$off = @($names | Where-Object { -not $wanted.Contains($_) })
if ($off.Count -gt 0) { Write-Host ("Switched off: " + ($off -join ', ')) } else { Write-Host 'Everything is on.' }

# ---- Save, restart, and put the old settings back if the app will not start ----------
$backupPath = $settingsPath + '.bak-' + (Get-Date -Format 'yyyyMMddHHmmss')
Copy-Item -LiteralPath $settingsPath -Destination $backupPath

function Wait-Healthy {
    $deadline = (Get-Date).AddMinutes(3)
    Start-Sleep -Seconds 5
    while ((Get-Date) -lt $deadline) {
        try { if ((Invoke-WebRequest -Uri ($baseUrl + 'api/health') -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Restart-App {
    if ($route -eq 'native') {
        Stop-ScheduledTask -TaskName 'DentalERP-App' -ErrorAction SilentlyContinue
        Get-Process -Name 'node' -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-ScheduledTask -TaskName 'DentalERP-App'
    }
    else {
        Push-Location $DockerRoot
        try {
            $up = Start-Process -FilePath 'docker' -ArgumentList 'compose --env-file .env -f compose.yml up -d' -NoNewWindow -Wait -PassThru
            if ($up.ExitCode -ne 0) { throw 'docker compose could not restart the app. Is Docker running?' }
        }
        finally { Pop-Location }
    }
}

function Set-Line([string]$text, [string]$pattern, [string]$line, [string]$after) {
    if ($text -match $pattern) { return ($text -replace $pattern, $line) }
    if ($after -and $text -match $after) { return ($text -replace $after, ('$0' + "`r`n" + $line)) }
    return $text.TrimEnd() + "`r`n" + $line + "`r`n"
}

$text = Get-Content -LiteralPath $settingsPath -Raw
if ($route -eq 'native') {
    if ($text -notmatch '(?m)^set SAAS_ENFORCEMENT=') { throw 'start-dental-erp.cmd has no SAAS_ENFORCEMENT line to change.' }
    $text = [regex]::Replace($text, '(?m)^set SAAS_ENFORCEMENT=[^\r\n]*', 'set SAAS_ENFORCEMENT=local')
    $text = Set-Line $text '(?m)^set SAAS_MODULES=[^\r\n]*' "set SAAS_MODULES=$value" '(?m)^set SAAS_ENFORCEMENT=[^\r\n]*'
    [System.IO.File]::WriteAllText($settingsPath, $text, (New-Object System.Text.ASCIIEncoding))
}
else {
    $text = Set-Line $text '(?m)^SAAS_ENFORCEMENT=[^\r\n]*' 'SAAS_ENFORCEMENT=local' ''
    $text = Set-Line $text '(?m)^SAAS_MODULES=[^\r\n]*' "SAAS_MODULES=$value" '(?m)^SAAS_ENFORCEMENT=[^\r\n]*'
    [System.IO.File]::WriteAllText($settingsPath, $text, $noBom)
    # Make sure the container is given SAAS_MODULES (older compose files do not pass it on).
    $composePath = Join-Path $DockerRoot 'compose.yml'
    $compose = Get-Content -LiteralPath $composePath -Raw
    if ($compose -notmatch 'SAAS_MODULES') {
        Copy-Item -LiteralPath $composePath -Destination ($composePath + '.bak-' + (Get-Date -Format 'yyyyMMddHHmmss'))
        $updated = $compose -replace '(\s+SAAS_ENFORCEMENT:[^\r\n]*)', ('$1' + "`n" + '      SAAS_MODULES: ${SAAS_MODULES:-}')
        if ($updated -eq $compose) { throw 'Could not update compose.yml (the SAAS_ENFORCEMENT line was not found). Nothing was changed except a backup.' }
        [System.IO.File]::WriteAllText($composePath, $updated, $noBom)
    }
}

Write-Host 'Restarting the app (about a minute)...'
Restart-App
if (Wait-Healthy) {
    Write-Host "Done. Modules updated. Press Ctrl+F5 in the browser at $baseUrl" -ForegroundColor Green
    exit 0
}

Write-Warning 'The app did not come back with the new settings. Putting the old settings back...'
Copy-Item -LiteralPath $backupPath -Destination $settingsPath -Force
Restart-App
if (Wait-Healthy) {
    Write-Warning 'Old settings restored and the app is running again. This version of the app probably does not support module control yet; it needs the update that adds it.'
}
else {
    Write-Warning "The app is still not answering. Old settings are in $backupPath. Check C:\DentalERP\app.log (no-Docker) or: docker compose logs --tail=30 app (Docker)."
}
exit 1
