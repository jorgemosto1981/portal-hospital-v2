"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewMotor");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { runPatronBAltaMotor } = require("../../modules/shared/solicitudPatronBAltaMotor");
const {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronB,
} = require("../../modules/shared/patronBFechasSolicitud");

const previsualizarSolicitudPatronB = onCall(async (request) => {
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
  const diasRaw = Number(d.dias_solicitados);

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

  const diasVersion = diasSolicitadosDesdeVersion(versionData);
  const diasSolicitados =
    Number.isFinite(diasRaw) && diasRaw > 0 ? Math.floor(diasRaw) : diasVersion;
  const fechaHasta = fechaHastaDesdeVersionPatronB(fechaDesde, diasSolicitados);

  const motor = await runPatronBAltaMotor({
    db,
    solicitud: {
      titular_persona_id: personaId,
      articulo_id: articuloId,
      version_aplicada_id: versionId,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      dias_solicitados: diasSolicitados,
      anio_ciclo_consumo: pDesde.y,
      grupo_trabajo_id_ancla: grupoTrabajoId || null,
    },
    authToken: request.auth.token,
  });

  if (!motor.ok) {
    return {
      ok: false,
      eligible: false,
      codigos: Array.isArray(motor.codigos) ? motor.codigos : [],
      mensajes: Array.isArray(motor.mensajes) ? motor.mensajes : [],
      grupo_trabajo_id_ancla: motor.grupo_trabajo_id_ancla || null,
      grupos_trabajo_vigentes: Array.isArray(motor.grupos_trabajo_vigentes)
        ? motor.grupos_trabajo_vigentes
        : [],
      requiere_seleccion_grupo: motor.requiere_seleccion_grupo === true,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      dias_solicitados: diasSolicitados,
      persona_id: personaId,
      articulo_id: articuloId,
      version_id: versionId,
      hlc_id: motor.hlc_id || null,
    };
  }

  return {
    ok: motor.ok === true,
    eligible: motor.ok === true,
    codigos: Array.isArray(motor.codigos) ? motor.codigos : [],
    mensajes: Array.isArray(motor.mensajes) ? motor.mensajes : [],
    grupo_trabajo_id_ancla: motor.grupo_trabajo_id_ancla || null,
    grupos_trabajo_vigentes: Array.isArray(motor.grupos_trabajo_vigentes)
      ? motor.grupos_trabajo_vigentes
      : [],
    requiere_seleccion_grupo: motor.requiere_seleccion_grupo === true,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    dias_solicitados: diasSolicitados,
    persona_id: personaId,
    articulo_id: articuloId,
    version_id: versionId,
    hlc_id: motor.hlc_id || null,
    ...(motor.ok
      ? {
          saldo_ciclo: {
            anio_ciclo_consumo: motor.anio_ciclo_consumo,
            dias_consumo: motor.dias_consumo,
            saldo_disponible: motor.saldo_disponible,
            saldo_restante_preview: motor.saldo_restante_preview,
            bolsa_id: motor.bolsa_id || null,
          },
          frecuencia_mes: motor.frecuencia_mes || null,
        }
      : {}),
  };
});

module.exports = { previsualizarSolicitudPatronB };
