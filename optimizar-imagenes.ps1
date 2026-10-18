# Genera versiones livianas de las fotos del catálogo para celulares.
#   img-opt/<nombre>-640.jpg  -> tarjetas de producto (pantallas chicas / densidad 2x)
#   img-opt/<nombre>-160.jpg  -> miniaturas (carrito y sabores Pollita Lu)
# Lee las imágenes declaradas en products.js (image / packImage), así que basta con
# volver a ejecutar este script cuando se agregue un producto nuevo:
#   powershell -ExecutionPolicy Bypass -File .\optimizar-imagenes.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $root "img-opt"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$products = Get-Content -Raw -Encoding UTF8 (Join-Path $root "products.js")
$names = [regex]::Matches($products, '(?:image|packImage):\s*"([^"]+\.jpe?g)"') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }

function Save-Resized([string]$source, [string]$target, [int]$maxWidth, [int]$quality) {
    $img = [System.Drawing.Image]::FromFile($source)
    try {
        $w = [Math]::Min($maxWidth, $img.Width)
        $h = [int][Math]::Round($img.Height * ($w / $img.Width))
        $bmp = New-Object System.Drawing.Bitmap($w, $h)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $w, $h)
        $g.Dispose()
        $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
        $bmp.Save($target, $codec, $params)
        $bmp.Dispose()
    } finally {
        $img.Dispose()
    }
}

foreach ($name in $names) {
    $source = Join-Path $root $name
    if (-not (Test-Path $source)) { Write-Warning "No existe $name, se omite."; continue }
    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
    Save-Resized $source (Join-Path $outDir "$base-640.jpg") 640 78
    Save-Resized $source (Join-Path $outDir "$base-160.jpg") 160 72
    Write-Output "OK  $name"
}

$total = (Get-ChildItem $outDir -File | Measure-Object Length -Sum).Sum
Write-Output ("{0} archivos en img-opt ({1:N0} KB)" -f (Get-ChildItem $outDir -File).Count, ($total / 1KB))
