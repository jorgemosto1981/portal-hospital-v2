"use strict";

/**
 * Callable — preview simulación LAO (Stock / Proporcional, guardas 01/07 y TSE, matriz).
 * Consumo previsto: UI del portal al completar fechas de solicitud.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");
const { assertAgenteConPersonaId, tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const { runLaoPreviewSimulacion, parseYmd } = require("../../modules/shared/laoPreviewMotor");
const { gatherLaoAltaMotorContext } = require("../../modules/shared/solicitudLaoAltaMotorContext");

function resolvePersonaIdParaPreview(request, data) {
  if (runtimeFlags.OPEN_ACCESS_TEMP === true) {
    const pid = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
    if (pid && /^per_/i.test(pid)) return pid;
    throw new HttpsError("failed-precondition", "OPEN_ACCESS_TEMP: enviá persona_id explícito.");
  }
  if (request.auth && tokenHasRrhhAccess(request.auth.token)) {
    const pid = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
    if (pid && /^per_/i.test(pid)) return pid;
    throw new HttpsError("invalid-argument", "RRHH debe enviar persona_id del agente a simular.");
  }
  return assertAgenteConPersonaId(request);
}

const simularLaoPreview = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = resolvePersonaIdParaPreview(request, d);
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const versionId =
    typeof d.version_aplicada_id === "string"
      ? d.version_aplicada_id.trim()
      : typeof d.version_aplicada === "string"
        ? d.version_aplicada.trim()
        : "";
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  const anioOrigenBolsa = Number(d.anio_origen_bolsa);

  if (!articuloId || !/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido (art_*).");
  }
  if (!versionId || !/^ver_/i.test(versionId)) {
    throw new HttpsError("invalid-argument", "version_aplicada_id inválido (ver_*).");
  }
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }
  if (!Number.isInteger(anioOrigenBolsa) || anioOrigenBolsa < 1900) {
    throw new HttpsError("invalid-argument", "anio_origen_bolsa inválido.");
  }

  let ctx;
  try {
    ctx = await gatherLaoAltaMotorContext(db, {
      personaId,
      articuloId,
      versionId,
      fechaDesde,
    });
  } catch (err) {
    const code = err && typeof err.code === "string" ? err.code : "failed-precondition";
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "not-found") throw new HttpsError("not-found", msg);
    if (code === "invalid-argument") throw new HttpsError("invalid-argument", msg);
    throw new HttpsError("failed-precondition", msg);
  }

  try {
    const resultado = runLaoPreviewSimulacion({
      fechaDesdeYmd: fechaDesde,
      anioOrigenBolsa,
      hlcArray: ctx.hlcArray,
      diasExternos: ctx.diasExternos,
      exclusionIntervals: ctx.exclusionIntervals,
      versionData: ctx.versionData,
      operadorCodigoPorId: ctx.operadorMap,
    });
    return {
      ...resultado,
      persona_id: personaId,
      articulo_id: articuloId,
      version_aplicada_id: versionId,
      solicitudes_evaluadas: ctx.solicitudesEvaluadas,
      intervalos_excluidos_tse: ctx.intervalosExcluidosTse,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("failed-precondition", msg);
  }
});

module.exports = { simularLaoPreview };
