"use strict";

const { tokenHasRrhhLaborAccess } = require("./laborProfile");
const { assertAgenteConPersonaId } = require("./helpers");
const { HttpsError } = require("firebase-functions/v2/https");

/**
 * @param {Record<string, unknown> | null | undefined} token
 */
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

/**
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 */
function assertJuntaMedica(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (tokenHasDictamenJuntaAccess(request.auth.token)) {
    return assertAgenteConPersonaId(request);
  }
  throw new HttpsError("permission-denied", "Solo junta médica o medicina laboral autorizada.");
}

module.exports = {
  tokenHasDictamenJuntaAccess,
  assertJuntaMedica,
};
