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

/**
 * US-9: rechazar habilitación si laborable/guardia carece de turno_id.
 * @param {Array<{ persona_id?: string, dias?: Record<string, object> }>} agentes
 */
function assertPlanSinHuecosTurno(agentes) {
  if (!Array.isArray(agentes) || agentes.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      `[${CODIGO_US9}] El plan contiene días laborables sin turno asignado (sin agentes en el plan).`,
    );
  }

  for (const ag of agentes) {
    const personaId = ag && ag.persona_id ? String(ag.persona_id) : "?";
    const dias = ag && ag.dias && typeof ag.dias === "object" ? ag.dias : {};
    for (const [ymd, cel] of Object.entries(dias)) {
      if (!cel || typeof cel !== "object") continue;
      const tipo = cel.tipo_dia;
      if (tipo !== "laborable" && tipo !== "guardia") continue;
      if (!turnoIdValido(cel.turno_id)) {
        throw new HttpsError(
          "failed-precondition",
          `[${CODIGO_US9}] El plan contiene días laborables sin turno asignado (${personaId} · ${ymd}).`,
        );
      }
    }
  }
}

module.exports = {
  CODIGO_US9,
  turnoIdValido,
  assertPlanSinHuecosTurno,
};
