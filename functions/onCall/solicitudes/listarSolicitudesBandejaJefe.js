"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { listarSolicitudesBandejaJefe } = require("../../modules/shared/solicitudBandejaJefeCore");

const listarSolicitudesBandejaJefeCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token) && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil laboral para bandeja jefe.");
  }

  const revisorPersonaId = assertAgenteConPersonaId(request);
  const rrhhBypass = tokenHasRrhhLaborAccess(token);

  return listarSolicitudesBandejaJefe(db, { revisorPersonaId, rrhhBypass });
});

module.exports = { listarSolicitudesBandejaJefe: listarSolicitudesBandejaJefeCallable };
