"use strict";

const { hlgCuentaParaSolapeOperativo } = require("../laboral/hlgValidacionesCore");
const { diaMesKeyDesdeYmd } = require("./mdcRdaDocumentIds");

function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function rangoMes(anio, mes) {
  const y = Number(anio);
  const m = Number(mes);
  const ultimo = diasEnMes(y, m);
  const mm = String(m).padStart(2, "0");
  return {
    anio: y,
    mes: m,
    primerDia: `${y}-${mm}-01`,
    ultimoDia: `${y}-${mm}-${String(ultimo).padStart(2, "0")}`,
    diasMes: ultimo,
  };
}

function maxYmd(a, b) {
  return String(a || "").slice(0, 10) >= String(b || "").slice(0, 10) ? String(a).slice(0, 10) : String(b).slice(0, 10);
}

function minYmd(a, b) {
  return String(a || "").slice(0, 10) <= String(b || "").slice(0, 10) ? String(a).slice(0, 10) : String(b).slice(0, 10);
}

function buildFilaId(personaId, hlgId) {
  return `${String(personaId || "").trim()}__${String(hlgId || "").trim()}`;
}

/**
 * HLg operativa solapa el mes calendario [primerDia, ultimoDia].
 * @param {{ fecha_inicio: string, fecha_fin: string|null, activo?: boolean, eliminado?: boolean, estado?: string }} hlg
 * @param {{ primerDia: string, ultimoDia: string }} rango
 */
function hlgSolapaMes(hlg, rango) {
  if (!hlgCuentaParaSolapeOperativo(hlg)) return false;
  const fi = String(hlg.fecha_inicio || "").slice(0, 10);
  const ff = hlg.fecha_fin ? String(hlg.fecha_fin).slice(0, 10) : null;
  if (fi && fi > rango.ultimoDia) return false;
  if (ff && ff < rango.primerDia) return false;
  return Boolean(fi);
}

/**
 * Segmenta HLg en tramos visibles del mes (1 fila por tramo, sin deduplicar persona).
 * @param {Array<{ hlg_id: string, persona_id: string, grupo_de_trabajo_id: string, regimen_horario_id?: string|null, fecha_inicio: string, fecha_fin?: string|null }>} hlgs
 * @param {number} anio
 * @param {number} mes
 */
function hlgSegmentosMes(hlgs, anio, mes) {
  const rango = rangoMes(anio, mes);
  const out = [];

  for (const h of hlgs || []) {
    if (!hlgSolapaMes(h, rango)) continue;
    const fi = String(h.fecha_inicio || "").slice(0, 10);
    const ff = h.fecha_fin ? String(h.fecha_fin).slice(0, 10) : rango.ultimoDia;
    const rawNivel = h.nivel_jerarquico;
    const nivelJerarquico =
      rawNivel === null || rawNivel === undefined || rawNivel === ""
        ? null
        : Number(rawNivel);
    out.push({
      fila_id: buildFilaId(h.persona_id, h.hlg_id),
      persona_id: String(h.persona_id || ""),
      hlg_id: String(h.hlg_id || ""),
      grupo_de_trabajo_id: String(h.grupo_de_trabajo_id || ""),
      regimen_horario_id: h.regimen_horario_id || null,
      nivel_jerarquico: Number.isFinite(nivelJerarquico) ? nivelJerarquico : null,
      vigente_desde: maxYmd(fi, rango.primerDia),
      vigente_hasta: minYmd(ff, rango.ultimoDia),
      fecha_inicio: h.fecha_inicio,
      fecha_fin: h.fecha_fin ?? null,
    });
  }

  out.sort((a, b) => {
    const la = String(a.persona_label_sort || a.persona_id || "");
    const lb = String(b.persona_label_sort || b.persona_id || "");
    if (la !== lb) return la.localeCompare(lb, "es");
    return String(a.vigente_desde || "").localeCompare(String(b.vigente_desde || ""), "es");
  });

  return out;
}

/**
 * Deja solo celdas cuyo día cae dentro del tramo [vigente_desde, vigente_hasta].
 * Días fuera del tramo se omiten (vacío positivo en UI).
 * @param {Record<string, unknown>} dias
 * @param {string} vigenteDesde YYYY-MM-DD
 * @param {string} vigenteHasta YYYY-MM-DD
 */
function filtrarDiasPorTramo(dias, vigenteDesde, vigenteHasta) {
  const vd = String(vigenteDesde || "").slice(0, 10);
  const vh = String(vigenteHasta || "").slice(0, 10);
  if (!vd || !vh) return {};

  const out = {};
  for (const [key, cell] of Object.entries(dias || {})) {
    const dayPart = String(key).padStart(2, "0");
    const ymd = `${vd.slice(0, 7)}-${dayPart}`;
    if (ymd >= vd && ymd <= vh) {
      out[diaMesKeyDesdeYmd(ymd) || dayPart] = cell;
    }
  }
  return out;
}

function buildPersonaLabelConCarga(baseLabel, cargaHoras) {
  const base = String(baseLabel || "").trim();
  if (cargaHoras == null || !Number.isFinite(Number(cargaHoras))) return base;
  const n = Number(cargaHoras);
  const h = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  return `${base} · ${h} hs`;
}

/**
 * Limita tramos por persona_id únicos (MAX agentes), conservando todos los tramos de cada persona incluida.
 * @param {object[]} tramos
 * @param {number} maxPersonas
 */
function limitarTramosPorPersonasUnicas(tramos, maxPersonas) {
  const lista = Array.isArray(tramos) ? tramos : [];
  const personaIds = [...new Set(lista.map((t) => t.persona_id).filter(Boolean))];
  const truncado = personaIds.length > maxPersonas;
  const permitidas = new Set(personaIds.slice(0, maxPersonas));
  return {
    tramos: lista.filter((t) => permitidas.has(t.persona_id)),
    total_personas_unicas: personaIds.length,
    truncado,
  };
}

module.exports = {
  rangoMes,
  buildFilaId,
  hlgSolapaMes,
  hlgSegmentosMes,
  filtrarDiasPorTramo,
  buildPersonaLabelConCarga,
  limitarTramosPorPersonasUnicas,
};
