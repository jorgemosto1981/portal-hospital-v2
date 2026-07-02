"use strict";

const { tokenHasRrhhLaborAccess } = require("./laborProfile");
const { assertAgenteConPersonaId } = require("./helpers");
const { HttpsError } = require("firebase-functions/v2/https");

/**
 * @param {Record<string, unknown> | null | undefined} token
 */
function tokenHasAuditorMedicoAccess(token) {
  if (tokenHasRrhhLaborAccess(token)) return true;
  const raw = token && typeof token === "object" ? token.roles_hlc_vigentes : null;
  if (!Array.isArray(raw)) return false;
  return raw.some((r) => {
    const id = String(r || "").trim().toUpperCase();
    return id === "AUDITOR_MEDICO" || id === "CFG_AUDITOR_MEDICO" || id.includes("AUDITOR_MEDICO");
  });
}

/**
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 */
function assertAuditorMedico(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (tokenHasAuditorMedicoAccess(request.auth.token)) {
    return assertAgenteConPersonaId(request);
  }
  throw new HttpsError("permission-denied", "Solo médico auditor autorizado.");
}

module.exports = {
  tokenHasAuditorMedicoAccess,
  assertAuditorMedico,
};
