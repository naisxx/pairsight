<#
.SYNOPSIS
PairSight on this Windows machine: install, start, stop, back up, restore,
update and uninstall the Docker stack in deploy/onprem (docs/PairSight-OnPrem.md).

.DESCRIPTION
The installer (pairsight.iss) runs `check` before it copies anything and
`install` after, and its Start menu shortcuts run `start`, `stop` and
`backup`. Everything here also works by hand:

  powershell -ExecutionPolicy Bypass -File pairsight.ps1 <command>

Commands:
  check      Docker Desktop installed and running (on WSL), enough memory and disk,
             the port free. Exits non-zero, with the reason, when not.
  install    Copies the stack's files to the config folder, makes its
             secrets the first time (keeps them after), backs up an
             existing install, then starts it and opens it.
  start      Starts it (if it isn't running) and opens it.
  stop       Stops it. The data stays.
  status     What's running.
  logs       The last lines each part logged (-Follow to keep watching).
  backup     A copy of the database in Documents\PairSight backups.
  restore    Replaces the data with a backup (-File). Backs up first.
  update     Backs up, then downloads and starts the image named in the
             config (a newer installer sets it, then runs `install`, which
             does the same).
  uninstall  Stops and removes it, keeping the data unless -DeleteData.
             Backups are never deleted.
#>
[CmdletBinding()]
param(
	[Parameter(Position = 0, Mandatory = $true)]
	[ValidateSet('check', 'install', 'start', 'stop', 'status', 'logs', 'backup', 'restore', 'update', 'uninstall')]
	[string] $Command,
	# Where compose.yaml, the Caddyfile and the secrets (.env) live.
	[string] $ConfigDir = (Join-Path $env:ProgramData 'PairSight'),
	[string] $BackupDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PairSight backups'),
	# install: the image to run (the installer passes its release's, by digest).
	[string] $Image,
	# install: the port on 127.0.0.1 the app is opened on.
	[int] $Port = 3080,
	# install: who besides Administrators may read the config (it holds secrets).
	[string] $Owner = $env:USERNAME,
	# restore: the backup to restore.
	[string] $File,
	[switch] $DeleteData,
	[switch] $Follow,
	[switch] $NoBrowser,
	# For the Start menu shortcuts, whose window closes when the script ends:
	# keep it open on a failure, so the reason can be read.
	[switch] $PauseOnError,
	# backup: open the backups folder afterwards.
	[switch] $Reveal,
	# For the installer, which runs this hidden and shows its own progress:
	# every step, check passed and failure goes out as one line it reads
	# (::step::, ::ok::, ::error::), and anything else is only logged.
	[switch] $Progress
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectName = 'pairsight-onprem'
$DataVolume = 'pairsight-onprem-db'
$StackDir = Join-Path $PSScriptRoot 'stack'
$EnvFile = Join-Path $ConfigDir '.env'
$MinMemoryGb = 8
$MinDiskGb = 10
$DockerStartSeconds = 180
$StackStartSeconds = 600
$SecretBytes = 32

# Exit codes `check` returns, which the installer turns into its messages.
$Exit = @{ NoDocker = 10; DockerStopped = 11; Memory = 12; Disk = 13; Port = 14; NoWsl = 15; Failed = 1 }

# The installer reads these from standard output, which Write-Host doesn't
# reliably reach when the window is hidden.
function Send([string] $Kind, [string] $Message) { [Console]::Out.WriteLine("::${Kind}::$Message") }

function Say([string] $Message) {
	if ($Progress) { Send 'step' $Message } else { Write-Host $Message }
}

# A check that passed, for the installer's summary before it installs.
function Pass([string] $Message) {
	if ($Progress) { Send 'ok' $Message } else { Write-Host "  $Message" }
}

function Fail([string] $Message, [int] $Code = $Exit.Failed) {
	if ($Progress) { Send 'error' $Message; exit $Code }
	Write-Host ''
	Write-Host $Message -ForegroundColor Red
	if ($PauseOnError) { [void] (Read-Host 'Press Enter to close') }
	exit $Code
}

# Runs a program and stops on a non-zero exit, which PowerShell won't.
# $Failure, when given, is what the person is told instead of the command.
function Invoke-Native([string] $Program, [string[]] $Arguments, [string] $Failure) {
	& $Program @Arguments
	if ($LASTEXITCODE -eq 0) { return }
	$command = "$Program $($Arguments -join ' ') failed (exit $LASTEXITCODE)."
	if ($Failure) { Write-Host $command; Fail $Failure }
	Fail $command
}

function Invoke-Compose([string[]] $Arguments, [string] $Failure) {
	Invoke-Native 'docker' (@('compose', '--project-directory', $ConfigDir, '--file', (Join-Path $ConfigDir 'compose.yaml')) + $Arguments) $Failure
}

# Whether a docker command succeeds, with its output and errors dropped.
# PowerShell 5.1 turns a native command's stderr into a terminating error
# under ErrorActionPreference Stop, even redirected, so it's relaxed here.
function Test-Docker([string[]] $Arguments) {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		& docker @Arguments *> $null
		return $LASTEXITCODE -eq 0
	}
	finally { $ErrorActionPreference = $previous }
}

function Test-DockerRunning { return (Test-Docker @('info', '--format', '{{.OSType}}')) }

# Whether WSL, which Docker Desktop runs on, is set up. Only asked when Docker
# Desktop won't start, to say why.
function Test-Wsl {
	if ($null -eq (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $false }
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		& wsl.exe --status *> $null
		return $LASTEXITCODE -eq 0
	}
	finally { $ErrorActionPreference = $previous }
}

function Get-DockerDesktopPath {
	$path = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
	if (Test-Path $path) { return $path }
	return $null
}

# Docker Desktop installed but not running: start it and wait.
function Start-DockerDesktop {
	if (Test-DockerRunning) { return $true }
	$desktop = Get-DockerDesktopPath
	if ($null -eq $desktop) { return $false }
	Say 'Starting Docker Desktop...'
	Start-Process -FilePath $desktop | Out-Null
	$deadline = (Get-Date).AddSeconds($DockerStartSeconds)
	while ((Get-Date) -lt $deadline) {
		Start-Sleep -Seconds 3
		if (Test-DockerRunning) { return $true }
	}
	return $false
}

function Read-EnvFile {
	$values = [ordered]@{}
	if (Test-Path $EnvFile) {
		foreach ($line in Get-Content $EnvFile) {
			if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
		}
	}
	return $values
}

function Write-EnvFile($Values) {
	$lines = foreach ($key in $Values.Keys) { "$key=$($Values[$key])" }
	# ASCII, no byte-order mark: Compose reads the first key wrong after one.
	[IO.File]::WriteAllLines($EnvFile, [string[]] $lines, (New-Object Text.ASCIIEncoding))
}

function New-RandomBytes {
	$bytes = New-Object byte[] $SecretBytes
	$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
	try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
	return , $bytes
}

# Hex for passwords, so they sit in a database URL with nothing to escape.
function New-HexSecret { return (-join ((New-RandomBytes) | ForEach-Object { $_.ToString('x2') })) }

function Get-Port {
	$values = Read-EnvFile
	if ($values.Contains('PAIRSIGHT_PORT')) { return [int] $values['PAIRSIGHT_PORT'] }
	return $Port
}

function Test-Installed { return (Test-Path $EnvFile) }

function Test-DataVolume { return (Test-Docker @('volume', 'inspect', $DataVolume)) }

function Test-PortInUse([int] $Number) {
	$listening = Get-NetTCPConnection -State Listen -LocalPort $Number -ErrorAction SilentlyContinue
	return $null -ne $listening
}

function Test-OursRunning {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	try {
		$running = & docker ps --quiet --filter "label=com.docker.compose.project=$ProjectName" --filter 'label=com.docker.compose.service=gateway' 2> $null
	}
	finally { $ErrorActionPreference = $previous }
	return -not [string]::IsNullOrWhiteSpace(($running | Out-String))
}

function Open-PairSight {
	$url = "http://localhost:$(Get-Port)"
	Say "PairSight is running at $url"
	if (-not $NoBrowser) { Start-Process $url | Out-Null }
}

# Only Administrators, SYSTEM and the person who installed it can read the
# config folder: .env holds the database passwords and the key the Jev key
# is encrypted with.
function Protect-ConfigDir {
	Invoke-Native 'icacls' @($ConfigDir, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', "${Owner}:(OI)(CI)M", '/Q')
}

function Invoke-Check {
	if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue) -and $null -eq (Get-DockerDesktopPath)) {
		Fail 'Docker Desktop isn''t installed. Install it from https://www.docker.com/products/docker-desktop/ and run this again.' $Exit.NoDocker
	}
	Say 'Checking Docker Desktop...'
	if (-not (Start-DockerDesktop)) {
		if (-not (Test-Wsl)) {
			Fail 'Docker Desktop needs WSL, which isn''t set up. Open PowerShell as administrator, run: wsl --install, restart the machine, then try again.' $Exit.NoWsl
		}
		Fail 'Docker Desktop is installed but isn''t running. Start it, wait until it says it''s running, and try again.' $Exit.DockerStopped
	}
	Pass 'Docker Desktop is running'
	Say 'Checking memory, disk and port...'
	$memoryGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
	if ($memoryGb -lt $MinMemoryGb) {
		Fail "PairSight needs at least $MinMemoryGb GB of memory; this machine has $memoryGb GB." $Exit.Memory
	}
	Pass "$memoryGb GB of memory ($MinMemoryGb GB needed)"
	$drive = Get-PSDrive -Name $env:SystemDrive.TrimEnd(':')
	$freeGb = [math]::Floor($drive.Free / 1GB)
	if ($freeGb -lt $MinDiskGb) {
		Fail "PairSight needs at least $MinDiskGb GB free on $($env:SystemDrive); there's $freeGb GB." $Exit.Disk
	}
	Pass "$freeGb GB free on $($env:SystemDrive) ($MinDiskGb GB needed)"
	$wanted = Get-Port
	if (Test-PortInUse $wanted) {
		if (-not (Test-OursRunning)) {
			Fail "Port $wanted is taken by another program. Close it, or install with -Port and a free one." $Exit.Port
		}
		Pass "PairSight is already running on port $wanted, and will be updated"
	}
	else { Pass "Port $wanted is free" }
}

