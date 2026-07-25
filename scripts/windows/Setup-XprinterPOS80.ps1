param(
  [string]$InstallerPath = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads\Xprinter-POS80-Driver-2024.01.29.1.exe')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InstallerPath)) {
  throw "The signed Xprinter installer was not found at: $InstallerPath"
}

$signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
if ($signature.Status -ne 'Valid') {
  throw "The Xprinter installer signature is not valid: $($signature.Status)"
}

Write-Host 'The official Xprinter installer will open with administrator permission.'
Write-Host 'Choose the 80mm POS-80C model and the USB connection/USB001 port.'
$process = Start-Process -FilePath $InstallerPath -Verb RunAs -Wait -PassThru
if ($process.ExitCode -ne 0) {
  throw "Xprinter installer exited with code $($process.ExitCode)."
}

$printer = Get-Printer |
  Where-Object {
    $_.Name -match '(?i)(POS[- ]?80|XP[- ]?80|Xprinter)' -and
    $_.Name -notmatch '(?i)(PDF|OneNote|AnyDesk)'
  } |
  Select-Object -First 1
if (-not $printer) {
  throw 'The driver finished but no POS-80 printer was found. Confirm POS-80C and USB001 in the installer.'
}

$network = New-Object -ComObject WScript.Network
$network.SetDefaultPrinter($printer.Name)

$desktopPath = [Environment]::GetFolderPath('Desktop')
$launcherCandidates = @(
  (Join-Path $desktopPath 'A4 Cashier.exe'),
  (Join-Path $PSScriptRoot '..\..\release\A4 Cashier.exe')
)
$launcherPath = $launcherCandidates |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
if (-not $launcherPath) {
  throw 'A4 Cashier.exe was not found. Run Build-A4CashierExe.ps1 first.'
}
$launcherPath = [IO.Path]::GetFullPath($launcherPath)
$shortcutPath = Join-Path $desktopPath 'A4 Cashier - Automatic Print.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherPath
$shortcut.Arguments = ''
$shortcut.WorkingDirectory = Split-Path -Parent $launcherPath
$shortcut.Description = 'A4 cashier with silent printing to Xprinter POS-80'
$shortcut.Save()

Write-Host "Default printer: $($printer.Name)"
Write-Host "Cashier shortcut created: $shortcutPath"
Write-Host 'Open the shortcut and sign in once. Future receipt printing will bypass the print dialog.'
