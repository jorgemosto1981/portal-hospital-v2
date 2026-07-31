/**
 * Sync familia 64 a portal-hospital-v2-dev:
 * 1) Copia 64-B (Personal 1/2 carga) desde prod
 * 2) Alinea 64-A ½ carga (cupo 3, circuito) con prod
 * 3) Setea familia_64_par_articulo_id en los 4 arts activos
 *
 * Auth: gcloud user token (no requiere SA JSON -dev).
 * Uso: node scripts/seed-v2/sync-familia64-pares-dev.mjs
 */
import { execSync } from "node:child_process";

const PROD = "portal-hospital-v2";
const DEV = "portal-hospital-v2-dev";

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

function fsUrl(project, path) {
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${path}`;
}

async function getDoc(tok, project, path) {
  const res = await fetch(fsUrl(project, path), {
    headers: { Authorization: `Bearer ${tok}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${project}/${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function listVersions(tok, project, artId) {
  const url = `${fsUrl(project, `cfg_articulos/${artId}/versiones`)}?pageSize=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
  if (!res.ok) throw new Error(`LIST versiones ${artId}: ${res.status}`);
  const data = await res.json();
  return data.documents || [];
}

/** Patch fields (merge). mask = array of field paths. */
async function patchDoc(tok, project, path, fields, mask) {
  const qs = mask.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join("&");
  const res = await fetch(`${fsUrl(project, path)}?${qs}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tok}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`PATCH ${project}/${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Full create/overwrite document. */
async function writeDoc(tok, project, path, document) {
  // Firestore REST create: PATCH without mask creates; for overwrite use patch with all fields
  // Easiest: PATCH with document body and updateMask of all top-level keys
  const fields = document.fields || document;
  const mask = Object.keys(fields);
  return patchDoc(tok, project, path, fields, mask);
}

function str(v) {
  return { stringValue: String(v) };
}
function bool(v) {
  return { booleanValue: Boolean(v) };
}
function int(v) {
  return { integerValue: String(Math.floor(Number(v))) };
}
function arrStr(vals) {
  return {
    arrayValue: {
      values: vals.map((v) => ({ stringValue: String(v) })),
    },
  };
}

async function main() {
  const tok = token();
  console.log(`[familia64] sync → ${DEV}`);

  // 1) Copy 64-B half from prod if missing in -dev
  const halfBDev = await getDoc(tok, DEV, `cfg_articulos/${ART_B_HALF}`);
  if (!halfBDev) {
    console.log(`[familia64] copiando ${ART_B_HALF} prod → -dev`);
    const coreProd = await getDoc(tok, PROD, `cfg_articulos/${ART_B_HALF}`);
    if (!coreProd) throw new Error("64-B ½ carga no existe en prod");
    await writeDoc(tok, DEV, `cfg_articulos/${ART_B_HALF}`, coreProd);
    const vers = await listVersions(tok, PROD, ART_B_HALF);
    for (const ver of vers) {
      const verId = ver.name.split("/").pop();
      await writeDoc(tok, DEV, `cfg_articulos/${ART_B_HALF}/versiones/${verId}`, ver);
      console.log(`  · versión ${verId}`);
    }
  } else {
    console.log(`[familia64] ${ART_B_HALF} ya existe en -dev`);
  }

  // 2) Align 64-A half version topes/circuito with prod published version
  const coreAHalfProd = await getDoc(tok, PROD, `cfg_articulos/${ART_A_HALF}`);
  const coreAHalfDev = await getDoc(tok, DEV, `cfg_articulos/${ART_A_HALF}`);
  if (!coreAHalfProd || !coreAHalfDev) throw new Error("Falta 64-A ½ carga en prod o -dev");
  const verIdAHalf = coreAHalfProd.fields.version_actual_id.stringValue;
  const verProd = await getDoc(tok, PROD, `cfg_articulos/${ART_A_HALF}/versiones/${verIdAHalf}`);
  const verDev = await getDoc(tok, DEV, `cfg_articulos/${ART_A_HALF}/versiones/${verIdAHalf}`);
  if (!verProd) throw new Error("versión prod 64-A ½ no encontrada");
  if (!verDev) {
    console.log(`[familia64] creando versión ${verIdAHalf} de 64-A ½ en -dev`);
    await writeDoc(tok, DEV, `cfg_articulos/${ART_A_HALF}/versiones/${verIdAHalf}`, verProd);
  } else {
    // Patch topes cupo + workflow circuito from prod
    const topes = verProd.fields.bloque_topes_plazos_computo;
    const wf = verProd.fields.bloque_workflow_sla_cobertura;
    console.log(`[familia64] alineando cupo/circuito 64-A ½ con prod (${verIdAHalf})`);
    await patchDoc(
      tok,
      DEV,
      `cfg_articulos/${ART_A_HALF}/versiones/${verIdAHalf}`,
      {
        bloque_topes_plazos_computo: topes,
        bloque_workflow_sla_cobertura: wf,
        bloque_elegibilidad_filtros: verProd.fields.bloque_elegibilidad_filtros,
      },
      [
        "bloque_topes_plazos_computo",
        "bloque_workflow_sla_cobertura",
        "bloque_elegibilidad_filtros",
      ],
    );
  }
  // Ensure version_actual_id matches
  await patchDoc(
    tok,
    DEV,
    `cfg_articulos/${ART_A_HALF}`,
    { version_actual_id: str(verIdAHalf), activo: bool(true) },
    ["version_actual_id", "activo"],
  );

  // 3) Set familia_64_par_articulo_id on all four
  for (const [conGoce, sinGoce] of PAIRS) {
    console.log(`[familia64] par ${conGoce} ↔ ${sinGoce}`);
    await patchDoc(
      tok,
      DEV,
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
      DEV,
      `cfg_articulos/${sinGoce}`,
      {
        familia_64_par_articulo_id: str(conGoce),
        es_sin_goce: bool(true),
        activo: bool(true),
      },
      ["familia_64_par_articulo_id", "es_sin_goce", "activo"],
    );
  }

  // Verify
  for (const id of [ART_A, ART_B, ART_A_HALF, ART_B_HALF]) {
    const d = await getDoc(tok, DEV, `cfg_articulos/${id}`);
    const par = d?.fields?.familia_64_par_articulo_id?.stringValue;
    const sin = d?.fields?.es_sin_goce?.booleanValue;
    const cod = d?.fields?.codigo?.stringValue;
    const verId = d?.fields?.version_actual_id?.stringValue;
    const ver = await getDoc(tok, DEV, `cfg_articulos/${id}/versiones/${verId}`);
    const cupo = ver?.fields?.bloque_topes_plazos_computo?.mapValue?.fields?.cupo_dias_por_ciclo?.integerValue;
    const esc =
      ver?.fields?.bloque_elegibilidad_filtros?.mapValue?.fields?.escalafon_ids?.arrayValue?.values
        ?.map((x) => x.stringValue)
        ?.join(",") || "";
    console.log(`OK ${cod} | par=${par} | sin_goce=${sin} | cupo=${cupo} | esc=${esc}`);
  }

  console.log("[familia64] listo. Deploy functions -dev para listar/cruce con el nuevo módulo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