function Invoke-Backup {
	if (-not (Test-DataVolume)) { Fail 'There''s no PairSight data on this machine to back up.' }
	New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
	$name = "pairsight-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').dump"
	$inside = "/tmp/$name"
	Say "Backing up to $BackupDir\$name..."
	Invoke-Compose @('up', '--detach', '--wait', 'db')
	# Written inside the container and copied out: PowerShell 5.1 would
	# re-encode a binary dump piped through it.
	Invoke-Compose @('exec', '-T', 'db', 'pg_dump', '--username', 'postgres', '--format', 'custom', '--file', $inside, 'pairsight')
	Invoke-Compose @('cp', "db:$inside", (Join-Path $BackupDir $name))
	Invoke-Compose @('exec', '-T', 'db', 'rm', $inside)
	Say 'Backed up.'
	return (Join-Path $BackupDir $name)
}

# Downloads the configured image unless it's already here (pinned by digest,
# a release's image never changes once downloaded).
function Sync-Image {
	$ref = (Read-EnvFile)['PAIRSIGHT_IMAGE']
	if (-not (Test-Docker @('image', 'inspect', $ref))) {
		Say 'Downloading PairSight (the first time takes a few minutes)...'
		Invoke-Compose @('pull', '--quiet') 'PairSight couldn''t be downloaded. Check this machine can reach the internet, then try again.'
	}
}

