"use strict";

/**
 * Superposición LAO — wrapper del validador Patrón B para preview y alta.
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §4 (politica_superposicion_id, fase E)
 */

const { validarSuperposicionFechasPatronB } = require("./patronBSuperposicionValidacion");

/**
 * Consulta Firestore (solicitudes activas + asistencia_diaria) y aplica política bloqueante.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   personaId: string,
 *   fechaDesdeYmd: string,
 *   fechaHastaYmd?: string,
 *   versionData: Record<string, unknown> | null | undefined,
 *   excludeSolId?: string,
 * }} params
 * @returns {Promise<{ ok: boolean, codigo?: string, mensaje?: string, conflicto_solicitud_id?: string, conflicto_estado_solicitud_id?: string, conflicto_fuente?: string }>}
 */
async function validarSuperposicionLaoEnMotor(db, params) {
  const personaId = String(params?.personaId || "").trim();
  const fechaDesdeYmd = String(params?.fechaDesdeYmd || "").slice(0, 10);
  const fechaHastaYmd = String(params?.fechaHastaYmd || params?.fechaDesdeYmd || "").slice(0, 10);
  const excludeSolId = String(params?.excludeSolId || "").trim();

  if (!personaId || !fechaDesdeYmd) {
    return { ok: true };
  }

  return validarSuperposicionFechasPatronB(db, {
    persona_id: personaId,
    fecha_desde: fechaDesdeYmd,
    fecha_hasta: fechaHastaYmd,
    exclude_sol_id: excludeSolId,
    version_data: params?.versionData,
  });
}

module.exports = {
  validarSuperposicionLaoEnMotor,
};
