param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\release')
)

$ErrorActionPreference = 'Stop'

$sourcePath = Join-Path $PSScriptRoot 'A4CashierLauncher.cs'
$logoPath = Join-Path $PSScriptRoot '..\..\client\src\assets\a4-logo.png'
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
$productionOutputPath = Join-Path $resolvedOutput 'A4-Cashier-Production.exe'
$localOutputPath = Join-Path $resolvedOutput 'A4-Cashier-Local.exe'
$iconPath = Join-Path $env:TEMP 'a4-cashier-launcher.ico'
$iconArtworkPath = Join-Path $env:TEMP 'a4-cashier-icon-artwork.png'

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Launcher source was not found: $sourcePath"
}
if (-not (Test-Path -LiteralPath $logoPath)) {
  throw "A4 logo was not found: $logoPath"
}

New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

# Render a taskbar-specific square icon. The small "Office Products" wordmark
# is intentionally excluded because it becomes unreadable at 16/24/32px.
Add-Type -AssemblyName System.Drawing
$sourceImage = [System.Drawing.Bitmap]::new($logoPath)
$iconBitmap = [System.Drawing.Bitmap]::new(
  256,
  256,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  $sourceMarkHeight = [Math]::Min(210, $sourceImage.Height)
  $sourceRectangle = [System.Drawing.Rectangle]::new(0, 0, $sourceImage.Width, $sourceMarkHeight)
  $targetRectangle = [System.Drawing.Rectangle]::new(16, 62, 224, 131)
  $graphics.DrawImage(
    $sourceImage,
    $targetRectangle,
    $sourceRectangle,
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $iconBitmap.Save($iconArtworkPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $iconBitmap.Dispose()
  $sourceImage.Dispose()
}

# Windows 10/11 renders the 256x256 PNG entry directly from the ICO and
# downsamples it for Explorer, shortcuts and the taskbar.
$png = [IO.File]::ReadAllBytes($iconArtworkPath)
if ($png.Length -lt 24 -or $png[0] -ne 0x89 -or $png[1] -ne 0x50) {
  throw 'The A4 logo is not a valid PNG file.'
}
$width = [Math]::Min(256, [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($png, 16)))
$height = [Math]::Min(256, [Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($png, 20)))
if ($width -ne 256 -or $height -ne 256) {
  throw "The Windows icon artwork must be exactly 256x256 pixels (received ${width}x${height})."
}
$stream = [IO.File]::Create($iconPath)
$writer = [IO.BinaryWriter]::new($stream)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)
  $writer.Write([Byte]$(if ($width -ge 256) { 0 } else { $width }))
  $writer.Write([Byte]$(if ($height -ge 256) { 0 } else { $height }))
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$png.Length)
  $writer.Write([UInt32]22)
  $writer.Write($png)
} finally {
  $writer.Dispose()
  $stream.Dispose()
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
$desktopProduction = Join-Path $desktopPath 'A4 Cashier - Production.exe'
$desktopLocal = Join-Path $desktopPath 'A4 Cashier - Local.exe'
Copy-Item -LiteralPath $productionOutputPath -Destination $desktopProduction -Force
Copy-Item -LiteralPath $localOutputPath -Destination $desktopLocal -Force

@(
  [pscustomobject]@{
    Build = 'Production'
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
