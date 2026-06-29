"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { loadArticuloDisplay } = require("../../modules/shared/solicitudBandejaJefeCore");
const { resolverCodigoGrillaAvisoMedico } = require("../../modules/shared/avisoMedicoGrillaMdcPayload");
const { SCHEMA_MED_AVISO } = require("../../modules/shared/avisoMedicoProvisoriosVigentesCore");
const { proyectarAvisoMedicoEnGrilla, limpiarIdempotenciaMdc } = require("../../modules/shared/avisoMedicoGrillaMdcCore");
const {
  encolarComandoMdcTicketera,
  buildMdcPayloadDesdeSolicitud,
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_AUTORIZAR_JEFE,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("../../modules/shared/mdcTicketeraEmisor");
const { ESTADO_SOLICITUD_APROBADA, ESTADO_SOLICITUD_RECHAZADA } = require("../../modules/shared/solicitudesArticuloEstados");

const COMANDO_POR_ESTADO = {
  cfg_esa_en_revision_jefe: MDC_COMANDO_PROYECTAR_PENDIENTE,
  cfg_esa_en_revision_rrhh: MDC_COMANDO_AUTORIZAR_JEFE,
  cfg_esa_aprobada: MDC_COMANDO_CONSOLIDAR_APROBADO,
  cfg_esa_rechazada: MDC_COMANDO_REVERTIR_PROYECCION,
  cfg_esa_pendiente_clasificacion_medica: MDC_COMANDO_PROYECTAR_PENDIENTE,
};

/**
 * Reprocesa MDC → asi_* + vis_* para una solicitud ya existente (pruebas / backfill Oleada B).
 * Requiere Functions desplegadas con módulos mdc*.
 */
const reprocesarMdcSolicitudPatronB = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  if (!/^sol_/i.test(solId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }

  const solSnap = await db.collection("solicitudes_articulo").doc(solId).get();
  if (!solSnap.exists) {
    throw new HttpsError("not-found", "La solicitud no existe.");
  }

  const sol = { id: solSnap.id, ...(solSnap.data() || {}) };
  const estado = String(sol.estado_solicitud_id || "").trim();
  const comando = COMANDO_POR_ESTADO[estado];
  if (!comando) {
    throw new HttpsError(
      "failed-precondition",
      `Estado ${estado} sin comando MDC mapeado (solo en_revision_jefe, aprobada, rechazada).`,
    );
  }

  const schemaMed = String(sol.schema_version || "") === SCHEMA_MED_AVISO;
  if (schemaMed && estado === "cfg_esa_pendiente_clasificacion_medica") {
    await limpiarIdempotenciaMdc(db, solId, MDC_COMANDO_PROYECTAR_PENDIENTE);
    const result = await proyectarAvisoMedicoEnGrilla(db, solId, sol);
    return {
      ok: result.ok === true,
      solicitud_id: solId,
      comando,
      estado_solicitud_id: estado,
      dias_afectados: result.dias_afectados ?? null,
      skipped: result.skipped === true,
      codigo: result.codigo || null,
    };
  }

  const artCache = new Map();
  const codigoGrilla = schemaMed
    ? resolverCodigoGrillaAvisoMedico(sol)
    : (await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache)).codigo_grilla;
  const payload = buildMdcPayloadDesdeSolicitud(
    { ...sol, codigo_grilla: codigoGrilla },
    comando,
  );

  const result = await encolarComandoMdcTicketera(db, payload);

  return {
    ok: result.ok === true,
    solicitud_id: solId,
    comando,
    estado_solicitud_id: estado,
    dias_afectados: result.dias_afectados ?? null,
    skipped: result.skipped === true,
    codigo: result.codigo || null,
    asi_ejemplo_id: `asi_${String(sol.titular_persona_id)}_${String(sol.fecha_desde).replace(/-/g, "")}`,
    vis_ejemplo_id: `vis_${String(sol.fecha_desde).slice(0, 4)}_${String(sol.fecha_desde).slice(5, 7)}_per_${String(sol.titular_persona_id).replace(/^per_/i, "")}`,
  };
});

module.exports = { reprocesarMdcSolicitudPatronB };
