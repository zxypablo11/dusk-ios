$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

$vs = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
$devShell = Join-Path $vs "Common7\Tools\Microsoft.VisualStudio.DevShell.dll"
if (Test-Path $devShell) {
  Import-Module $devShell
  Enter-VsDevShell -VsInstallPath $vs -SkipAutomaticLocation -DevCmdArguments "-arch=x64 -host_arch=x64" | Out-Null
}

npm install
npm run build

Write-Host "Done. Look for Dusk_*_x64-setup.exe under the Cargo target bundle/nsis folder."
