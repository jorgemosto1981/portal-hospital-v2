"use strict";

/**
 * Validaciones de calidad de negocio sobre planes de turno (US-9, etc.).
 * Sin dependencias Firestore — testeable en unit tests.
 */

const { HttpsError } = require("firebase-functions/v2/https");

const CODIGO_US9 = "PLT-US9-001";

function turnoIdValido(turnoId) {
  if (turnoId == null) return false;
  if (typeof turnoId !== "string") return String(turnoId).trim() !== "";
  return turnoId.trim() !== "";
}

/** @param {object|null|undefined} cel */
function celdaHuecoTurnoPlan(cel) {
  if (!cel || typeof cel !== "object") return false;
  const tipo = cel.tipo_dia;
  if (tipo !== "laborable" && tipo !== "guardia") return false;
  return !turnoIdValido(cel.turno_id);
}

/**
 * US-17: inventario sin lanzar (misma regla que US-9).
 * @param {Array<{ persona_id?: string, dias?: Record<string, object> }>} agentes
 * @returns {Array<{ persona_id: string, ymd: string, tipo_dia: string }>}
 */
function listarHuecosTurnoEnAgentes(agentes) {
  const out = [];
  if (!Array.isArray(agentes)) return out;
  for (const ag of agentes) {
    const personaId = ag && ag.persona_id ? String(ag.persona_id) : "?";
    const dias = ag && ag.dias && typeof ag.dias === "object" ? ag.dias : {};
    for (const [ymd, cel] of Object.entries(dias)) {
      if (!celdaHuecoTurnoPlan(cel)) continue;
      out.push({
        persona_id: personaId,
        ymd: String(ymd),
        tipo_dia: String(cel.tipo_dia),
      });
    }
  }
  return out;
}

/**
 * US-9: rechazar habilitación si laborable/guardia carece de turno_id.
 * @param {Array<{ persona_id?: string, hlg_id?: string, dias?: Record<string, object> }>} agentes
 * @param {{ celdaCuentaParaHuecos?: (ag: object, ymd: string) => boolean }} [options]
 */
function assertPlanSinHuecosTurno(agentes, options = {}) {
  const { celdaCuentaParaHuecos } = options || {};
  if (!Array.isArray(agentes) || agentes.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      `[${CODIGO_US9}] El plan contiene días laborables sin turno asignado (sin agentes en el plan).`,
    );
  }

  const huecos = [];
  for (const ag of agentes) {
    const personaId = ag && ag.persona_id ? String(ag.persona_id) : "?";
    const dias = ag && ag.dias && typeof ag.dias === "object" ? ag.dias : {};
    for (const [ymd, cel] of Object.entries(dias)) {
      if (celdaCuentaParaHuecos && !celdaCuentaParaHuecos(ag, ymd)) continue;
      if (!celdaHuecoTurnoPlan(cel)) continue;
      huecos.push({
        persona_id: personaId,
        ymd: String(ymd),
        tipo_dia: String(cel.tipo_dia),
      });
    }
  }
  if (huecos.length > 0) {
    const first = huecos[0];
    throw new HttpsError(
      "failed-precondition",
      `[${CODIGO_US9}] El plan contiene días laborables sin turno asignado (${first.persona_id} · ${first.ymd}).`,
    );
  }
}

module.exports = {
  CODIGO_US9,
  turnoIdValido,
  celdaHuecoTurnoPlan,
  listarHuecosTurnoEnAgentes,
  assertPlanSinHuecosTurno,
};
