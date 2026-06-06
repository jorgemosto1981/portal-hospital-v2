"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { reabrirPeriodoLiquidacionCore } = require("../../modules/asistencia/asistenciaPeriodoLiquidacion");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");

function actorPersonaIdFromRequest(request) {
  const t = request.auth?.token || {};
  return typeof t.persona_id === "string" ? t.persona_id.trim() : "";
}

const reabrirPeriodoLiquidacion = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const grupoTrabajoId =
    typeof d.grupo_trabajo_id === "string" ? d.grupo_trabajo_id.trim() : "";
  const anio = Number(d.anio);
  const mes = Number(d.mes);
  const motivo = typeof d.motivo === "string" ? d.motivo.trim() : "";

  if (!/^gdt_/i.test(grupoTrabajoId)) {
    throw new HttpsError("invalid-argument", "grupo_trabajo_id inválido.");
  }
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
    throw new HttpsError("invalid-argument", "anio y mes son obligatorios.");
  }
  if (motivo.length < 3) {
    throw new HttpsError("invalid-argument", "El motivo de reapertura es obligatorio (mín. 3 caracteres).");
  }

  try {
    const result = await reabrirPeriodoLiquidacionCore(db, {
      grupoTrabajoId,
      anio,
      mes,
      actorPersonaId: actorPersonaIdFromRequest(request),
      motivo,
    });
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.codigo || "No se pudo reabrir el período.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("reabrirPeriodoLiquidacion", err);
    throw new HttpsError(
      "internal",
      err instanceof Error ? err.message : "Error al reabrir período de liquidación.",
    );
  }
});

module.exports = { reabrirPeriodoLiquidacion };
