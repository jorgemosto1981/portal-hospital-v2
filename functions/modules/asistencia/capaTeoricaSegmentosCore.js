"use strict";

/**
 * Construcción de capa_teorica.segmentos[] y resumen derivado.
 * Contrato: docs/v2/CAPA_TEORICA_SEGMENTOS_V2.md
 */

const { civilDateInZonaToUtcAnchorMs } = require("../shared/fechaInstitucionalBa");
const { isoToHhmmInstitucional } = require("../shared/horarioInstitucionalDisplay");
const { resolverEventoEnIndice } = require("../shared/calendarInstitucionalCore");
const {
  CFG_CDC_HABIL,
  CFG_CDC_FIN_DE_SEMANA,
  CFG_CDC_FERIADO,
  CFG_CDC_ASUETO,
  CFG_CDC_INSTITUCIONAL,
} = require("../shared/cfgAsistenciaTurnosIds");

/**
 * @param {string} fechaYmd
 * @param {string} hhmm
 * @param {number} [extraDayOffset]
 * @returns {string} ISO UTC
 */
function ymdHoraToIso(fechaYmd, hhmm, extraDayOffset = 0) {
  const [y, mo, d] = fechaYmd.split("-").map(Number);
  const [h, mi] = String(hhmm || "00:00").split(":").map(Number);
  const anchor = civilDateInZonaToUtcAnchorMs(y, mo, d);
  const ms = anchor + extraDayOffset * 86400000 + (h * 60 + mi) * 60 * 1000;
  return new Date(ms).toISOString();
}

/**
 * @param {string} turnoIdRaw — ej. "M" o "M+T+N"
 * @returns {string[]}
 */
function parseTurnoCompuestoIds(turnoIdRaw) {
  const raw = String(turnoIdRaw || "").trim();
  if (!raw) return [];
  return raw.split("+").map((s) => s.trim()).filter(Boolean);
}

