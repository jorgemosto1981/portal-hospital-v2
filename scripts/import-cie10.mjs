/**
 * Normaliza catálogo CIE-10 (OPS/OMS o Datos Abiertos) a filas cfg_cie10 para seed.
 *
 * Entrada esperada: JSON array [{ codigo, descripcion }] o { entries: [...] }
 * o formato OMS simplificado [{ "code": "J00", "title": "..." }].
 *
 * Uso (raíz repo):
 *   node scripts/import-cie10.mjs
 *   node scripts/import-cie10.mjs --input ruta/al/cie10_v2024.json --out docs/v2/seeds/cie10/CIE10_IMPORTADO.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const inputPath =
  argValue("--input") || join(repoRoot, "docs/v2/seeds/cie10/CIE10_OPS_PILOTO.json");
const outPath =
  argValue("--out") || join(repoRoot, "docs/v2/seeds/cie10/CIE10_CFG_NORMALIZADO.json");

/**
 * @param {string} codigo
 */
function cfgIdDesdeCodigo(codigo) {
  const slug = String(codigo || "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `cfg_cie10_${slug.toLowerCase()}`;
}

/**
 * @param {unknown} raw
 */
function extraerFilas(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = /** @type {Record<string, unknown>} */ (raw);
    if (Array.isArray(o.entries)) return o.entries;
    if (Array.isArray(o.cie10_catalogo)) return o.cie10_catalogo;
  }
  throw new Error("Formato de entrada no reconocido (array o entries[]).");
}

/**
 * @param {Record<string, unknown>} row
 */
function normalizarFila(row) {
  const codigo = String(row.codigo || row.code || row.CODIGO || "").trim().toUpperCase();
  const descripcion = String(row.descripcion || row.title || row.DESCRIPCION || "").trim();
  if (!codigo || !descripcion) return null;
  return {
    id: cfgIdDesdeCodigo(codigo),
    codigo_interno: codigo,
    titulo_ui: descripcion,
    orden: 0,
    activo: true,
    vigente_desde: null,
    vigente_hasta: null,
  };
}

const raw = JSON.parse(readFileSync(inputPath, "utf8"));
const filasIn = extraerFilas(raw);
/** @type {Array<Record<string, unknown>>} */
const cfg_cie10 = [];
const vistos = new Set();
let orden = 10;

for (const row of filasIn) {
  if (!row || typeof row !== "object") continue;
  const norm = normalizarFila(/** @type {Record<string, unknown>} */ (row));
  if (!norm) continue;
  if (vistos.has(norm.id)) continue;
  vistos.add(norm.id);
  norm.orden = orden;
  orden += 10;
  cfg_cie10.push(norm);
}

if (!cfg_cie10.length) {
  console.error("Sin filas válidas tras normalizar.");
  process.exit(2);
}

mkdirSync(dirname(outPath), { recursive: true });
const payload = {
  _meta: {
    fuente: "OPS/OMS — normalizado por scripts/import-cie10.mjs",
    generado_en: new Date().toISOString(),
    entrada: inputPath,
    total: cfg_cie10.length,
  },
  cfg_cie10,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[import-cie10] ${cfg_cie10.length} filas → ${outPath}`);
