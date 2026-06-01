"use strict";

/**
 * Preview callable Patron C — dry-run del motor V2 sin persistir.
 * Patron C: cuenta corriente continua, saldo global, horas.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewDateUtils");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { runPatronCAltaMotorV2 } = require("../../modules/shared/patronCAltaMotorV2");

const previsualizarSolicitudPatronC = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token)) {
    throw new HttpsError(
      "permission-denied",
      "No tenés un cargo laboral vigente completo (HLc→HLd→HLg) para operar solicitudes.",
    );
  }

  const personaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const versionId =
    typeof d.version_id === "string"
      ? d.version_id.trim()
      : typeof d.version_aplicada_id === "string"
        ? d.version_aplicada_id.trim()
        : "";
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  const horasRaw = Number(d.horas_solicitadas);
  const fechaHasta = typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim().slice(0, 10) : fechaDesde;

  if (!/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido.");
  }
  if (!/^ver_/i.test(versionId)) {
    throw new HttpsError("invalid-argument", "version_id inválido.");
  }
  const pDesde = parseYmd(fechaDesde);
  if (!pDesde) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }
  if (!Number.isFinite(horasRaw) || horasRaw <= 0) {
    throw new HttpsError("invalid-argument", "horas_solicitadas debe ser mayor a cero.");
  }

  const versionSnap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  const versionData = versionSnap.exists ? versionSnap.data() || {} : {};
  const grupoTrabajoId =
    typeof d.grupo_trabajo_id_ancla === "string"
      ? d.grupo_trabajo_id_ancla.trim()
      : typeof d.grupo_de_trabajo_id === "string"
        ? d.grupo_de_trabajo_id.trim()
        : "";

  const motor = await runPatronCAltaMotorV2({
    db,
    solicitud: {
      titular_persona_id: personaId,
      articulo_id: articuloId,
      version_aplicada_id: versionId,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      horas_solicitadas: horasRaw,
      grupo_trabajo_id_ancla: grupoTrabajoId || null,
    },
    authToken: request.auth.token,
    versionData,
    versionId,
  });

  const base = {
    ok: motor.eligible === true,
    eligible: motor.eligible === true,
    codigos: Array.isArray(motor.codigos) ? motor.codigos : [],
    mensajes: Array.isArray(motor.mensajes) ? motor.mensajes : [],
    grupo_trabajo_id_ancla: motor.grupo_trabajo_id_ancla || null,
    grupos_trabajo_vigentes: Array.isArray(motor.grupos_trabajo_vigentes)
      ? motor.grupos_trabajo_vigentes
      : [],
    requiere_seleccion_grupo: motor.requiere_seleccion_grupo === true,
    fecha_desde: fechaDesde,
    fecha_hasta: motor.fecha_hasta || fechaHasta,
    horas_solicitadas: horasRaw,
    persona_id: personaId,
    articulo_id: articuloId,
    version_id: versionId,
    hlc_id: motor.hlc_id || null,
    motor_snapshot: motor.motor_snapshot || null,
    checks: motor.checks || [],
    warnings: motor.warnings || [],
  };

  if (!motor.eligible) return base;

  return {
    ...base,
    saldo_global: {
      cantidad_consumo: motor.cantidad_consumo,
      unidad_consumo: motor.unidad_consumo,
      saldo_disponible: motor.saldo_disponible,
      saldo_restante_preview: motor.saldo_restante_preview,
      bolsa_id: motor.bolsa_id || null,
    },
    frecuencia_mes: motor.frecuencia_mes || null,
    calendario_resumen: motor.calendario_resumen || null,
    modo_computo: motor.modo_computo || null,
    grilla: motor.grilla || null,
  };
});

module.exports = { previsualizarSolicitudPatronC };
