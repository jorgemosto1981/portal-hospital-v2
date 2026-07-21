"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewDateUtils");
const {
  listarArticulosIngresoPorRol,
  normalizarRolCircuito,
} = require("../../modules/shared/listarArticulosIngresoRolCore");

const listarArticulosIngresoPorRolCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const actorPersonaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const rolActor = normalizarRolCircuito(d.rol_id);
  if (!rolActor) {
    throw new HttpsError(
      "invalid-argument",
      "rol_id debe ser CFG_USUARIO, CFG_RRHH, CFG_MEDICO o CFG_VISUALIZADOR.",
    );
  }

  const fechaDesde =
    typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }

  const titularRaw =
    typeof d.titular_persona_id === "string" ? d.titular_persona_id.trim() : "";
  const titularPersonaId = /^per_/i.test(titularRaw) ? titularRaw : actorPersonaId;

  const result = await listarArticulosIngresoPorRol({
    db,
    rolActor,
    actorPersonaId,
    titularPersonaId,
    fechaDesde,
    authToken: request.auth.token,
  });

  if (result.error === "permission-denied") {
    throw new HttpsError("permission-denied", result.message);
  }
  if (result.error === "not-found") {
    throw new HttpsError("not-found", result.message);
  }
  if (result.error === "invalid-argument") {
    throw new HttpsError("invalid-argument", result.message);
  }

  return result;
});

module.exports = {
  listarArticulosIngresoPorRol: listarArticulosIngresoPorRolCallable,
};
