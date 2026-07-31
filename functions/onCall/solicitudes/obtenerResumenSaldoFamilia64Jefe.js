"use strict";

/**
 * Saldo Art. 64 del titular, para que el jefe vea disponibilidad antes de elegir
 * modalidad. Expone datos de un tercero: la compuerta reusa la misma regla que
 * decide qué trámites ve el jefe en su bandeja.
 *
 * El débito real y su validación siguen viviendo en la transacción de
 * `aplicarModalidad64EnTx`; esto es informativo.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const {
  revisorVeSolicitudEnBandejaJefe,
} = require("../../modules/shared/solicitudBandejaJefeCore");
const {
  obtenerResumenSaldoFamilia64Agente,
} = require("../../modules/shared/solicitudFamilia64ResumenSaldoCore");

const COL_SOL = "solicitudes_articulo";

const obtenerResumenSaldoFamilia64JefeCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  const rrhhBypass = tokenHasRrhhLaborAccess(token);
  if (!isPortalRoleUsuario(token) && !rrhhBypass) {
    throw new HttpsError("permission-denied", "Sesión sin perfil laboral para bandeja jefe.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }

  const revisorPersonaId = assertAgenteConPersonaId(request);

  const snap = await db.collection(COL_SOL).doc(solicitudId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "La solicitud no existe.");
  }
  const sol = { id: snap.id, ...(snap.data() || {}) };

  if (!rrhhBypass) {
    const puedeVer = await revisorVeSolicitudEnBandejaJefe(db, sol, revisorPersonaId);
    if (!puedeVer) {
      throw new HttpsError("permission-denied", "No autorizás este trámite.");
    }
  }

  const titularId = String(sol.titular_persona_id || "").trim();
  const anioRaw = Number(sol.anio_ciclo_consumo);
  const anio = Number.isInteger(anioRaw) && anioRaw >= 1900 ? anioRaw : undefined;

  const result = await obtenerResumenSaldoFamilia64Agente(
    db,
    titularId,
    anio,
    String(sol.articulo_id || "").trim(),
  );
  if (!result.ok) {
    throw new HttpsError("failed-precondition", result.mensaje || "No se pudo obtener el saldo.");
  }

  const dias = Math.max(
    1,
    Math.floor(Number(sol.motor_dias_descontados) || Number(sol.dias_solicitados) || 1),
  );
  const reservado = sol.motor_descuento_aplicado === true;

  // El alta ya descontó los días de una de las bolsas. Al jefe le mostramos el
  // saldo *previo* a este trámite: sobre ese número se descuenta al aprobar, y
  // así la cuenta le cierra mire la modalidad que mire.
  const artSol = String(sol.articulo_id || "").trim();
  const devolver = (disponible, articuloId) => {
    if (disponible == null) return null;
    return reservado && artSol && artSol === articuloId ? disponible + dias : disponible;
  };

  return {
    ...result,
    con_goce_disponible_previo: devolver(result.con_goce_disponible, result.articulo_id_con_goce),
    sin_goce_disponible_previo: devolver(result.sin_goce_disponible, result.articulo_id_sin_goce),
    solicitud_id: solicitudId,
    dias_solicitados: dias,
    saldo_ya_reservado: reservado,
  };
});

module.exports = {
  obtenerResumenSaldoFamilia64Jefe: obtenerResumenSaldoFamilia64JefeCallable,
};
