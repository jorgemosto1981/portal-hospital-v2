"use strict";

/**
 * Callable: aprobarPaseGdt
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.3
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { aprobarPaseGdtCore } = require("../../modules/organizacion/aprobarPaseGdtCore");

const aprobarPaseGdtCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede aprobar pases.");
  }
  const resolventePersonaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";
  if (!resolventePersonaId) {
    throw new HttpsError("permission-denied", "Sin persona vinculada en el token.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const result = await aprobarPaseGdtCore(db, {
    paseId: typeof d.pase_id === "string" ? d.pase_id.trim() : "",
    gdtDestinoId: typeof d.gdt_destino_id === "string" ? d.gdt_destino_id.trim() : "",
    fechaEfectivaYmd: typeof d.fecha_efectiva === "string" ? d.fecha_efectiva : null,
    overridesHlg:
      d.overrides_hlg && typeof d.overrides_hlg === "object" ? d.overrides_hlg : null,
    motivoRrhh: typeof d.motivo_rrhh === "string" ? d.motivo_rrhh : null,
    resolventePersonaId,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo aprobar el pase.",
    );
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

module.exports = { aprobarPaseGdt: aprobarPaseGdtCallable };
