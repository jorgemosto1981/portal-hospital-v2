/**
 * Colecciones cfg_* del configurador de artículos (catálogos de FK / listas).
 * Fuente: docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json + diccionario §2.
 *
 * NO incluye:
 * - cfg_articulos (+ subcolección versiones) → sync dedicado
 * - cfg_etapa1 → runtime / allowlist por entorno
 * - cfg_cie10 → volumen alto; import aparte (scripts/import-cie10.mjs)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEED_PATH = join(repoRoot, "docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json");

/** @type {string[]} */
let fromSeed = [];
try {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  fromSeed = Object.keys(seed).filter((k) => k.startsWith("cfg_"));
} catch {
  fromSeed = [];
}

/** Catálogos adicionales referenciados por artículos pero fuera del JSON de semilla. */
const EXTRA_CFG_CATALOGS = [
  "cfg_estado_bolsa_saldo",
  "cfg_fechas_cierre_ciclo",
  "cfg_tipo_evento",
];

/** @type {readonly string[]} */
export const CFG_CATALOG_COLLECTIONS = Object.freeze(
  [...new Set([...fromSeed, ...EXTRA_CFG_CATALOGS])].sort(),
);

export const CFG_ARTICULOS_COLLECTION = "cfg_articulos";
export const CFG_ARTICULOS_VERSIONES_SUB = "versiones";

/** Colecciones que nunca se sincronizan prod → −dev con este script. */
export const CFG_SYNC_EXCLUDED = Object.freeze([
  "cfg_etapa1",
  "cfg_cie10",
]);
