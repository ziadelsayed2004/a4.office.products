param(
  [switch]$PermanentlyDeleteAllData,
  [string]$Confirmation = '',
  [string]$AdminUsername = 'admin',
  [string]$AdminName = 'System Administrator'
)

$ErrorActionPreference = 'Stop'

if (-not $PermanentlyDeleteAllData) {
  throw 'Permanent reset requires -PermanentlyDeleteAllData.'
}

if (-not $Confirmation) {
  $Confirmation = Read-Host 'Type DELETE ALL A4 DATA to permanently delete local databases and backups'
}
if ($Confirmation -cne 'DELETE ALL A4 DATA') {
  throw 'Permanent database reset was cancelled.'
}

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$databaseDirectory = [IO.Path]::GetFullPath((Join-Path $projectRoot 'server\src\db'))
$backupDirectory = [IO.Path]::GetFullPath((Join-Path $projectRoot 'backups'))

function Assert-DirectChild {
  param(
    [Parameter(Mandatory = $true)][string]$Parent,
    [Parameter(Mandatory = $true)][string]$Candidate
  )
  $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  $resolvedCandidate = [IO.Path]::GetFullPath($Candidate)
  if (-not $resolvedCandidate.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete a path outside the intended directory: $resolvedCandidate"
  }
  return $resolvedCandidate
}

$databaseNames = @('a4_pos.db', 'a4_pos.local.db')
$sidecars = @('', '-wal', '-shm', '-journal')
foreach ($databaseName in $databaseNames) {
  foreach ($suffix in $sidecars) {
    $target = Assert-DirectChild -Parent $databaseDirectory -Candidate (
      Join-Path $databaseDirectory "$databaseName$suffix"
    )
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Force
    }
  }
}

if (Test-Path -LiteralPath $backupDirectory) {
  Get-ChildItem -LiteralPath $backupDirectory -File |
    Where-Object {
      $_.Name -match '(?i)\.(db|sqlite|sqlite3)(-(wal|shm|journal))?$'
    } |
    ForEach-Object {
      $target = Assert-DirectChild -Parent $backupDirectory -Candidate $_.FullName
      Remove-Item -LiteralPath $target -Force
    }
}

Push-Location $projectRoot
try {
  & npm.cmd run db:migrate
  if ($LASTEXITCODE -ne 0) {
    throw "Database migrations failed with exit code $LASTEXITCODE."
  }

  $securePassword = Read-Host 'New Admin password (minimum 8 characters)' -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ($plainPassword.Length -lt 8) {
      throw 'Admin password must contain at least 8 characters.'
    }
    $env:BOOTSTRAP_ADMIN_USERNAME = $AdminUsername
    $env:BOOTSTRAP_ADMIN_NAME = $AdminName
    $env:BOOTSTRAP_ADMIN_PASSWORD = $plainPassword
    & npm.cmd run admin:bootstrap
    if ($LASTEXITCODE -ne 0) {
      throw "Admin bootstrap failed with exit code $LASTEXITCODE."
    }
  } finally {
    $env:BOOTSTRAP_ADMIN_USERNAME = $null
    $env:BOOTSTRAP_ADMIN_NAME = $null
    $env:BOOTSTRAP_ADMIN_PASSWORD = $null
    $plainPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
  }
} finally {
  Pop-Location
}

Write-Host 'Local A4 databases and backups were deleted. Migrations and Admin bootstrap completed.'
