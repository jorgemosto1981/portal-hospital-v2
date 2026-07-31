/**
 * Prod: setea familia_64_par_articulo_id en los 4 arts Art. 64 activos.
 * NO modifica cupos/retro/circuito (respeta cfg publicada).
 *
 *   node scripts/seed-v2/patch-familia64-pares-prod.mjs
 */
import { execSync } from "node:child_process";

const PROD = "portal-hospital-v2";
const ART_A = "art_01KRNK10V10CH7W5M2W6V558GS";
const ART_B = "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ";
const ART_A_HALF = "art_01KTTZZ6841BHNTR479X74M67S";
const ART_B_HALF = "art_01KYSF5SSNM8PQERBK0GB9HREW";

const PAIRS = [
  [ART_A, ART_B],
  [ART_A_HALF, ART_B_HALF],
];

function token() {
  return execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
}

function fsUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${PROD}/databases/(default)/documents/${path}`;
}

function str(v) {
  return { stringValue: String(v) };
}
function bool(v) {
  return { booleanValue: Boolean(v) };
}

async function patchDoc(tok, path, fields, mask) {
  const qs = mask.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join("&");
  const res = await fetch(`${fsUrl(path)}?${qs}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tok}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function getDoc(tok, path) {
  const res = await fetch(fsUrl(path), { headers: { Authorization: `Bearer ${tok}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function main() {
  const tok = token();
  console.log(`[familia64-prod] proyecto=${PROD}`);

  for (const id of [ART_A, ART_B, ART_A_HALF, ART_B_HALF]) {
    const d = await getDoc(tok, `cfg_articulos/${id}`);
    if (!d) throw new Error(`Falta artículo en prod: ${id}`);
    if (d.fields?.activo?.booleanValue === false) {
      console.warn(`[warn] ${id} tiene activo=false`);
    }
  }

  for (const [conGoce, sinGoce] of PAIRS) {
    console.log(`[par] ${conGoce} ↔ ${sinGoce}`);
    await patchDoc(
      tok,
      `cfg_articulos/${conGoce}`,
      {
        familia_64_par_articulo_id: str(sinGoce),
        es_sin_goce: bool(false),
        activo: bool(true),
      },
      ["familia_64_par_articulo_id", "es_sin_goce", "activo"],
    );
    await patchDoc(
      tok,
      `cfg_articulos/${sinGoce}`,
      {
        familia_64_par_articulo_id: str(conGoce),
        es_sin_goce: bool(true),
        activo: bool(true),
      },
      ["familia_64_par_articulo_id", "es_sin_goce", "activo"],
    );
  }

  // 64-B canónico: modo_resolucion_jefe vacío → explicitar autorizacion (sin tocar topes/retro).
  const coreB = await getDoc(tok, `cfg_articulos/${ART_B}`);
  const verB = coreB.fields.version_actual_id.stringValue;
  const verDoc = await getDoc(tok, `cfg_articulos/${ART_B}/versiones/${verB}`);
  const wf = verDoc.fields.bloque_workflow_sla_cobertura.mapValue.fields;
  if (!wf.modo_resolucion_jefe?.stringValue) {
    console.log(`[wf] set modo_resolucion_jefe=autorizacion en ${verB}`);
    const nextWf = {
      mapValue: {
        fields: {
          ...wf,
          modo_resolucion_jefe: str("autorizacion"),
        },
      },
    };
    await patchDoc(
      tok,
      `cfg_articulos/${ART_B}/versiones/${verB}`,
      { bloque_workflow_sla_cobertura: nextWf },
      ["bloque_workflow_sla_cobertura"],
    );
  }

  for (const id of [ART_A, ART_B, ART_A_HALF, ART_B_HALF]) {
    const d = await getDoc(tok, `cfg_articulos/${id}`);
    console.log(
      `OK ${d.fields.codigo.stringValue} par=${d.fields.familia_64_par_articulo_id.stringValue} sin_goce=${d.fields.es_sin_goce.booleanValue}`,
    );
  }
  console.log("[familia64-prod] cfg listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
