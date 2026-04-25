#Requires -Version 5.1
<#
  Copia de seguridad del repositorio en un ZIP bajo /backups (excluye node_modules, .git, dist, backups, .cursor).
  Uso (raíz del repo): powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\crear-copia-seguridad.ps1
#>
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path $repoRoot "backups"
$stampName = "portal-hospital-v2-copia-$ts"
$tmpDir = Join-Path $env:TEMP "ph2-$stampName"
$zipPath = Join-Path $outDir "$stampName.zip"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

# /XD excluye por nombre de carpeta en cualquier nivel
$args = @(
  "`"$repoRoot`"", "`"$tmpDir`"", "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
  "/XD", "node_modules", ".git", "dist", "backups", ".cursor"
)
$rc = (Start-Process -FilePath "robocopy" -ArgumentList $args -Wait -PassThru -NoNewWindow).ExitCode
if ($rc -ge 8) {
  Write-Error "robocopy falló (código $rc)."
}

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
$items = Get-ChildItem -LiteralPath $tmpDir -ErrorAction SilentlyContinue
if (-not $items -or $items.Count -eq 0) {
  Write-Error "La carpeta temporal quedó vacía."
}
Compress-Archive -Path (Join-Path $tmpDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $tmpDir

Write-Host "OK: $zipPath"
Write-Output $zipPath
