"use strict";

const RX_PER = /^per_/i;
const RX_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function buildAsiDocumentId(personaId, fechaYmd) {
  const pid = String(personaId || "").trim();
  const ymd = String(fechaYmd || "").trim().slice(0, 10);
  if (!RX_PER.test(pid) || !RX_YMD.test(ymd)) return "";
  return `asi_${pid}_${ymd.replace(/-/g, "")}`;
}

function buildVisDocumentId(personaId, fechaYmd) {
  const pid = String(personaId || "").trim();
  const m = RX_YMD.exec(String(fechaYmd || "").trim().slice(0, 10));
  if (!RX_PER.test(pid) || !m) return "";
  return `vis_${m[1]}_${m[2]}_per_${pid.replace(/^per_/i, "")}`;
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
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
  iterarYmdInclusive,
};
