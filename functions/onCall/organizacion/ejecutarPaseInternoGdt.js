"use strict";

/**
 * Callable: ejecutarPaseInternoGdt
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.1
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { refreshSessionClaimsForPersona } = require("../../modules/shared/authClaims");
const { ejecutarPaseInternoGdtCore } = require("../../modules/organizacion/ejecutarPaseInternoGdtCore");

const ejecutarPaseInternoGdtCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth.token || {};
  const esRrhh = tokenHasRrhhLaborAccess(token);
  const solicitantePersonaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";
  const agentePersonaId = typeof d.agente_persona_id === "string" ? d.agente_persona_id.trim() : "";

  if (!esRrhh && !solicitantePersonaId) {
    throw new HttpsError("permission-denied", "Sin perfil laboral para ejecutar pases.");
  }

  const result = await ejecutarPaseInternoGdtCore(db, {
    agentePersonaId,
    hlgOrigenId: typeof d.hlg_origen_id === "string" ? d.hlg_origen_id : "",
    gdtDestinoId: typeof d.gdt_destino_id === "string" ? d.gdt_destino_id : "",
    fechaEfectivaYmd: typeof d.fecha_efectiva === "string" ? d.fecha_efectiva : "",
    motivo: typeof d.motivo === "string" ? d.motivo : "",
    solicitantePersonaId,
    esRrhh,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo ejecutar el pase interno.",
    );
  }

  try {
    if (agentePersonaId) await refreshSessionClaimsForPersona(agentePersonaId);
  } catch {
    // No bloquear el pase si Auth falla.
  }

  return {
    ok: true,
    pase_id: result.pase_id,
    hlg_destino_id: result.hlg_destino_id,
    hlg_origen_id: result.hlg_origen_id,
    gdt_origen_id: result.gdt_origen_id,
    gdt_destino_id: result.gdt_destino_id,
    fecha_efectiva: result.fecha_efectiva,
    fecha_inicio_destino: result.fecha_inicio_destino,
    estado: result.estado,
  };
});

module.exports = { ejecutarPaseInternoGdt: ejecutarPaseInternoGdtCallable };
