/** @typedef {{ gdt: string; persona_id: string; fecha_ymd: string }} CellKeyParts */

const CELL_PREFIX = "cell";
const ROW_PREFIX = "row";
const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} gdt
 */
export function normalizeGdtId(gdt) {
  return String(gdt || "").trim();
}

/**
 * @param {string} persona_id
 */
export function normalizePersonaId(persona_id) {
  return String(persona_id || "").trim();
}

/**
 * @param {string} fecha_ymd
 */
export function normalizeFechaYmd(fecha_ymd) {
  return String(fecha_ymd || "").trim().slice(0, 10);
}

/**
 * @param {CellKeyParts | { gdt: string; persona_id: string; fecha_ymd: string }} parts
 * @returns {string}
 */
export function buildCellKey(parts) {
  const gdt = normalizeGdtId(parts.gdt);
  const persona_id = normalizePersonaId(parts.persona_id);
  const fecha_ymd = normalizeFechaYmd(parts.fecha_ymd);
  if (!gdt || !persona_id || !fecha_ymd) {
    throw new Error("buildCellKey: gdt, persona_id y fecha_ymd son obligatorios");
  }
  return `${CELL_PREFIX}|${gdt}|${persona_id}|${fecha_ymd}`;
}

/**
 * @param {string} key
 * @returns {CellKeyParts | null}
 */
export function parseCellKey(key) {
  const raw = String(key || "").trim();
  const parts = raw.split("|");
  if (parts.length !== 4 || parts[0] !== CELL_PREFIX) return null;
  const gdt = normalizeGdtId(parts[1]);
  const persona_id = normalizePersonaId(parts[2]);
  const fecha_ymd = normalizeFechaYmd(parts[3]);
  if (!gdt || !persona_id || !RX_YMD.test(fecha_ymd)) return null;
  return { gdt, persona_id, fecha_ymd };
}

/**
 * @param {CellKeyParts | string} a
 * @param {CellKeyParts | string} b
 */
export function cellKeyEquals(a, b) {
  const ka = typeof a === "string" ? parseCellKey(a) : a;
  const kb = typeof b === "string" ? parseCellKey(b) : b;
  if (!ka || !kb) return false;
  return (
    ka.gdt === kb.gdt
    && ka.persona_id === kb.persona_id
    && ka.fecha_ymd === kb.fecha_ymd
  );
}

/**
 * @param {{ gdt: string; periodo_ym: string; fila_id: string }} parts
 */
export function buildRowKey(parts) {
  const gdt = normalizeGdtId(parts.gdt);
  const periodo_ym = String(parts.periodo_ym || "").trim().slice(0, 7);
  const fila_id = String(parts.fila_id || "").trim();
  if (!gdt || !/^\d{4}-\d{2}$/.test(periodo_ym) || !fila_id) {
    throw new Error("buildRowKey: gdt, periodo_ym (YYYY-MM) y fila_id son obligatorios");
  }
  return `${ROW_PREFIX}|${gdt}|${periodo_ym}|${fila_id}`;
}

/**
 * @param {string} key
 */
export function parseRowKey(key) {
  const raw = String(key || "").trim();
  const parts = raw.split("|");
  if (parts.length !== 4 || parts[0] !== ROW_PREFIX) return null;
  const gdt = normalizeGdtId(parts[1]);
  const periodo_ym = String(parts[2] || "").trim();
  const fila_id = String(parts[3] || "").trim();
  if (!gdt || !/^\d{4}-\d{2}$/.test(periodo_ym) || !fila_id) return null;
  return { gdt, periodo_ym, fila_id };
}
