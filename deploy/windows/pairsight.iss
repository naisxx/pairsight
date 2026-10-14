; PairSight's Windows installer (Inno Setup 6.7+), docs/PairSight-OnPrem.md.
;
; A thin wrapper: pairsight.ps1 does the work, run hidden with -Progress so
; its steps show here instead of in a console window. Setup welcomes, asks
; about a desktop shortcut, checks the machine (`check`) and lists what it
; found, then copies the script and the stack's files to Program Files and
; runs `install` (config and secrets in %ProgramData%\PairSight, then the
; Docker stack). Uninstall stops it, asking whether to keep the data.
;
; Themed to the app: it follows Windows' light or dark setting, on the app's
; background colours, with art rendered from its tokens (art/render.mjs).
;
; Built by .github/workflows/onprem-release.yml, which passes the release:
;   iscc /DAppVersion=1.2.3 /DImageRef=ghcr.io/8xplays/pairsight-onprem@sha256:... pairsight.iss

#ifndef AppVersion
  #define AppVersion "0.0.0-dev"
#endif
#ifndef ImageRef
  #define ImageRef "ghcr.io/8xplays/pairsight-onprem:latest"
#endif
#define AppPort "3080"

[Setup]
AppId={{6C1F2D2E-8E2B-4B7A-9C55-2E0F5B7D9A31}
AppName=PairSight
AppVersion={#AppVersion}
AppVerName=PairSight {#AppVersion}
AppPublisher=8x
DefaultDirName={autopf}\PairSight
DefaultGroupName=PairSight
; Where it goes isn't a choice worth asking: the data lives in Docker.
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Windows 10 2004 or later: the first with WSL 2, which Docker Desktop runs on.
MinVersion=10.0.19041
OutputDir=Output
OutputBaseFilename=PairSight-Setup-{#AppVersion}
SetupIconFile=pairsight.ico
UninstallDisplayIcon={app}\pairsight.ico
UninstallDisplayName=PairSight
Compression=lzma2
SolidCompression=yes
; The look, in Setup and Uninstall: Windows 11 controls, light or dark as
; Windows is, on the app's --bg (src/app/globals.css), no divider lines.
WizardStyle=modern dynamic windows11 hidebevels
WizardBackColor=#f7f6f3
WizardBackColorDynamicDark=#0d0d0e
WizardImageBackColor=#f7f6f3
WizardImageBackColorDynamicDark=#0d0d0e
WizardSmallImageBackColor=#f7f6f3
WizardSmallImageBackColorDynamicDark=#0d0d0e
; Setup picks the size closest to the screen's scaling.
WizardImageFile=art\wizard-light-*.png
WizardImageFileDynamicDark=art\wizard-dark-*.png
WizardSmallImageFile=art\mark-light-*.png
WizardSmallImageFileDynamicDark=art\mark-dark-*.png
; Signed in a release with a certificate (/DSign plus /Spairsight=...), setup
; and the uninstaller both, so Windows SmartScreen doesn't block them.
#ifdef Sign
SignTool=pairsight
SignedUninstaller=yes
#endif

[Messages]
SetupWindowTitle=Set up %1
UninstallAppTitle=Uninstall PairSight
UninstallAppFullTitle=Uninstall %1
ClickNext=Click Next to start.
ExitSetupTitle=Stop setting up?
ExitSetupMessage=PairSight isn’t installed yet. You can run this setup again any time.%n%nStop now?
WelcomeLabel1=Set up PairSight
WelcomeLabel2=PairSight runs here, in Docker Desktop, so your records, accounts and results stay on this machine.%n%nSetup checks the machine, then starts PairSight. The first time takes a few minutes while it downloads.
WizardSelectTasks=Shortcuts
SelectTasksDesc=Where you’d like to open PairSight from.
SelectTasksLabel2=PairSight goes in the Start menu. It can go on the desktop too.
WizardReady=Ready to install
ReadyLabel1=This machine is ready for PairSight.
ReadyLabel2a=Click Install to start it.
ReadyLabel2b=Click Install to start it.
ReadyMemoTasks=Shortcuts:
WizardPreparing=Checking this machine
PreparingDesc=Setup checks this machine can run PairSight.
WizardInstalling=Installing
InstallingLabel=Setting up PairSight. The first time, downloading it takes a few minutes.
StatusRunProgram=Starting PairSight...
FinishedHeadingLabel=PairSight is ready
FinishedLabelNoIcons=PairSight is running on this machine.
FinishedLabel=PairSight is running on this machine. Open it any time from the Start menu: PairSight.
ClickFinish=
ConfirmUninstall=Remove %1 from this machine?%n%nNext you choose whether to keep its data.
WizardUninstalling=Uninstalling
UninstallStatusLabel=Removing %1 from this machine.
UninstalledAll=%1 is removed from this machine.

[Tasks]
Name: "desktopicon"; Description: "A PairSight icon on the desktop"; Flags: unchecked

[Files]
Source: "pairsight.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "pairsight.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\onprem\compose.yaml"; DestDir: "{app}\stack"; Flags: ignoreversion
Source: "..\onprem\Caddyfile"; DestDir: "{app}\stack"; Flags: ignoreversion
Source: "..\onprem\initdb\01-roles.sh"; DestDir: "{app}\stack\initdb"; Flags: ignoreversion

[Icons]
Name: "{group}\Open PairSight"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\pairsight.ps1"" start -PauseOnError"; \
  IconFilename: "{app}\pairsight.ico"
Name: "{group}\Stop PairSight"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\pairsight.ps1"" stop -PauseOnError"; \
  IconFilename: "{app}\pairsight.ico"
Name: "{group}\Back up PairSight"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\pairsight.ps1"" backup -Reveal -PauseOnError"; \
  IconFilename: "{app}\pairsight.ico"
Name: "{group}\Uninstall PairSight"; Filename: "{uninstallexe}"
Name: "{autodesktop}\PairSight"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\pairsight.ps1"" start -PauseOnError"; \
  IconFilename: "{app}\pairsight.ico"; Tasks: desktopicon

[Run]
; As the person who ran setup, not elevated, in their own browser; only once
; it has started.
Filename: "http://localhost:{#AppPort}"; Description: "Open PairSight now"; \
  Flags: shellexec postinstall nowait skipifsilent; Check: Started

[Code]
// Where the script's ::step:: lines show while it runs.
const
  StepsNowhere = 0;
  StepsOnCheckPage = 1;
  StepsOnInstallPage = 2;
  StepsOnUninstallPage = 3;

var
  CheckPage: TOutputProgressWizardPage;
  StepsTo: Integer;
  // The script's ::ok:: lines (the checks that passed) and its ::error::.
  Passed: String;
  Reason: String;
  Checked: Boolean;
  InstallFailed: Boolean;

function PowerShellExe(): String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

procedure ShowStep(const Step: String);
begin
  case StepsTo of
    StepsOnCheckPage: CheckPage.SetText(Step, '');
    StepsOnInstallPage: WizardForm.StatusLabel.Caption := Step;
    StepsOnUninstallPage: UninstallProgressForm.StatusLabel.Caption := Step;
  end;
end;

procedure OnScriptLine(const S: String; const Error, FirstLine: Boolean);
begin
  Log(S);
  if Error then
    Exit;
  if Pos('::step::', S) = 1 then
    ShowStep(Copy(S, 9, MaxInt))
  else if Pos('::ok::', S) = 1 then
    Passed := Passed + '✓  ' + Copy(S, 7, MaxInt) + #13#10
  else if Pos('::error::', S) = 1 then
    Reason := Copy(S, 10, MaxInt);
end;

// Runs pairsight.ps1 hidden, its steps shown where ShowStepsTo says; the
// exit code, or -1 when it couldn't start.
function RunScript(const Script, Arguments: String; const ShowStepsTo: Integer): Integer;
var
  Code: Integer;
begin
  Passed := '';
  Reason := '';
  StepsTo := ShowStepsTo;
  try
    if not ExecAndLogOutput(PowerShellExe(), '-NoProfile -ExecutionPolicy Bypass -File "' + Script + '" ' +
      Arguments + ' -Progress', '', SW_HIDE, ewWaitUntilTerminated, Code, @OnScriptLine) then
      Code := -1;
  except
    Log(GetExceptionMessage);
    Code := -1;
  end;
  StepsTo := StepsNowhere;
  Result := Code;
end;

// Why this machine can't run PairSight: by `check`'s exit code, worded for
// someone running setup.
function CheckFailure(const Code: Integer): String;
begin
  case Code of
    10: Result := 'PairSight runs in Docker Desktop, which isn’t installed. Install it from ' +
      'https://www.docker.com/products/docker-desktop/, start it once, then run this setup again.';
    11: Result := 'Docker Desktop is installed but didn’t start. Start it, wait until it says it’s ' +
      'running, then run this setup again.';
    12: Result := 'PairSight needs at least 8 GB of memory, and this machine has less.';
    13: Result := 'PairSight needs at least 10 GB free on the system drive. Free some space, then run ' +
      'this setup again.';
    14: Result := 'Port {#AppPort} is taken by another program. Close it, then run this setup again.';
    15: Result := 'Docker Desktop needs WSL, which isn’t set up on this machine. Open PowerShell as ' +
      'administrator, run: wsl --install, restart the machine, then run this setup again.';
  else
    Result := 'The checks didn’t finish (code ' + IntToStr(Code) + '). Make sure Docker Desktop is ' +
      'running, then run this setup again.';
  end;
end;

// '' when the machine is ready, else why not.
function RunChecks(const ShowStepsTo: Integer): String;
var
  Code: Integer;
begin
  ExtractTemporaryFile('pairsight.ps1');
  Code := RunScript(ExpandConstant('{tmp}\pairsight.ps1'), 'check', ShowStepsTo);
  Checked := Code = 0;
  if Checked then
    Result := ''
  else
    Result := CheckFailure(Code);
end;

procedure InitializeWizard();
begin
  CheckPage := CreateOutputProgressPage('Checking this machine',
    'Docker Desktop, memory, disk space and the port PairSight opens on.');
  CheckPage.ProgressBar.Style := npbstMarquee;
  // A few lines: no scrollbars.
  WizardForm.ReadyMemo.ScrollBars := ssNone;
end;

// Checked on the way to Ready, which lists what was found.
function NextButtonClick(CurPageID: Integer): Boolean;
var
  Failure: String;
begin
  Result := True;
  if CurPageID = wpSelectTasks then
  begin
    CheckPage.SetText('Checking Docker Desktop...', '');
    CheckPage.Show;
    // The page shows its bar only once there's progress to show.
    CheckPage.SetProgress(0, 1);
    try
      Failure := RunChecks(StepsOnCheckPage);
    finally
      CheckPage.Hide;
    end;
    if Failure <> '' then
    begin
      TaskDialogMsgBox('This machine isn’t ready for PairSight', Failure, mbError, MB_OK, [], 0);
      Result := False;
    end;
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo,
  MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
var
  Found: String;
begin
  Found := Trim(Passed);
  StringChangeEx(Found, #13#10, NewLine + Space, True);
  Result := 'This machine:' + NewLine + Space + Found;
  if MemoTasksInfo <> '' then
    Result := Result + NewLine + NewLine + MemoTasksInfo;
end;

// A silent install skips the pages, so it checks here instead.
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  if Checked then
    Result := ''
  else
    Result := RunChecks(StepsNowhere);
end;

// The stack itself, its steps under the progress bar.
procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    WizardForm.ProgressGauge.Style := npbstMarquee;
    Code := RunScript(ExpandConstant('{app}\pairsight.ps1'),
      'install -Image "{#ImageRef}" -Owner "' + ExpandConstant('{username}') + '" -NoBrowser',
      StepsOnInstallPage);
    InstallFailed := Code <> 0;
    if InstallFailed and (Reason = '') then
      Reason := 'Setup couldn’t start PairSight (code ' + IntToStr(Code) + ').';
  end;
end;

function Started(): Boolean;
begin
  Result := not InstallFailed;
end;

// Installed but not running: the last page says why, instead of "ready".
procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and InstallFailed then
  begin
    WizardForm.FinishedHeadingLabel.Caption := 'PairSight didn’t start';
    WizardForm.FinishedLabel.Caption := Reason + #13#10#13#10 +
      'It’s installed: once that’s fixed, open it from the Start menu: PairSight, then Open PairSight.';
  end;
end;

// Uninstall stops PairSight in Docker before its files go, so Docker Desktop
// has to be running: otherwise its containers would start again with Docker,
// with nothing left to stop them. Checked before anything is removed.
function DockerRunning(): Boolean;
var
  Code: Integer;
begin
  Result := Exec(PowerShellExe(), '-NoProfile -Command "docker info *> $null; exit $LASTEXITCODE"', '',
    SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  if FileExists(ExpandConstant('{commonappdata}\PairSight\compose.yaml')) and not DockerRunning() then
  begin
    if not UninstallSilent() then
      TaskDialogMsgBox('Start Docker Desktop first',
        'PairSight runs in Docker Desktop, which isn’t running, so it can’t be stopped and removed. ' +
        'Start Docker Desktop, wait until it says it’s running, then uninstall PairSight again.',
        mbError, MB_OK, [], 0);
    Result := False;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Arguments, Keep, Delete: String;
  Code: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Arguments := 'uninstall';
    // Each button: its label, then a line under it.
    Keep := 'Keep my data'#13#10'Ready if you install PairSight again.';
    Delete := 'Delete my data'#13#10'Every evaluation, result and account. This can’t be undone.';
    if (not UninstallSilent()) and (TaskDialogMsgBox('Keep PairSight’s data?',
      'Its evaluations, results and accounts on this machine. Backups in Documents\PairSight backups ' +
      'are kept either way.', mbConfirmation, MB_YESNO, [Keep, Delete], 0) = IDNO) then
      Arguments := Arguments + ' -DeleteData';
    UninstallProgressForm.ProgressBar.Style := npbstMarquee;
    Code := RunScript(ExpandConstant('{app}\pairsight.ps1'), Arguments, StepsOnUninstallPage);
    if (Code <> 0) and not UninstallSilent() then
      TaskDialogMsgBox('PairSight wasn’t fully removed', Reason + #13#10#13#10 +
        'Its files are removed. Its data may still be in Docker Desktop.', mbError, MB_OK, [], 0);
  end;
end;
