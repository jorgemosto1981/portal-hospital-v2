"use strict";

/**
 * Gate V2: Turno/Régimen horario para Motor de Solicitudes (Patrón C).
 *
 * Reemplaza la lectura directa de capa_teorica/planificacion_mensual_rotativa
 * por resolverTurnoDia, agregando:
 *   - Check SIN_REGIMEN_HORARIO
 *   - Check SIN_TURNO_DIA
 *   - Cálculo de horas (jornada completa vs. parcial)
 *   - Validación de rango horario intra-día
 *   - Enriquecimiento de snapshot con datos del turno
 */

const { resolverTurnoDia } = require("../asistencia/resolverTurnoDia");
const { iterarYmdInclusive } = require("./mdcRdaDocumentIds");

const CODIGO_SIN_REGIMEN = "SIN_REGIMEN_HORARIO";
const CODIGO_SIN_TURNO = "SIN_TURNO_DIA";
const CODIGO_HORARIO_FUERA = "HORARIO_FUERA_DE_TURNO";
const CODIGO_HORARIO_EXCEDE = "HORARIO_EXCEDE_TURNO";

/**
 * Convierte "HH:MM" a minutos desde medianoche.
 * @param {string} hhmm
 * @returns {number}
 */
function hhmmToMin(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return -1;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

/**
 * Verifica si dos rangos horarios (en minutos) se solapan.
 * Soporta cruces de medianoche.
 */
function rangosHorariosSeSolapan(aIni, aFin, bIni, bFin) {
  if (aIni < 0 || aFin < 0 || bIni < 0 || bFin < 0) return false;
  if (aIni <= aFin && bIni <= bFin) {
    return aIni < bFin && bIni < aFin;
  }
  return true;
}

/**
 * Validación completa de turno/régimen para un rango de fechas.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta?: string,
 *   grupo_trabajo_id?: string,
 *   es_jornada_completa?: boolean,
 *   hora_inicio?: string,
 *   hora_fin?: string,
 *   horas_solicitadas?: number,
 * }} input
 * @returns {Promise<{
 *   ok: boolean,
 *   codigo?: string,
 *   mensaje?: string,
 *   warnings: Array<{codigo: string, mensaje: string, fecha?: string}>,
 *   turnos_dia: object[],
 *   horas_efectivas_total: number,
 *   snapshot_turno: object,
 * }>}
 */
async function validarTurnoRegimenParaSolicitud(db, input) {
  const personaId = String(input.persona_id || "").trim();
  const desde = String(input.fecha_desde || "").slice(0, 10);
  const hasta = String(input.fecha_hasta || desde).slice(0, 10);
  const grupoId = input.grupo_trabajo_id || undefined;
  const esJornadaCompleta = input.es_jornada_completa !== false;
  const horaInicio = input.hora_inicio || null;
  const horaFin = input.hora_fin || null;
  const horasSolicitadas = Number(input.horas_solicitadas);

  const dias = iterarYmdInclusive(desde, hasta);
  const turnosDia = [];
  const warnings = [];
  let horasTotal = 0;
  let primerTurno = null;

  for (const ymd of dias) {
    let resultado;
    try {
      resultado = await resolverTurnoDia({ personaId, fecha: ymd, grupoId });
    } catch {
      return {
        ok: false,
        codigo: CODIGO_SIN_REGIMEN,
        mensaje: `No se pudo resolver el turno para ${ymd}: el agente no tiene régimen horario asignado en su grupo laboral vigente.`,
        warnings: [],
        turnos_dia: turnosDia,
        horas_efectivas_total: 0,
        snapshot_turno: {},
      };
    }

    if (!resultado || resultado.tipo_dia === "sin_turno") {
      return {
        ok: false,
        codigo: CODIGO_SIN_TURNO,
        mensaje: `No hay turno planificado para ${ymd}. Contacte a su jefatura para regularizar la planificación.`,
        warnings,
        turnos_dia: turnosDia,
        horas_efectivas_total: horasTotal,
        snapshot_turno: {},
      };
    }

    const turno = resultado.turno_teorico || {};
    const horasDia = esJornadaCompleta
      ? (turno.horas_efectivas || resultado.horas_efectivas_total || 0)
      : (Number.isFinite(horasSolicitadas) && horasSolicitadas > 0 ? horasSolicitadas : 0);

    horasTotal += horasDia;

    if (!esJornadaCompleta && horaInicio && horaFin && turno.ingreso && turno.egreso) {
      const solIni = hhmmToMin(horaInicio);
      const solFin = hhmmToMin(horaFin);
      const turIni = hhmmToMin(turno.ingreso);
      const turFin = hhmmToMin(turno.egreso);

      if (!rangosHorariosSeSolapan(solIni, solFin, turIni, turFin)) {
        warnings.push({
          codigo: CODIGO_HORARIO_FUERA,
          mensaje: `La franja solicitada (${horaInicio}-${horaFin}) está fuera del turno teórico (${turno.ingreso}-${turno.egreso}) en ${ymd}.`,
          fecha: ymd,
        });
      }

      if (solFin > turFin && solIni >= turIni && !resultado.cruza_medianoche) {
        warnings.push({
          codigo: CODIGO_HORARIO_EXCEDE,
          mensaje: `La franja solicitada excede el egreso del turno teórico (${turno.egreso}) en ${ymd}.`,
          fecha: ymd,
        });
      }
    }

    turnosDia.push({
      fecha: ymd,
      tipo_dia: resultado.tipo_dia,
      turno_teorico: turno,
      horas_efectivas_dia: horasDia,
      es_nocturno: resultado.es_nocturno || false,
      cruza_medianoche: resultado.cruza_medianoche || false,
      es_feriado: resultado.es_feriado || false,
      origen: resultado.origen,
    });

    if (!primerTurno) primerTurno = resultado;
  }

  const snapshotTurno = {
    horas_jornada_total: horasTotal,
    dias_evaluados: dias.length,
    es_jornada_completa: esJornadaCompleta,
    primer_turno: primerTurno ? {
      tipo_dia: primerTurno.tipo_dia,
      ingreso: primerTurno.turno_teorico?.ingreso || null,
      egreso: primerTurno.turno_teorico?.egreso || null,
      horas_efectivas: primerTurno.turno_teorico?.horas_efectivas || null,
      es_nocturno: primerTurno.es_nocturno || false,
      cruza_medianoche: primerTurno.cruza_medianoche || false,
      origen: primerTurno.origen,
      regimen_horario_id: primerTurno.regimen_horario_id || null,
    } : null,
  };

  return {
    ok: true,
    warnings,
    turnos_dia: turnosDia,
    horas_efectivas_total: horasTotal,
    snapshot_turno: snapshotTurno,
  };
}

/**
 * Validación de superposición intra-día con soporte horario.
 * Dos solicitudes en el mismo día NO colisionan si sus franjas horarias no se solapan.
 *
 * @param {{
 *   fecha_desde_a: string, fecha_hasta_a: string,
 *   hora_inicio_a?: string, hora_fin_a?: string,
 *   es_jornada_completa_a?: boolean,
 *   fecha_desde_b: string, fecha_hasta_b: string,
 *   hora_inicio_b?: string, hora_fin_b?: string,
 *   es_jornada_completa_b?: boolean,
 * }} input
 * @returns {{ colisiona: boolean, fecha_colision?: string }}
 */
function validarSuperposicionIntraDia(input) {
  const diasA = new Set(iterarYmdInclusive(
    String(input.fecha_desde_a || "").slice(0, 10),
    String(input.fecha_hasta_a || input.fecha_desde_a || "").slice(0, 10),
  ));
  const diasB = iterarYmdInclusive(
    String(input.fecha_desde_b || "").slice(0, 10),
    String(input.fecha_hasta_b || input.fecha_desde_b || "").slice(0, 10),
  );

  for (const ymd of diasB) {
    if (!diasA.has(ymd)) continue;

    const jcA = input.es_jornada_completa_a !== false;
    const jcB = input.es_jornada_completa_b !== false;

    if (jcA || jcB) {
      return { colisiona: true, fecha_colision: ymd };
    }

    const aIni = hhmmToMin(input.hora_inicio_a);
    const aFin = hhmmToMin(input.hora_fin_a);
    const bIni = hhmmToMin(input.hora_inicio_b);
    const bFin = hhmmToMin(input.hora_fin_b);

    if (aIni < 0 || aFin < 0 || bIni < 0 || bFin < 0) {
      return { colisiona: true, fecha_colision: ymd };
    }

    if (rangosHorariosSeSolapan(aIni, aFin, bIni, bFin)) {
      return { colisiona: true, fecha_colision: ymd };
    }
  }

  return { colisiona: false };
}

module.exports = {
  validarTurnoRegimenParaSolicitud,
  validarSuperposicionIntraDia,
  hhmmToMin,
  rangosHorariosSeSolapan,
  CODIGO_SIN_REGIMEN,
  CODIGO_SIN_TURNO,
  CODIGO_HORARIO_FUERA,
  CODIGO_HORARIO_EXCEDE,
};
