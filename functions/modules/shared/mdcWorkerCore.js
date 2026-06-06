"use strict";

const { FieldValue } = require("./context");
const {
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_AUTORIZAR_JEFE,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
  MDC_COMANDO_REINTENTAR_CONSOLIDACION,
  MDC_COMANDO_VERSION,
  COL_ASISTENCIA_DIARIA,
  COL_MDC_IDEMPOTENCIA,
  ESTADO_INSTANCIA_PENDIENTE,
  ESTADO_INSTANCIA_APROBADO,
  ESTADO_CONSOLIDADO_LABORABLE,
  ESTADO_CONSOLIDADO_PENDIENTE_REVISION,
  ESTADO_CONSOLIDADO_AUTORIZADO_JEFE,
} = require("./mdcComandosConstants");
const {
  buildAsiDocumentId,
  iterarYmdInclusive,
} = require("./mdcRdaDocumentIds");
const { fanOutVisDesdeAsi } = require("./mdcFanOutVis");
const { enriquecerPayloadMdcDesdeVersion } = require("./mdcVersionEnriquecimiento");
const {
  assertNuevaSolicitudNoEnPeriodoCerrado,
  esEstadoSolicitudEnTramite,
} = require("../asistencia/asistenciaPeriodoLiquidacion");

/**
 * @param {string} solId
 * @param {string} comando
 */
function idempotenciaDocId(solId, comando) {
  return `${String(solId).trim()}_${String(comando).trim()}_v${MDC_COMANDO_VERSION}`;
}

/**
 * @param {Record<string, unknown>} payload
 */
