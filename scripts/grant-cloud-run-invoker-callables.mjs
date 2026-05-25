/**
 * Otorga roles/run.invoker a allUsers en cada servicio Cloud Run de las callables Gen2.
 * Corrige 403 en OPTIONS (CORS “falso”) cuando el IAM del servicio no quedó público.
 *
 * Requiere Google Cloud SDK (`gcloud`) en PATH y sesión: `gcloud auth login` + proyecto.
 *
 * Uso: npm run firebase:grant-callables-invoker
 */
import { spawnSync } from "node:child_process";

const PROJECT = "portal-hospital-v2";
const REGION = "southamerica-east1";

/** Misma regla que firebase-tools runv2.functionNameToServiceName(endpoint.id) */
function toRunServiceId(exportId) {
  return String(exportId).toLowerCase().replace(/_/g, "-");
}

/** Nombres exportados en functions/index.js (camelCase) */
const CALLABLE_EXPORT_IDS = [
  "resolverEmailLoginDni",
  "healthV2",
  "syncSessionClaims",
  "registrarPrimerAcceso",
  "rrhhAltaAgente",
  "rrhhActualizarEstadoCuentaAcceso",
  "rrhhAplicarBajaLaboral",
  "rrhhReiniciarVinculacionCuenta",
  "listarColeccion",
  "guardarOpcion",
  "listarCatalogoOnboarding",
  "listarColeccionPublicaTemporal",
  "guardarRegistroLaboralTemporal",
  "rrhhDeshabilitarHlc",
  "rrhhDeshabilitarHlg",
  "listarReadModelLaboralOperativoTemporal",
  "guardarRegistroPersonalTemporal",
  "rrhhMarcarEventoDatosPersonalesVisto",
  "vincularCuentaConDni",
  "onboardingMvpPasoA",
  "onboardingMvpDdjjFamiliar",
  "onboardingMvpOmitirDdjjFamiliar",
  "onboardingMvpCompletar",
  "guardarRegimenHorario",
  "listarRegimenesHorarios",
  "guardarPlanTurnoServicio",
  "enviarPlanTurnoServicio",
  "aprobarPlanTurnoServicio",
  "rechazarPlanTurnoServicio",
  "habilitarPlanTurnoServicio",
  "cerrarPlanPerpetuo",
  "listarPlanesTurnoServicio",
];

function gcloudInstalled() {
  const r = spawnSync("gcloud", ["--version"], { encoding: "utf8", shell: true });
  return r.status === 0;
}

function main() {
  if (!gcloudInstalled()) {
    console.error(
      "No se encontró `gcloud`. Instalá Google Cloud SDK y ejecutá:\n" +
        "  gcloud auth login\n" +
        `  gcloud config set project ${PROJECT}\n`,
    );
    for (const id of CALLABLE_EXPORT_IDS) {
      const svc = toRunServiceId(id);
      console.log(
        `gcloud run services add-iam-policy-binding ${svc} ` +
          `--region=${REGION} --project=${PROJECT} ` +
          `--member="allUsers" --role="roles/run.invoker"`,
      );
    }
    process.exit(1);
  }

  let failed = 0;
  for (const id of CALLABLE_EXPORT_IDS) {
    const svc = toRunServiceId(id);
    const args = [
      "run",
      "services",
      "add-iam-policy-binding",
      svc,
      `--region=${REGION}`,
      `--project=${PROJECT}`,
      "--member=allUsers",
      "--role=roles/run.invoker",
    ];
    console.log(`\n→ ${svc} (${id})`);
    const r = spawnSync("gcloud", args, { stdio: "inherit", shell: true });
    if (r.status !== 0) {
      failed += 1;
    }
  }

  if (failed) {
    console.error(`\nFallaron ${failed} servicios (¿política de org. que bloquea allUsers?).`);
    process.exit(1);
  }
  console.log("\nListo: invoker público aplicado en Cloud Run para las callables listadas.");
}

main();
