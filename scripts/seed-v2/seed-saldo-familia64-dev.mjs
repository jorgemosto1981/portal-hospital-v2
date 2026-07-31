/**
 * Check-in mínimo Art. 64 (par ADMIN) para un agente en −dev.
 * Uso:
 *   node scripts/seed-v2/seed-saldo-familia64-dev.mjs [persona_id]
 * Default: per_01KXGK9GXJ2HS55ZZC5QB65RG4 (Mosto)
 */
import { execSync } from "node:child_process";

const DEV = "portal-hospital-v2-dev";
const ART_A = "art_01KRNK10V10CH7W5M2W6V558GS";
const ART_B = "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ";
const VER_A = "ver_01KRNKNBXNBFC9HZN7CZJGPRDH";
const VER_B = "ver_01KRYEX13QN7VBPMFQFES1QHB4";
const ANIO = 2026;

const personaId = String(process.argv[2] || "per_01KXGK9GXJ2HS55ZZC5QB65RG4").trim();

function token() {
  return execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
}

function fsUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${DEV}/databases/(default)/documents/${path}`;
}

function int(n) {
  return { integerValue: String(Math.floor(Number(n))) };
}
function str(v) {
  return { stringValue: String(v) };
}
function tsNow() {
  return { timestampValue: new Date().toISOString() };
}

function bolsaPatronB(articuloId, versionId, cupo, consumido = 0) {
  const bolsaId = `bol_${articuloId}_${ANIO}`;
  const disponible = cupo - consumido;
  return {
    bolsaId,
    fields: {
      bolsa_id: str(bolsaId),
      articulo_id: str(articuloId),
      version_id: str(versionId),
      anio_origen: int(ANIO),
      anio_ciclo: int(ANIO),
      cupo: int(cupo),
      consumido: int(consumido),
      disponible: int(disponible),
      origen_saldo_id: str("cfg_os_interno"),
      ultima_actualizacion: tsNow(),
    },
  };
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
  if (!/^per_/i.test(personaId)) throw new Error("persona_id inválido");
  const tok = token();
  const salId = `sal_${ANIO}_${personaId}`;
  console.log(`[seed] ${DEV} / ${salId}`);

  // Cupos desde versión publicada (no hardcode conceptual: leemos cfg).
  const verA = await getDoc(tok, `cfg_articulos/${ART_A}/versiones/${VER_A}`);
  const verB = await getDoc(tok, `cfg_articulos/${ART_B}/versiones/${VER_B}`);
  const cupoA = Number(
    verA?.fields?.bloque_topes_plazos_computo?.mapValue?.fields?.cupo_dias_por_ciclo?.integerValue || 6,
  );
  const cupoB = Number(
    verB?.fields?.bloque_topes_plazos_computo?.mapValue?.fields?.cupo_dias_por_ciclo?.integerValue || 6,
  );

  const bA = bolsaPatronB(ART_A, VER_A, cupoA, 0);
  const bB = bolsaPatronB(ART_B, VER_B, cupoB, 0);

  const existing = await getDoc(tok, `saldos_articulo_agente/${salId}`);
  /** @type {Record<string, unknown>} */
  const bolsasFields = existing?.fields?.bolsas?.mapValue?.fields
    ? { ...existing.fields.bolsas.mapValue.fields }
    : {};
  bolsasFields[bA.bolsaId] = { mapValue: { fields: bA.fields } };
  bolsasFields[bB.bolsaId] = { mapValue: { fields: bB.fields } };

  await patchDoc(
    tok,
    `saldos_articulo_agente/${salId}`,
    {
      persona_id: str(personaId),
      anio_calendario: int(ANIO),
      bolsas: { mapValue: { fields: bolsasFields } },
      metadata: {
        mapValue: {
          fields: {
            ultima_sincronizacion: tsNow(),
            origen_seed: str("seed-saldo-familia64-dev"),
          },
        },
      },
    },
    ["persona_id", "anio_calendario", "bolsas", "metadata"],
  );

  console.log(`[seed] OK cupoA=${cupoA} cupoB=${cupoB} disponible=${cupoA}/${cupoB}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
