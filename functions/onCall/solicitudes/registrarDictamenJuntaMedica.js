"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { registrarDictamenJuntaMedica } = require("../../modules/shared/registrarDictamenJuntaMedicaCore");

function tokenHasDictamenJuntaAccess(token) {
  if (tokenHasRrhhLaborAccess(token)) return true;
  const raw = token && typeof token === "object" ? token.roles_hlc_vigentes : null;
  if (!Array.isArray(raw)) return false;
  return raw.some((r) => {
    const id = String(r || "").trim().toUpperCase();
    return (
      id.includes("JUNTA") ||
      id === "AUDITOR_MEDICO" ||
      id === "CFG_AUDITOR_MEDICO" ||
      id.includes("AUDITOR_MEDICO")
    );
  });
}

function assertJuntaMedica(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (tokenHasDictamenJuntaAccess(request.auth.token)) {
    return assertAgenteConPersonaId(request);
  }
  throw new HttpsError("permission-denied", "Solo junta médica o medicina laboral autorizada.");
}

const registrarDictamenJuntaMedicaCallable = onCall(async (request) => {
  const registradoPorPersonaId = assertJuntaMedica(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};

  const result = await registrarDictamenJuntaMedica(db, {
    solicitudId: typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "",
    registradoPorPersonaId,
    dictamenFavorable: d.dictamen_favorable === true,
    observacionJunta:
      typeof d.observacion_junta === "string"
        ? d.observacion_junta.trim()
        : typeof d.observacion === "string"
          ? d.observacion.trim()
          : undefined,
    juntaMedicaSedeId:
      typeof d.junta_medica_sede_id === "string" ? d.junta_medica_sede_id.trim() : undefined,
  });

  if (!result.ok) {
    const code =
      result.codigo === "ESTADO_INVALIDO" ||
      result.codigo === "DICTAMEN_YA_REGISTRADO" ||
      result.codigo === "SIN_CLASIFICACION_JUNTA"
        ? "failed-precondition"
        : "invalid-argument";
    throw new HttpsError(code, result.mensaje || "No se pudo registrar el dictamen.");
  }

  return result;
});

module.exports = { registrarDictamenJuntaMedica: registrarDictamenJuntaMedicaCallable };
