#Requires -Version 5.1
<#
  Restaura el contenido de un ZIP creado con crear-copia-seguridad.ps1 sobre el directorio destino.
  ATENCIÓN: sobrescribe archivos existentes. Cierra el IDE y detén servidores antes.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restaurar-copia-seguridad.ps1 -ZipPath ".\backups\portal-hospital-v2-copia-XXXX.zip"
  Opcional:
    -TargetRoot "C:\ruta\portal-hospital-v2"   (por defecto: raíz del repo, padre de /scripts)
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $ZipPath,
  [string] $TargetRoot = ""
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $ZipPath)) {
  Write-Error "No existe el archivo: $ZipPath"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ($TargetRoot -eq "") {
  $TargetRoot = $repoRoot
} else {
  if (-not (Test-Path -LiteralPath $TargetRoot)) {
    New-Item -ItemType Directory -Path $TargetRoot -Force | Out-Null
  }
  $TargetRoot = (Resolve-Path -LiteralPath $TargetRoot).Path
}

$confirm = Read-Host "Se descomprimirá en: $TargetRoot`n¿Continuar? (S/N)"
if ($confirm -notmatch "^[sS]") {
  Write-Host "Cancelado."
  exit 0
}

$tmp = Join-Path $env:TEMP "ph2-restore-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $tmp -Force
  $src = $tmp
  Get-ChildItem -LiteralPath $src -Force | ForEach-Object {
    $name = $_.Name
    if ($name -in @("node_modules", ".git")) { return }
    $destItem = Join-Path $TargetRoot $name
    if (Test-Path -LiteralPath $destItem) {
      Remove-Item -LiteralPath $destItem -Recurse -Force
    }
    Copy-Item -LiteralPath $_.FullName -Destination $TargetRoot -Recurse -Force
  }
  Write-Host "Restauración completada en: $TargetRoot"
  Write-Host "Ejecutá npm install en la raíz, web/ y functions/ si hace falta."
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
