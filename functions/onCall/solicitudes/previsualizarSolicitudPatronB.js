"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewDateUtils");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { runPatronBAltaMotorV2 } = require("../../modules/shared/patronBAltaMotorV2");
const {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronBAsync,
} = require("../../modules/shared/patronBFechasSolicitud");
const { resolvePatronBConsumoDesdeSolicitud } = require("../../modules/shared/opcionesConsumoSolicitud");
const { buildLicenciaMedicaPreviewParaPatronB } = require("../../modules/shared/licenciaMedicaPreviewPatronB");
const {
  versionEsCambioDia,
  validarFechasMotivoCambioDia,
} = require("../../modules/shared/cambioDiaSolicitudCore");
const {
  resolveFamilia64PairAsync,
} = require("../../modules/shared/familia64Config");
const { saldoAnualDocId, pickBolsaParaConsumo } = require("../../modules/shared/laoSaldosBolsa");

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

  if (versionEsCambioDia(versionData)) {
    const wf = versionData.bloque_workflow_sla_cobertura || {};
    const ext = versionData.cambio_dia_solicitud || {};
    const fo =
      typeof d.fecha_origen === "string" && d.fecha_origen.trim()
        ? d.fecha_origen.trim().slice(0, 10)
        : fechaDesde;
    const fd =
      typeof d.fecha_destino === "string" && d.fecha_destino.trim()
        ? d.fecha_destino.trim().slice(0, 10)
        : "";
    const motivo = typeof d.motivo === "string" ? d.motivo.trim() : "";
    const check = validarFechasMotivoCambioDia({
      fechaOrigen: fo,
      fechaDestino: fd,
      motivo: motivo.length >= 3 ? motivo : "previsualizacion-cambio-dia",
      permiteRetroactividad: wf.permite_retroactividad === true,
      plazoPreavisoInternoDias:
        wf.plazo_preaviso_interno_dias == null ? 0 : Number(wf.plazo_preaviso_interno_dias),
      motivoMaxLen: Number(ext.motivo_max_len) || 500,
    });
    // Preview: validamos fechas/preaviso; el motivo real lo exige el wizard al enviar.
    const erroresFechas = (check.errores || []).filter((m) => !/motivo/i.test(String(m)));
    if (erroresFechas.length) {
      return {
        ok: false,
        eligible: false,
        codigos: ["CAMBIO_DIA_VALIDACION"],
        mensajes: erroresFechas,
        fecha_desde: fo,
        fecha_origen: fo,
        fecha_destino: fd,
        es_cambio_dia: true,
        persona_id: personaId,
        articulo_id: articuloId,
        version_id: versionId,
      };
    }
  }

  const grupoTrabajoId =
    typeof d.grupo_trabajo_id_ancla === "string"
      ? d.grupo_trabajo_id_ancla.trim()
      : typeof d.grupo_de_trabajo_id === "string"
        ? d.grupo_de_trabajo_id.trim()
        : "";
  const opcionConsumoId =
    typeof d.opcion_consumo_id === "string" ? d.opcion_consumo_id.trim() : "";

  const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
    opcion_consumo_id: opcionConsumoId || undefined,
    dias_solicitados: Number.isFinite(diasRaw) && diasRaw > 0 ? Math.floor(diasRaw) : undefined,
  });
  const diasVersion = diasSolicitadosDesdeVersion(versionData);
  const diasSolicitados = consumo.ok
    ? consumo.diasPedidos
    : Number.isFinite(diasRaw) && diasRaw > 0
      ? Math.floor(diasRaw)
      : diasVersion;
  const versionEff = consumo.ok ? consumo.versionEff : versionData;
  const fechaHasta = await fechaHastaDesdeVersionPatronBAsync(db, fechaDesde, diasSolicitados, versionEff);

  const motor = await runPatronBAltaMotorV2({
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
      ...(opcionConsumoId ? { opcion_consumo_id: opcionConsumoId } : {}),
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
    dias_solicitados: diasSolicitados,
    persona_id: personaId,
    articulo_id: articuloId,
    version_id: versionId,
    opcion_consumo_id: motor.opcion_consumo_id || opcionConsumoId || null,
    hlc_id: motor.hlc_id || null,
    motor_snapshot: motor.motor_snapshot || null,
    checks: motor.checks || [],
    warnings: motor.warnings || [],
  };

  if (!motor.eligible) return base;

  const sinBolsaCiclo = motor.sin_descuento_bolsa_ciclo === true;

  const licencia_medica_preview = await buildLicenciaMedicaPreviewParaPatronB(db, {
    versionData,
    titular_persona_id: personaId,
    anio_calendario: pDesde.y,
    fecha_desde: fechaDesde,
    dias_solicitados: diasSolicitados,
    causal_larga_duracion_id:
      typeof d.causal_larga_duracion_id === "string" ? d.causal_larga_duracion_id.trim() : null,
    dictamen_favorable: d.dictamen_favorable === true,
  });

  const causal_larga_duracion_id =
    typeof d.causal_larga_duracion_id === "string" ? d.causal_larga_duracion_id.trim() : null;

  // Carril 64 unificado: el jefe define con/sin goce al autorizar, así que
  // el preview informa ambas bolsas del par cfg sin proyectar consumo.
  let saldo_familia_64 = null;
  const pairPreview = await resolveFamilia64PairAsync(db, articuloId, null);
  if (pairPreview.enFamilia && !pairPreview.esSinGoce && pairPreview.conGoceId && pairPreview.sinGoceId && !sinBolsaCiclo) {
    const anioCiclo = Number(motor.anio_ciclo_consumo) || pDesde.y;
    const salId = saldoAnualDocId(personaId, anioCiclo);
    if (salId) {
      const salSnap = await db.collection("saldos_articulo_agente").doc(salId).get();
      const salData = salSnap.exists ? salSnap.data() || {} : {};
      const bA = pickBolsaParaConsumo(salData, pairPreview.conGoceId, anioCiclo);
      const bB = pickBolsaParaConsumo(salData, pairPreview.sinGoceId, anioCiclo);
      saldo_familia_64 = {
        anio_ciclo_consumo: anioCiclo,
        dias_consumo: motor.dias_consumo ?? diasSolicitados,
        con_goce_disponible: bA ? Number(bA.bolsa.disponible) : null,
        sin_goce_disponible: bB ? Number(bB.bolsa.disponible) : null,
        articulo_id_con_goce: pairPreview.conGoceId,
        articulo_id_sin_goce: pairPreview.sinGoceId,
      };
    }
  }

  return {
    ...base,
    articulo_id: motor.articulo_id || articuloId,
    articulo_id_solicitado: motor.articulo_id_solicitado || articuloId,
    version_id: motor.version_id || versionId,
    ...(motor.familia_64_ruta ? { familia_64_ruta: motor.familia_64_ruta } : {}),
    sin_descuento_bolsa_ciclo: sinBolsaCiclo,
    ...(saldo_familia_64 ? { saldo_familia_64 } : {}),
    ...(causal_larga_duracion_id ? { causal_larga_duracion_id } : {}),
    ...(licencia_medica_preview ? { licencia_medica_preview } : {}),
    ...(sinBolsaCiclo
      ? {}
      : {
          saldo_ciclo: {
            anio_ciclo_consumo: motor.anio_ciclo_consumo,
            dias_consumo: motor.dias_consumo,
            saldo_disponible: motor.saldo_disponible,
            saldo_restante_preview: motor.saldo_restante_preview,
            bolsa_id: motor.bolsa_id || null,
          },
        }),
    frecuencia_mes: motor.frecuencia_mes || null,
    calendario_resumen: motor.calendario_resumen || null,
    modo_computo: motor.modo_computo || null,
    usa_calendario_institucional: motor.usa_calendario_institucional === true,
    incluye_feriados_institucionales: motor.incluye_feriados_institucionales === true,
  };
});

module.exports = { previsualizarSolicitudPatronB };
