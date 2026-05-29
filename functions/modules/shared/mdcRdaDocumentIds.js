"use strict";

const RX_PER = /^per_/i;
const RX_GDT = /^gdt_/i;
const RX_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function esFechaYmdValida(match) {
  if (!match) return false;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const ultimoDia = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= ultimoDia;
}

const CODIGO_PARAMS_INVALIDOS = "PARAMS_INVALIDOS";

/**
 * @param {string} mensaje
 * @returns {Error & { code: string }}
 */
function paramsInvalidosError(mensaje) {
  const err = new Error(String(mensaje || "Parámetros inválidos."));
  err.code = CODIGO_PARAMS_INVALIDOS;
  return err;
}

function buildAsiDocumentId(personaId, fechaYmd) {
  const pid = String(personaId || "").trim();
  const ymd = String(fechaYmd || "").trim().slice(0, 10);
  if (!RX_PER.test(pid) || !RX_YMD.test(ymd)) return "";
  return `asi_${pid}_${ymd.replace(/-/g, "")}`;
}

/**
 * Vista mensual acotada por bounded context (grupo de trabajo).
 * @param {string} personaId per_*
 * @param {string} fechaYmd YYYY-MM-DD (cualquier día del mes)
 * @param {string} grupoTrabajoId gdt_* — obligatorio
 * @returns {string} vis_{YYYY}_{MM}_per_{ulid}_gdt_{ulid}
 */
function buildVisDocumentId(personaId, fechaYmd, grupoTrabajoId) {
  const pid = String(personaId || "").trim();
  const gdt = String(grupoTrabajoId || "").trim();
  const m = RX_YMD.exec(String(fechaYmd || "").trim().slice(0, 10));

  if (!RX_PER.test(pid) || !esFechaYmdValida(m)) {
    throw paramsInvalidosError("persona_id o fechaYmd inválidos para buildVisDocumentId.");
  }
  if (!RX_GDT.test(gdt)) {
    throw paramsInvalidosError("grupo_trabajo_id requerido (gdt_*) para buildVisDocumentId.");
  }

  const perUlid = pid.replace(/^per_/i, "");
  const gdtUlid = gdt.replace(/^gdt_/i, "");
  return `vis_${m[1]}_${m[2]}_per_${perUlid}_gdt_${gdtUlid}`;
}

function diaMesKeyDesdeYmd(fechaYmd) {
  const m = RX_YMD.exec(String(fechaYmd || "").trim().slice(0, 10));
  return m ? m[3] : "";
}

function iterarYmdInclusive(desdeYmd, hastaYmd) {
  const desde = String(desdeYmd || "").slice(0, 10);
  const hasta = String(hastaYmd || desde).slice(0, 10);
  if (!RX_YMD.test(desde)) return [];
  const end = RX_YMD.test(hasta) ? hasta : desde;
  const out = [];
  let cur = new Date(`${desde}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime())) return [desde];
  while (cur.getTime() <= endD.getTime()) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

module.exports = {
  CODIGO_PARAMS_INVALIDOS,
  paramsInvalidosError,
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
  iterarYmdInclusive,
};
