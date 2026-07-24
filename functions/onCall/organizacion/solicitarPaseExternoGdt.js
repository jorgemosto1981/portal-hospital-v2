"use strict";

/**
 * Callable: solicitarPaseExternoGdt
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.2
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { solicitarPaseExternoGdtCore } = require("../../modules/organizacion/solicitarPaseExternoGdtCore");

const solicitarPaseExternoGdtCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth.token || {};
  const esRrhh = tokenHasRrhhLaborAccess(token);
  const solicitantePersonaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";

  if (!esRrhh && !solicitantePersonaId) {
    throw new HttpsError("permission-denied", "Sin perfil laboral para solicitar pases.");
  }

  const result = await solicitarPaseExternoGdtCore(db, {
    agentePersonaId: typeof d.agente_persona_id === "string" ? d.agente_persona_id.trim() : "",
    hlgOrigenId: typeof d.hlg_origen_id === "string" ? d.hlg_origen_id.trim() : "",
    fechaEfectivaYmd: typeof d.fecha_efectiva === "string" ? d.fecha_efectiva : "",
    motivo: typeof d.motivo === "string" ? d.motivo : "",
    destinoSugeridoTexto: typeof d.destino_sugerido_texto === "string" ? d.destino_sugerido_texto : "",
    solicitantePersonaId,
    esRrhh,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo solicitar el pase externo.",
    );
  }

  return {
    ok: true,
    pase_id: result.pase_id,
    hlg_origen_id: result.hlg_origen_id,
    gdt_origen_id: result.gdt_origen_id,
    fecha_efectiva: result.fecha_efectiva,
    estado: result.estado,
    tipo_pase: result.tipo_pase,
  };
});

module.exports = { solicitarPaseExternoGdt: solicitarPaseExternoGdtCallable };