function Invoke-Up {
	Invoke-Compose @('up', '--detach', '--wait', '--wait-timeout', "$StackStartSeconds") 'PairSight didn''t start. Restart Docker Desktop, then open PairSight from the Start menu.'
}

function Install-Stack {
	if (-not $Image) { Fail 'install needs -Image, the PairSight image to run.' }
	Invoke-Check
	New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
	Protect-ConfigDir

	# Data from an earlier install, but not its secrets: new ones couldn't
	# open that database.
	if (-not (Test-Installed) -and (Test-DataVolume)) {
		Fail "PairSight data from an earlier install is here, but its settings ($EnvFile) are gone, so it can't be opened. Put that file back, or uninstall with -DeleteData to start afresh."
	}
	# An install that's already here is backed up before anything changes.
	if ((Test-Installed) -and (Test-DataVolume)) { [void] (Invoke-Backup) }

	Copy-Item -Path (Join-Path $StackDir '*') -Destination $ConfigDir -Recurse -Force
	$values = Read-EnvFile
	if (-not $values.Contains('POSTGRES_PASSWORD')) {
		Say 'Making this install''s secrets...'
		$values['POSTGRES_PASSWORD'] = New-HexSecret
		$values['APP_DB_PASSWORD'] = New-HexSecret
		$values['AUTH_DB_PASSWORD'] = New-HexSecret
		$values['GOTRUE_JWT_SECRET'] = New-HexSecret
		$values['PAIRSIGHT_SECRET_KEY'] = [Convert]::ToBase64String((New-RandomBytes))
	}
	$values['PAIRSIGHT_IMAGE'] = $Image
	if (-not $values.Contains('PAIRSIGHT_PORT')) { $values['PAIRSIGHT_PORT'] = "$Port" }
	Write-EnvFile $values

	Sync-Image
	Say 'Starting PairSight...'
	Invoke-Up
	Open-PairSight
}

