[Setup]
AppId={{1B5BA0C4-5D1B-4F3F-AFA0-CASTRACK0001}
AppName=CashTrack
AppVersion=1.0.0
DefaultDirName={pf}\CashTrack
DefaultGroupName=CashTrack
DisableProgramGroupPage=yes
OutputBaseFilename=CashTrackInstaller
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\release\windows\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Run]
Filename: "{app}\\runtime\\node.exe"; Parameters: "\"{app}\\app\\scripts\\windows\\service.js\" --install"; StatusMsg: "Registering CashTrack service"; Flags: runhidden

[UninstallRun]
Filename: "{app}\\runtime\\node.exe"; Parameters: "\"{app}\\app\\scripts\\windows\\service.js\" --uninstall"; StatusMsg: "Removing CashTrack service"; Flags: runhidden

[Icons]
Name: "{group}\\CashTrack Dashboard"; Filename: "http://localhost:3000"
Name: "{commondesktop}\\CashTrack Dashboard"; Filename: "http://localhost:3000"; Tasks: desktopicon

[Messages]
BeveledLabel=CashTrack
