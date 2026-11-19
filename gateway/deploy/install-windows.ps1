# Installs the FSID gateway as a Windows scheduled task that starts at boot,
# runs as SYSTEM (no user needs to be logged in) and restarts if it crashes.
#
# Run in an elevated PowerShell:
#   powershell -ExecutionPolicy Bypass -File install-windows.ps1 -InstallDir C:\fsid-gateway
#
# InstallDir must contain fsid-gateway.exe and a filled-in gateway.json.
# Remove with:  Unregister-ScheduledTask -TaskName "FSID Gateway" -Confirm:$false

param([string]$InstallDir = "C:\fsid-gateway")

$ErrorActionPreference = "Stop"
$exe = Join-Path $InstallDir "fsid-gateway.exe"
$cfg = Join-Path $InstallDir "gateway.json"
if (-not (Test-Path $exe)) { throw "Not found: $exe" }
if (-not (Test-Path $cfg)) { throw "Not found: $cfg (copy gateway.example.json and fill it in)" }

# gateway.json holds the API key and OPC UA password: only SYSTEM and Administrators may read it.
icacls $cfg /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(F)" | Out-Null

$action    = New-ScheduledTaskAction -Execute $exe -Argument "-config `"$cfg`"" -WorkingDirectory $InstallDir
$trigger   = New-ScheduledTaskTrigger -AtStartup
$settings  = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
               -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "FSID Gateway" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "FSID Gateway"
Write-Host "FSID Gateway installed and started. Log: $(Join-Path $InstallDir 'gateway.log')"