function tokenizeLabel(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function canonicalizarTokenTurno(regimen, tokenRaw) {
  const token = String(tokenRaw || "").trim();
  if (!token) return "";
  const list = Array.isArray(regimen?.turnos_disponibles) ? regimen.turnos_disponibles : [];
  const direct = list.find((t) => String(t?.turno_id || "").trim() === token);
  if (direct?.turno_id) return String(direct.turno_id);

  const tokenNorm = tokenizeLabel(token);
  if (!tokenNorm) return "";
  for (const turno of list) {
    const turnoId = String(turno?.turno_id || "").trim();
    if (!turnoId) continue;
    const aliases = [
      turnoId,
      turno?.codigo_interno,
      turno?.codigo,
      turno?.sigla,
      turno?.abreviatura,
      turno?.etiqueta,
      turno?.titulo_ui,
      turno?.nombre,
    ].map(tokenizeLabel).filter(Boolean);
    if (aliases.includes(tokenNorm)) return turnoId;
    if ((tokenNorm === "m" || tokenNorm === "manana") && aliases.some((a) => a.includes("manana"))) return turnoId;
    if ((tokenNorm === "t" || tokenNorm === "tarde") && aliases.some((a) => a.includes("tarde"))) return turnoId;
    if ((tokenNorm === "n" || tokenNorm === "noche") && aliases.some((a) => a.includes("noche"))) return turnoId;
  }
  return token;
}

/**
 * @param {object} regimen
 * @param {string} turnoId
 * @returns {object|null}
 */
function buscarTurnoEnRegimen(regimen, turnoId) {
  const list = regimen?.turnos_disponibles || [];
  return list.find((t) => t.turno_id === turnoId) || null;
}

/**
 * @param {object} params
 * @param {string} params.fechaYmd
 * @param {string} params.personaId
 * @param {object} params.regimen
 * @param {string|null} params.turnoCompuestoId
 * @param {string} params.origen_segmento
 * @returns {object[]}
 */
function buildSegmentosDesdeTurnoCompuesto({
  fechaYmd,
  personaId,
  regimen,
  turnoCompuestoId,
  origen_segmento = "plan_base",
}) {
  const idsRaw = parseTurnoCompuestoIds(turnoCompuestoId);
  const ids = idsRaw.map((id) => canonicalizarTokenTurno(regimen, id));
  if (!ids.length) return [];

  const segmentos = [];
  for (const segId of ids) {
    const turno = buscarTurnoEnRegimen(regimen, segId);
    if (!turno || !turno.ingreso || !turno.egreso) continue;
    const cruza = turno.egreso <= turno.ingreso;
    const extraEnd = cruza ? 1 : 0;
    const ingresoIso = ymdHoraToIso(fechaYmd, turno.ingreso, 0);
    const egresoIso = ymdHoraToIso(fechaYmd, turno.egreso, extraEnd);
    const [y, mo, d] = fechaYmd.split("-").map(Number);
    const fechaFinReal = cruza
      ? new Date(civilDateInZonaToUtcAnchorMs(y, mo, d) + 86400000).toISOString().slice(0, 10)
      : fechaYmd;

    segmentos.push({
      segmento_id: segId,
      ingreso_iso: ingresoIso,
      egreso_iso: egresoIso,
      fecha_base: fechaYmd,
      fecha_fin_real: fechaFinReal,
      cruza_medianoche: cruza,
      persona_titular_id: personaId,
      persona_ejecutante_id: personaId,
      origen_segmento,
      tipo_compensacion_id: null,
      flags_liquidacion: turno.metadata?.flags_liquidacion || null,
    });
  }

  segmentos.sort((a, b) => a.ingreso_iso.localeCompare(b.ingreso_iso));
  return segmentos;
}

/**
 * @param {object[]} segmentos
 * @returns {{ ingreso_teorico_final: string|null, egreso_teorico_final: string|null, horas_teoricas_totales: number, tiene_huecos: boolean, turno_compuesto_id: string|null }}
 */
function computeResumenDesdeSegmentos(segmentos) {
  if (!segmentos?.length) {
    return {
      ingreso_teorico_final: null,
      egreso_teorico_final: null,
      horas_teoricas_totales: 0,
      tiene_huecos: false,
      turno_compuesto_id: null,
    };
  }
  const ingresos = segmentos.map((s) => s.ingreso_iso).filter(Boolean);
  const egresos = segmentos.map((s) => s.egreso_iso).filter(Boolean);
  let horas = 0;
  for (const s of segmentos) {
    const t0 = new Date(s.ingreso_iso).getTime();
    const t1 = new Date(s.egreso_iso).getTime();
    if (t1 > t0) horas += (t1 - t0) / 3600000;
  }
  let tieneHuecos = false;
  for (let i = 1; i < segmentos.length; i++) {
    const prevEnd = new Date(segmentos[i - 1].egreso_iso).getTime();
    const curStart = new Date(segmentos[i].ingreso_iso).getTime();
    if (curStart > prevEnd + 60000) {
      tieneHuecos = true;
      break;
    }
  }
  const turno_compuesto_id = segmentos.map((s) => s.segmento_id).join("+");
  return {
    ingreso_teorico_final: ingresos.length ? ingresos.sort()[0] : null,
    egreso_teorico_final: egresos.length ? egresos.sort().pop() : null,
    horas_teoricas_totales: Math.round(horas * 100) / 100,
    tiene_huecos: tieneHuecos,
    turno_compuesto_id,
  };
}

/**
 * @param {string} fechaYmd
 * @param {object|null} indiceCalendario
 * @returns {{ clasificacion_dia_calendario_id: string, calendario_evento_ref: string|null, multiplicador_institucional: number|null, es_feriado: boolean }}
 */
function resolveClasificacionDiaCalendario(fechaYmd, indiceCalendario) {
  const evento = indiceCalendario ? resolverEventoEnIndice(fechaYmd, indiceCalendario) : null;
  if (evento) {
    const tipo = String(evento.tipo || "feriado").toLowerCase();
    let id = CFG_CDC_FERIADO;
    if (tipo === "asueto") id = CFG_CDC_ASUETO;
    else if (tipo === "institucional") id = CFG_CDC_INSTITUCIONAL;
    return {
      clasificacion_dia_calendario_id: id,
      calendario_evento_ref: fechaYmd,
      multiplicador_institucional: typeof evento.multiplicador === "number" ? evento.multiplicador : 1,
      es_feriado: true,
    };
  }
  const [y, mo, d] = fechaYmd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const esFinDeSemana = dow === 0 || dow === 6;
  return {
    clasificacion_dia_calendario_id: esFinDeSemana ? CFG_CDC_FIN_DE_SEMANA : CFG_CDC_HABIL,
    calendario_evento_ref: null,
    multiplicador_institucional: null,
    es_feriado: false,
  };
}

function contarBloquesContinuos({ segmentos, personaId }) {
  const pid = String(personaId || "").trim();
  const propios = (Array.isArray(segmentos) ? segmentos : [])
    .filter((s) => String(s?.persona_ejecutante_id || "").trim() === pid)
    .sort((a, b) => String(a?.ingreso_iso || "").localeCompare(String(b?.ingreso_iso || "")));

  let bloques = 0;
  let ultimoEgreso = null;
  for (const seg of propios) {
    const ingreso = String(seg?.ingreso_iso || "");
    const egreso = String(seg?.egreso_iso || "");
    if (!ultimoEgreso || ultimoEgreso !== ingreso) {
      bloques += 1;
    }
    ultimoEgreso = egreso;
  }
  return bloques;
}

function calcularFichadasEsperadas({ segmentos, personaId, expectativasFichadaExtra }) {
  const extras = Array.isArray(expectativasFichadaExtra) ? expectativasFichadaExtra : [];
  const bloquesContinuos = contarBloquesContinuos({ segmentos, personaId });
  const fichadasBase = bloquesContinuos * 2;
  const fichadasExtra = extras.reduce((acc, ex) => {
    const n = Number(ex?.cantidad_fichadas_esperadas);
    return acc + (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0);
  }, 0);
  return fichadasBase + fichadasExtra;
}

/**
 * @param {object} params
 * @returns {object} capa_teorica segmentada
 */
function buildCapaTeoricaSegmentada({
  fechaYmd,
  personaId,
  regimen,
  tipo_dia,
  turnoCompuestoId,
  origen_segmento,
  indiceCalendario,
  segmentosOverride,
  expectativasFichadaExtra,
}) {
  const clasif = resolveClasificacionDiaCalendario(fechaYmd, indiceCalendario);
  let segmentos = segmentosOverride;
  if (!segmentos?.length && turnoCompuestoId && tipo_dia !== "franco" && tipo_dia !== "no_laborable") {
    segmentos = buildSegmentosDesdeTurnoCompuesto({
      fechaYmd,
      personaId,
      regimen,
      turnoCompuestoId,
      origen_segmento,
    });
  }
  const resumen = computeResumenDesdeSegmentos(segmentos || []);
  const primerSeg = segmentos?.[0];
  const expectativas = Array.isArray(expectativasFichadaExtra) ? expectativasFichadaExtra : [];
  const fichadasEsperadas = calcularFichadasEsperadas({
    segmentos: segmentos || [],
    personaId,
    expectativasFichadaExtra: expectativas,
  });
  return {
    fecha_base: fechaYmd,
    segmentos: segmentos || [],
    ...resumen,
    ...clasif,
    tipo_dia,
    turno_id: resumen.turno_compuesto_id || null,
    ingreso: primerSeg ? isoToHhmmInstitucional(primerSeg.ingreso_iso) : null,
    egreso: primerSeg ? isoToHhmmInstitucional(primerSeg.egreso_iso) : null,
    horas_efectivas: resumen.horas_teoricas_totales,
    expectativas_fichada_extra: expectativas,
    fichadas_esperadas: fichadasEsperadas,
  };
}

module.exports = {
  ymdHoraToIso,
  parseTurnoCompuestoIds,
  buildSegmentosDesdeTurnoCompuesto,
  computeResumenDesdeSegmentos,
  resolveClasificacionDiaCalendario,
  buildCapaTeoricaSegmentada,
  calcularFichadasEsperadas,
};