function Restore-Backup {
	if (-not $File -or -not (Test-Path $File)) { Fail 'restore needs -File, the path of a backup made by `backup`.' }
	$source = (Resolve-Path $File).Path
	[void] (Invoke-Backup)
	Say "Restoring $source..."
	Invoke-Compose @('stop', 'app', 'auth')
	Invoke-Compose @('cp', $source, 'db:/tmp/restore.dump')
	Invoke-Compose @('exec', '-T', 'db', 'pg_restore', '--username', 'postgres', '--dbname', 'pairsight', '--clean', '--if-exists', '--single-transaction', '/tmp/restore.dump')
	Invoke-Compose @('exec', '-T', 'db', 'rm', '/tmp/restore.dump')
	Invoke-Up
	Say 'Restored.'
}

function Uninstall-Stack {
	$installed = Test-Path (Join-Path $ConfigDir 'compose.yaml')
	# Its containers restart with Docker, so they're stopped here or not at all.
	if ($installed -and -not (Start-DockerDesktop)) {
		Fail 'Docker Desktop didn''t start, so PairSight couldn''t be stopped. Start Docker Desktop, then uninstall again.' $Exit.DockerStopped
	}
	if ($installed) {
		if ($DeleteData) {
			Say 'Removing PairSight and its data...'
			Invoke-Compose @('down', '--volumes')
		}
		else {
			Say 'Removing PairSight. Its data stays, ready for a reinstall.'
			Invoke-Compose @('down')
		}
	}
	if ($DeleteData) {
		# Also when the config folder is already gone: the data outlives it.
		if ((Test-DockerRunning) -and (Test-DataVolume)) { Invoke-Native 'docker' @('volume', 'rm', $DataVolume) }
		if (Test-Path $ConfigDir) { Remove-Item -Recurse -Force $ConfigDir }
	}
	Say "Backups, if any, are still in $BackupDir."
}

function Assert-Installed {
	if (-not (Test-Installed)) { Fail "PairSight isn't installed here ($ConfigDir has no .env). Run the installer." }
	if (-not (Start-DockerDesktop)) { Fail 'Docker Desktop isn''t running. Start it and try again.' $Exit.DockerStopped }
}

switch ($Command) {
	'check' { Invoke-Check }
	'install' { Install-Stack }
	'start' { Assert-Installed; Invoke-Up; Open-PairSight }
	'stop' { Assert-Installed; Invoke-Compose @('down'); Say 'Stopped. The data stays.' }
	'status' { Assert-Installed; Invoke-Compose @('ps') }
	'logs' { Assert-Installed; Invoke-Compose (@('logs', '--tail', '200') + $(if ($Follow) { @('--follow') } else { @() })) }
	'backup' {
		Assert-Installed
		[void] (Invoke-Backup)
		if ($Reveal) { Start-Process explorer.exe $BackupDir | Out-Null }
	}
	'restore' { Assert-Installed; Restore-Backup }
	'update' { Assert-Installed; [void] (Invoke-Backup); Sync-Image; Invoke-Up; Open-PairSight }
	'uninstall' { Uninstall-Stack }
}