function normalizarPayload(payload) {
  return {
    comando: String(payload.comando || "").trim(),
    comando_version: Number(payload.comando_version) || MDC_COMANDO_VERSION,
    sol_id: String(payload.sol_id || "").trim(),
    persona_id: String(payload.persona_id || "").trim(),
    articulo_id: String(payload.articulo_id || "").trim(),
    version_id_aplicada:
      String(
        payload.version_id_aplicada ||
          payload.version_aplicada_id ||
          payload.version_aplicada ||
          payload.version_id ||
          "",
      ).trim() || null,
    fecha_desde: String(payload.fecha_desde || "").slice(0, 10),
    fecha_hasta: String(payload.fecha_hasta || payload.fecha_desde || "").slice(0, 10),
    codigo_grilla: String(payload.codigo_grilla || "").trim(),
    grupo_trabajo_id_ancla:
      String(payload.grupo_trabajo_id_ancla || payload.grupo_de_trabajo_id || "").trim() || null,
    grupos_trabajo_involucrados_ids: Array.isArray(payload.grupos_trabajo_involucrados_ids)
      ? payload.grupos_trabajo_involucrados_ids
        .map((g) => String(g || "").trim())
        .filter((g) => /^gdt_/i.test(g))
      : [],
    estado_solicitud_id: String(payload.estado_solicitud_id || "").trim() || null,
    autorizacion_rrhh_sustituta: payload.autorizacion_rrhh_sustituta === true,
    nivel_ocupacion_dia_id: String(payload.nivel_ocupacion_dia_id || "").trim() || null,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} rawPayload
 */
async function procesarComandoMdc(db, rawPayload) {
  let p = normalizarPayload(rawPayload);
  p = await enriquecerPayloadMdcDesdeVersion(db, p);
  if (!p.sol_id || !p.persona_id || !p.comando) {
    return { ok: false, codigo: "PAYLOAD_INVALIDO", mensaje: "Payload MDC incompleto." };
  }

  const idemRef = db.collection(COL_MDC_IDEMPOTENCIA).doc(idempotenciaDocId(p.sol_id, p.comando));
  const idemSnap = await idemRef.get();
  if (idemSnap.exists && p.comando !== MDC_COMANDO_REINTENTAR_CONSOLIDACION) {
    return { ok: true, skipped: true, codigo: "IDEMPOTENTE" };
  }

  const dias = iterarYmdInclusive(p.fecha_desde, p.fecha_hasta);
  if (!dias.length) {
    return { ok: false, codigo: "FECHAS_INVALIDAS", mensaje: "Rango de fechas inválido." };
  }

  const gdtAncla = p.grupo_trabajo_id_ancla;
  if (gdtAncla) {
    const enTramite = esEstadoSolicitudEnTramite(p.estado_solicitud_id);
    const comandoCierraWorkflow =
      p.comando === MDC_COMANDO_CONSOLIDAR_APROBADO ||
      p.comando === MDC_COMANDO_REVERTIR_PROYECCION ||
      p.comando === MDC_COMANDO_AUTORIZAR_JEFE;
    if (!enTramite && !comandoCierraWorkflow) {
      try {
        await assertNuevaSolicitudNoEnPeriodoCerrado(
          db,
          p.persona_id,
          p.fecha_desde,
          p.fecha_hasta,
          gdtAncla,
        );
      } catch (err) {
        return {
          ok: false,
          codigo: "ASI-PER-001",
          mensaje: err instanceof Error ? err.message : "Período cerrado.",
        };
      }
    }
  }

  const aporteBase = {
    sol_id: p.sol_id,
    articulo_id: p.articulo_id,
    codigo_grilla: p.codigo_grilla,
    version_id_aplicada: p.version_id_aplicada,
    grupo_trabajo_id_ancla: p.grupo_trabajo_id_ancla,
    actualizado_en: FieldValue.serverTimestamp(),
  };

  if (p.comando === MDC_COMANDO_PROYECTAR_PENDIENTE) {
    for (const ymd of dias) {
      await aplicarProyeccionPendienteDia(db, p, ymd, aporteBase);
    }
  } else if (p.comando === MDC_COMANDO_AUTORIZAR_JEFE) {
    for (const ymd of dias) {
      await aplicarAutorizacionJefeDia(db, p, ymd, aporteBase);
    }
  } else if (
    p.comando === MDC_COMANDO_CONSOLIDAR_APROBADO ||
    p.comando === MDC_COMANDO_REINTENTAR_CONSOLIDACION
  ) {
    for (const ymd of dias) {
      await aplicarConsolidadoDia(db, p, ymd, aporteBase);
    }
  } else if (p.comando === MDC_COMANDO_REVERTIR_PROYECCION) {
    for (const ymd of dias) {
      await aplicarReversoDia(db, p, ymd);
    }
  } else {
    return { ok: false, codigo: "COMANDO_DESCONOCIDO", mensaje: "Comando MDC no reconocido." };
  }

  await idemRef.set({
    sol_id: p.sol_id,
    comando: p.comando,
    comando_version: p.comando_version,
    aplicado_en: FieldValue.serverTimestamp(),
    persona_id: p.persona_id,
  });

  return { ok: true, comando: p.comando, dias_afectados: dias.length };
}

async function aplicarProyeccionPendienteDia(db, p, ymd, aporteBase) {
  const asiId = buildAsiDocumentId(p.persona_id, ymd);
  if (!asiId) return;
  const asiRef = db.collection(COL_ASISTENCIA_DIARIA).doc(asiId);
  const aporte = {
    ...aporteBase,
    estado_instancia: ESTADO_INSTANCIA_PENDIENTE,
    estado_solicitud_id: p.estado_solicitud_id,
  };

  await asiRef.set(
    {
      id: asiId,
      persona_id: p.persona_id,
      fecha_ymd: ymd,
      periodo: ymd.slice(0, 7),
      [`aportes_normativos.${p.sol_id}`]: aporte,
      tiene_tramite_pendiente: true,
      estado_consolidado: ESTADO_CONSOLIDADO_PENDIENTE_REVISION,
      actualizado_en: FieldValue.serverTimestamp(),
      creado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await fanOutVisDesdeAsi(db, {
    persona_id: p.persona_id,
    fecha_ymd: ymd,
    sol_id: p.sol_id,
    articulo_id: p.articulo_id,
    codigo_grilla: p.codigo_grilla,
    estado_solicitud_id: p.estado_solicitud_id || "cfg_esa_en_revision_jefe",
    nivel_ocupacion_dia_id: p.nivel_ocupacion_dia_id,
    grupos_trabajo_involucrados_ids: p.grupos_trabajo_involucrados_ids,
    grupo_trabajo_id_ancla: p.grupo_trabajo_id_ancla,
    modo: "pendiente",
  });
}

async function aplicarAutorizacionJefeDia(db, p, ymd, aporteBase) {
  const asiId = buildAsiDocumentId(p.persona_id, ymd);
  if (!asiId) return;
  const asiRef = db.collection(COL_ASISTENCIA_DIARIA).doc(asiId);
  const estadoSol =
    p.estado_solicitud_id || "cfg_esa_en_revision_rrhh";
  const aporte = {
    ...aporteBase,
    estado_instancia: ESTADO_INSTANCIA_PENDIENTE,
    estado_solicitud_id: estadoSol,
  };

  await asiRef.set(
    {
      [`aportes_normativos.${p.sol_id}`]: aporte,
      tiene_tramite_pendiente: true,
      estado_consolidado: ESTADO_CONSOLIDADO_AUTORIZADO_JEFE,
      actualizado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await fanOutVisDesdeAsi(db, {
    persona_id: p.persona_id,
    fecha_ymd: ymd,
    sol_id: p.sol_id,
    articulo_id: p.articulo_id,
    codigo_grilla: p.codigo_grilla,
    estado_solicitud_id: estadoSol,
    nivel_ocupacion_dia_id: p.nivel_ocupacion_dia_id,
    grupos_trabajo_involucrados_ids: p.grupos_trabajo_involucrados_ids,
    grupo_trabajo_id_ancla: p.grupo_trabajo_id_ancla,
    modo: "pendiente",
  });
}

async function aplicarConsolidadoDia(db, p, ymd, aporteBase) {
  const asiId = buildAsiDocumentId(p.persona_id, ymd);
  if (!asiId) return;
  const asiRef = db.collection(COL_ASISTENCIA_DIARIA).doc(asiId);
  const aporte = {
    ...aporteBase,
    estado_instancia: ESTADO_INSTANCIA_APROBADO,
    estado_solicitud_id: p.estado_solicitud_id || "cfg_esa_aprobada",
  };

  await asiRef.set(
    {
      [`aportes_normativos.${p.sol_id}`]: aporte,
      tiene_tramite_pendiente: false,
      estado_consolidado: p.codigo_grilla || ESTADO_CONSOLIDADO_LABORABLE,
      actualizado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await fanOutVisDesdeAsi(db, {
    persona_id: p.persona_id,
    fecha_ymd: ymd,
    sol_id: p.sol_id,
    articulo_id: p.articulo_id,
    codigo_grilla: p.codigo_grilla,
    estado_solicitud_id: p.estado_solicitud_id || "cfg_esa_aprobada",
    nivel_ocupacion_dia_id: p.nivel_ocupacion_dia_id,
    grupos_trabajo_involucrados_ids: p.grupos_trabajo_involucrados_ids,
    grupo_trabajo_id_ancla: p.grupo_trabajo_id_ancla,
    modo: "aprobado",
  });
}

async function aplicarReversoDia(db, p, ymd) {
  const asiId = buildAsiDocumentId(p.persona_id, ymd);
  if (!asiId) return;
  const asiRef = db.collection(COL_ASISTENCIA_DIARIA).doc(asiId);

  await asiRef.set(
    {
      [`aportes_normativos.${p.sol_id}`]: FieldValue.delete(),
      tiene_tramite_pendiente: false,
      estado_consolidado: ESTADO_CONSOLIDADO_LABORABLE,
      actualizado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await fanOutVisDesdeAsi(db, {
    persona_id: p.persona_id,
    fecha_ymd: ymd,
    sol_id: p.sol_id,
    articulo_id: p.articulo_id,
    codigo_grilla: p.codigo_grilla,
    estado_solicitud_id: "cfg_esa_rechazada",
    grupos_trabajo_involucrados_ids: p.grupos_trabajo_involucrados_ids,
    grupo_trabajo_id_ancla: p.grupo_trabajo_id_ancla,
    modo: "revertir",
  });
}

/**
 * @param {Record<string, unknown>} sol
 * @param {string} comando
 */
function buildMdcPayloadDesdeSolicitud(sol, comando) {
  const d = sol || {};
  return {
    comando,
    comando_version: MDC_COMANDO_VERSION,
    sol_id: String(d.id || d.sol_id || "").trim(),
    persona_id: String(d.titular_persona_id || "").trim(),
    articulo_id: String(d.articulo_id || "").trim(),
    version_id_aplicada:
      String(
        d.version_id_aplicada ||
          d.version_aplicada_id ||
          d.version_aplicada ||
          d.version_id ||
          "",
      ).trim() || null,
    fecha_desde: String(d.fecha_desde || "").slice(0, 10),
    fecha_hasta: String(d.fecha_hasta || d.fecha_desde || "").slice(0, 10),
    codigo_grilla: String(d.codigo_grilla || d.articulo_codigo || "").trim(),
    grupo_trabajo_id_ancla:
      String(d.grupo_trabajo_id_ancla || d.grupo_de_trabajo_id || "").trim() || null,
    grupos_trabajo_involucrados_ids: Array.isArray(d.grupos_trabajo_involucrados_ids)
      ? d.grupos_trabajo_involucrados_ids
        .map((g) => String(g || "").trim())
        .filter((g) => /^gdt_/i.test(g))
      : [],
    estado_solicitud_id: String(d.estado_solicitud_id || "").trim() || null,
    autorizacion_rrhh_sustituta: d.autorizacion_rrhh_sustituta === true,
  };
}

module.exports = {
  procesarComandoMdc,
  buildMdcPayloadDesdeSolicitud,
  normalizarPayload,
};
