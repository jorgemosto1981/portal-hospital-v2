"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewMotor");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { listarArticulosIngresoPatronB } = require("../../modules/shared/listarArticulosIngresoCore");

const listarArticulosIngresoAgente = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token)) {
    throw new HttpsError(
      "permission-denied",
      "No tenés un cargo laboral vigente completo (HLc→HLd→HLg) para operar solicitudes. Pedí a RRHH la carga o sincronizá sesión tras actualizar datos laborales.",
    );
  }

  const personaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }

  const result = await listarArticulosIngresoPatronB({
    db,
    personaId,
    fechaDesde,
    authToken: request.auth.token,
  });

  if (result.error === "not-found") {
    throw new HttpsError("not-found", result.message);
  }
  if (result.error === "invalid-argument") {
    throw new HttpsError("invalid-argument", result.message);
  }

  return result;
});

module.exports = { listarArticulosIngresoAgente };
