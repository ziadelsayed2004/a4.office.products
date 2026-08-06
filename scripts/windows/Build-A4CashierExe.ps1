param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\release')
)

$ErrorActionPreference = 'Stop'

$sourcePath = Join-Path $PSScriptRoot 'A4CashierLauncher.cs'
$desktopLogoPath = Join-Path $PSScriptRoot '..\..\client\public\favicon-rounded.png'
$taskbarLogoPath = Join-Path $PSScriptRoot '..\..\client\src\assets\a4.logo.bg.jpeg'
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
$productionOutputPath = Join-Path $resolvedOutput 'A4 Cashier.exe'
$localOutputPath = Join-Path $resolvedOutput 'A4 Cashier - Local.exe'
$iconPath = Join-Path $env:TEMP 'a4-cashier-launcher.ico'
$webIconPath = Join-Path $PSScriptRoot '..\..\client\public\favicon.ico'
$webTaskbarIconPath = Join-Path $PSScriptRoot '..\..\client\public\favicon-taskbar.png'

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Launcher source was not found: $sourcePath"
}
if (-not (Test-Path -LiteralPath $desktopLogoPath)) {
  throw "A4 desktop icon was not found: $desktopLogoPath"
}
if (-not (Test-Path -LiteralPath $taskbarLogoPath)) {
  throw "A4 taskbar logo was not found: $taskbarLogoPath"
}

New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

# The EXE/desktop icon keeps the complete rounded white artwork.
Add-Type -AssemblyName System.Drawing
# Build a multi-resolution ICO so Windows never has to scale one large entry
# for the title bar, taskbar, Start menu and desktop.
$sourceIcon = [System.Drawing.Bitmap]::new($desktopLogoPath)
$iconSizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$iconEntries = @()
try {
  foreach ($size in $iconSizes) {
    $bitmap = [System.Drawing.Bitmap]::new(
      $size,
      $size,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $memory = [IO.MemoryStream]::new()
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.DrawImage($sourceIcon, 0, 0, $size, $size)
      $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
      $iconEntries += [pscustomobject]@{
        Size = $size
        Bytes = $memory.ToArray()
      }
    } finally {
      $memory.Dispose()
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
} finally {
  $sourceIcon.Dispose()
}

$stream = [IO.File]::Create($iconPath)
$writer = [IO.BinaryWriter]::new($stream)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$iconEntries.Count)
  $offset = 6 + (16 * $iconEntries.Count)
  foreach ($entry in $iconEntries) {
    $writer.Write([Byte]$(if ($entry.Size -ge 256) { 0 } else { $entry.Size }))
    $writer.Write([Byte]$(if ($entry.Size -ge 256) { 0 } else { $entry.Size }))
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $entry.Bytes.Length
  }
  foreach ($entry in $iconEntries) {
    $writer.Write($entry.Bytes)
  }
} finally {
  $writer.Dispose()
  $stream.Dispose()
}

# Keep the multi-resolution desktop artwork available to Windows shortcuts.
Copy-Item -LiteralPath $iconPath -Destination $webIconPath -Force

# Chrome app windows use the site's favicon instead of the embedded EXE icon.
# Generate a separate, transparent, high-resolution A4 mark for the taskbar.
$taskbarSource = [System.Drawing.Bitmap]::new($taskbarLogoPath)
$taskbarBitmap = [System.Drawing.Bitmap]::new(
  256,
  256,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$taskbarGraphics = [System.Drawing.Graphics]::FromImage($taskbarBitmap)
$taskbarAttributes = [System.Drawing.Imaging.ImageAttributes]::new()
try {
  $taskbarGraphics.Clear([System.Drawing.Color]::Transparent)
  $taskbarGraphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $taskbarGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $taskbarGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $taskbarGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $taskbarGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $sourceRectangle = [System.Drawing.Rectangle]::new(
    [Math]::Round($taskbarSource.Width * 0.07),
    [Math]::Round($taskbarSource.Height * 0.14),
    [Math]::Round($taskbarSource.Width * 0.86),
    [Math]::Round($taskbarSource.Height * 0.56)
  )
  $targetRectangle = [System.Drawing.Rectangle]::new(8, 45, 240, 166)
  $taskbarAttributes.SetColorKey(
    [System.Drawing.Color]::FromArgb(238, 238, 238),
    [System.Drawing.Color]::White
  )
  $taskbarGraphics.DrawImage(
    $taskbarSource,
    $targetRectangle,
    $sourceRectangle.X,
    $sourceRectangle.Y,
    $sourceRectangle.Width,
    $sourceRectangle.Height,
    [System.Drawing.GraphicsUnit]::Pixel,
    $taskbarAttributes
  )
  $taskbarBitmap.Save($webTaskbarIconPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $taskbarAttributes.Dispose()
  $taskbarGraphics.Dispose()
  $taskbarBitmap.Dispose()
  $taskbarSource.Dispose()
}

$source = Get-Content -LiteralPath $sourcePath -Raw

function Build-Launcher {
  param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$BuildSymbol = ''
  )

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  $compilerParameters = [CodeDom.Compiler.CompilerParameters]::new()
  $compilerParameters.GenerateExecutable = $true
  $compilerParameters.GenerateInMemory = $false
  $compilerParameters.OutputAssembly = $OutputPath
  $compilerOptions = "/target:winexe /optimize+ /win32icon:`"$iconPath`""
  if ($BuildSymbol) {
    $compilerOptions += " /define:$BuildSymbol"
  }
  $compilerParameters.CompilerOptions = $compilerOptions
  $compilerParameters.ReferencedAssemblies.Add('System.dll') | Out-Null
  $compilerParameters.ReferencedAssemblies.Add('System.Web.Extensions.dll') | Out-Null
  $compilerParameters.ReferencedAssemblies.Add('System.Windows.Forms.dll') | Out-Null
  $provider = [Microsoft.CSharp.CSharpCodeProvider]::new()
  try {
    $result = $provider.CompileAssemblyFromSource($compilerParameters, $source)
    if ($result.Errors.HasErrors) {
      $messages = @($result.Errors | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
      throw "A4 Cashier compilation failed:$([Environment]::NewLine)$messages"
    }
  } finally {
    $provider.Dispose()
  }

  if (-not (Test-Path -LiteralPath $OutputPath)) {
    throw "A4 Cashier executable was not generated: $OutputPath"
  }
}

Build-Launcher -OutputPath $productionOutputPath
Build-Launcher -OutputPath $localOutputPath -BuildSymbol 'LOCAL_BUILD'

$desktopPath = [Environment]::GetFolderPath('Desktop')
$desktopProduction = Join-Path $desktopPath 'A4 Cashier.exe'
$desktopLocal = Join-Path $desktopPath 'A4 Cashier - Local.exe'
Copy-Item -LiteralPath $productionOutputPath -Destination $desktopProduction -Force
Copy-Item -LiteralPath $localOutputPath -Destination $desktopLocal -Force

@(
  [pscustomobject]@{
    Build = 'A4 Cashier'
    URL = 'https://a4office.cloud'
    Output = $productionOutputPath
    Desktop = $desktopProduction
    Size = (Get-Item -LiteralPath $productionOutputPath).Length
    SHA256 = (Get-FileHash -LiteralPath $productionOutputPath -Algorithm SHA256).Hash
  }
  [pscustomobject]@{
    Build = 'Local'
    URL = 'http://localhost:5173'
    Output = $localOutputPath
    Desktop = $desktopLocal
    Size = (Get-Item -LiteralPath $localOutputPath).Length
    SHA256 = (Get-FileHash -LiteralPath $localOutputPath -Algorithm SHA256).Hash
  }
)
