# Crea la base Firestore (default) en modo nativo en el proyecto V2 — una sola vez (idempotente).
# Requisitos: Google Cloud SDK (gcloud) y sesión: gcloud auth login, cuenta con permisos (Owner/Editor o roles Firestore).
# Región: variable de entorno FIRESTORE_V2_LOCATION o por defecto southamerica-east1 (cambiar según hospital).
# Uso:  npm run firestore:create   (desde la raíz de portal-hospital-v2)
#       o:  powershell -ExecutionPolicy Bypass -File scripts/seed-v2/crear-base-firestore.ps1

$ErrorActionPreference = "Stop"
$Project = "portal-hospital-v2"
$Location = if ($env:FIRESTORE_V2_LOCATION) { $env:FIRESTORE_V2_LOCATION.Trim() } else { "southamerica-east1" }

function Test-Gcloud {
  $g = Get-Command gcloud -ErrorAction SilentlyContinue
  if (-not $g) {
    Write-Host "No se encontro 'gcloud'. Instala Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
  }
}

Test-Gcloud

Write-Host "[firestore-v2] project=$Project location=$Location" -ForegroundColor Cyan
gcloud config set project $Project 2>&1 | Out-Null
gcloud services enable firestore.googleapis.com --project $Project

$listed = gcloud firestore databases list --project $Project --format="value(name)" 2>&1
if ($LASTEXITCODE -eq 0 -and $listed -match "default") {
  Write-Host "[firestore-v2] La base (default) ya existe. No hace falta crear." -ForegroundColor Green
  exit 0
}

Write-Host "[firestore-v2] Creando base nativa (default)..." -ForegroundColor Cyan
$out = gcloud firestore databases create --location $Location --project $Project 2>&1
$code = $LASTEXITCODE
Write-Host $out
if ($code -eq 0) {
  Write-Host "[firestore-v2] Listo. Espera 1-2 min y ejecuta: npm run seed:cfg" -ForegroundColor Green
  exit 0
}
$msg = $out -join " "
if ($msg -match "ALREADY_EXISTS|already exists|Already exists") {
  Write-Host "[firestore-v2] La base ya existia (ALREADY_EXISTS). Continua con: npm run seed:cfg" -ForegroundColor Green
  exit 0
}
Write-Host "[firestore-v2] Error al crear. Revisa facturacion del proyecto y permisos de la cuenta gcloud." -ForegroundColor Red
exit $code
