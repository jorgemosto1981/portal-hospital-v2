"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const {
  obtenerResumenSaldoFamilia64Agente,
} = require("../../modules/shared/solicitudFamilia64ResumenSaldoCore");

const obtenerResumenSaldoFamilia64AgenteCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil laboral para consultar saldos.");
  }

  const personaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const anioRaw = Number(d.anio_ciclo);
  const anio =
    Number.isInteger(anioRaw) && anioRaw >= 1900 && anioRaw <= 2200 ? anioRaw : undefined;

  const result = await obtenerResumenSaldoFamilia64Agente(db, personaId, anio);
  if (!result.ok) {
    throw new HttpsError("invalid-argument", result.mensaje || "No se pudo obtener el resumen.");
  }
  return result;
});

module.exports = { obtenerResumenSaldoFamilia64Agente: obtenerResumenSaldoFamilia64AgenteCallable };
