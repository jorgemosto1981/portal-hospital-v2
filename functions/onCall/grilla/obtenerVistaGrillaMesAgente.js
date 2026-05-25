"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { obtenerVistaGrillaMesAgente } = require("../../modules/shared/grillaMesAgenteCore");

const obtenerVistaGrillaMesAgenteCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token) && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil para consultar grilla.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const revisorPersonaId = assertAgenteConPersonaId(request);
  const titular =
    typeof d.persona_id === "string" && /^per_/i.test(d.persona_id.trim())
      ? d.persona_id.trim()
      : revisorPersonaId;

  if (titular !== revisorPersonaId && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo podés consultar tu propia grilla mensual.");
  }

  const anio = Number(d.anio);
  const mes = Number(d.mes);
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
    throw new HttpsError("invalid-argument", "anio y mes son obligatorios.");
  }

  const result = await obtenerVistaGrillaMesAgente(db, {
    personaId: titular,
    anio,
    mes,
  });

  if (!result.ok) {
    throw new HttpsError("invalid-argument", result.mensaje || "Consulta inválida.");
  }

  return result;
});

module.exports = { obtenerVistaGrillaMesAgente: obtenerVistaGrillaMesAgenteCallable };
