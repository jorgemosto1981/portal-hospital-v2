/**
 * Auditoría de solo lectura del punto 5.4 del RFC de escalabilidad de la bandeja
 * del jefe: ¿hay `sol_*` en revisión jefe sin el snapshot `autorizadores_elegibles_ids`?
 *
 * N2 filtra en Firestore con `array-contains` sobre ese campo, así que cualquier
 * documento sin snapshot se vuelve invisible para el jefe. Esto lo cuantifica
 * antes de activar N2.
 *
 * Uso: node scripts/seed-v2/auditar-snapshot-autorizadores.mjs [dev|prod]
 */
import { execSync } from "node:child_process";

const PROYECTOS = { dev: "portal-hospital-v2-dev", prod: "portal-hospital-v2" };
const alias = String(process.argv[2] || "dev").trim();
const proyecto = PROYECTOS[alias];
if (!proyecto) throw new Error(`Alias inválido: ${alias}. Usar dev|prod.`);

const ESTADO_REVISION_JEFE = "cfg_esa_en_revision_jefe";

const tok = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();

async function runQuery(structuredQuery) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery }),
    },
  );
  if (!res.ok) throw new Error(`runQuery: ${res.status} ${await res.text()}`);
  return (await res.json()).filter((r) => r.document);
}

const todas = await runQuery({ from: [{ collectionId: "solicitudes_articulo" }] });

let enRevision = 0;
let sinSnapshot = 0;
let snapshotVacio = 0;
const ejemplos = [];

for (const r of todas) {
  const f = r.document.fields || {};
  const estado = f.estado_solicitud_id?.stringValue || "";
  if (estado !== ESTADO_REVISION_JEFE) continue;
  enRevision += 1;

  const arr = f.autorizadores_elegibles_ids?.arrayValue;
  const id = r.document.name.split("/").pop();
  if (!arr) {
    sinSnapshot += 1;
    if (ejemplos.length < 10) ejemplos.push(`${id} (campo ausente)`);
  } else if (!arr.values || arr.values.length === 0) {
    snapshotVacio += 1;
    // Vacío con `autorizacion_rrhh_sustituta` es un estado válido: el escalamiento
    // se agotó sin autorizador y RRHH sustituye. Vacío sin esa marca sí es sospechoso.
    const sustituta = f.autorizacion_rrhh_sustituta?.booleanValue === true;
    if (ejemplos.length < 10) {
      ejemplos.push(
        `${id} (vacío, rrhh_sustituta=${sustituta}, grupo_aut=${f.grupo_autorizacion_id?.stringValue ?? "null"}, fecha_desde=${f.fecha_desde?.stringValue ?? "?"})`,
      );
    }
  }
}

console.log(`proyecto            : ${proyecto}`);
console.log(`solicitudes totales : ${todas.length}`);
console.log(`en revisión jefe    : ${enRevision}`);
console.log(`  sin el campo      : ${sinSnapshot}`);
console.log(`  con arreglo vacío : ${snapshotVacio}`);
console.log(`  aptas para N2     : ${enRevision - sinSnapshot - snapshotVacio}`);
if (ejemplos.length) console.log(`ejemplos            :\n  ${ejemplos.join("\n  ")}`);
