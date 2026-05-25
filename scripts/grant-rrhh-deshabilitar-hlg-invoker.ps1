# Otorga invoker publico al servicio Cloud Run de rrhhDeshabilitarHlg (corrige 403 / "internal" en el portal).
# Requiere Google Cloud SDK (gcloud) instalado y: gcloud auth login

$Project = "portal-hospital-v2"
$Region = "southamerica-east1"
$Service = "rrhhdeshabilitarhlg"

$gcloudCandidates = @(
  "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "gcloud"
)

$gcloud = $null
foreach ($c in $gcloudCandidates) {
  if ($c -eq "gcloud") {
    $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($cmd) { $gcloud = $cmd.Source; break }
  } elseif (Test-Path $c) {
    $gcloud = $c
    break
  }
}

if (-not $gcloud) {
  Write-Host "No se encontro gcloud. Instala Google Cloud SDK o ejecuta en la consola web:" -ForegroundColor Yellow
  Write-Host "  Cloud Run > $Service > Seguridad > Permitir acceso publico (invocaciones sin autenticacion)"
  Write-Host "  O Permisos > Agregar principal allUsers > Rol Cloud Run Invoker"
  exit 1
}

Write-Host "Usando: $gcloud"
& $gcloud config set project $Project | Out-Null
& $gcloud run services add-iam-policy-binding $Service `
  --region=$Region `
  --project=$Project `
  --member="allUsers" `
  --role="roles/run.invoker"

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK: invoker publico en $Service" -ForegroundColor Green
} else {
  Write-Host "Fallo (a veces la org. bloquea allUsers). Proba en consola: Seguridad > acceso publico." -ForegroundColor Red
  exit $LASTEXITCODE
}
