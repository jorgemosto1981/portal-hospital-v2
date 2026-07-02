"use strict";

const { FieldValue } = require("./context");
const { SCHEMA_MED_AVISO } = require("./avisoMedicoCajaNegraCore");
const { resolverRangoYmdEfectivoAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");
const { mutarEstadoSolicitudMedicaMdc } = require("./mutarEstadoSolicitudMedicaMdc");
const { aplicarLicenciaMedicaAprobada } = require("./aplicarLicenciaMedicaAprobadaCore");
const {
  ESTADO_RECHAZADA,
  ESTADO_APROBADA,
  ESTADO_ESPERANDO_JUNTA,
  diasCorridosInclusive,
} = require("./clasificarSolicitudMedicaAuditorCore");

const COL_SOL = "solicitudes_articulo";

/**
 * Dictamen de junta médica — Caja Negra (RFC §5.3 paso 7).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solicitudId: string,
 *   registradoPorPersonaId: string,
 *   dictamenFavorable: boolean,
 *   observacionJunta?: string,
 *   juntaMedicaSedeId?: string,
 * }} input
 */
async function registrarDictamenJuntaMedica(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  const registradoPorPersonaId = String(input.registradoPorPersonaId || "").trim();
  const dictamenFavorable = input.dictamenFavorable === true;

  if (!/^sol_/i.test(solicitudId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO", mensaje: "solicitud_id inválido." };
  }
  if (!/^per_/i.test(registradoPorPersonaId)) {
    return { ok: false, codigo: "REGISTRANTE_INVALIDO", mensaje: "Persona registrante inválida." };
  }

  const ref = db.collection(COL_SOL).doc(solicitudId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADA", mensaje: "Solicitud no encontrada." };
  }

  const d = snap.data() || {};
  if (d.schema_version !== SCHEMA_MED_AVISO) {
    return { ok: false, codigo: "SCHEMA_INVALIDO", mensaje: "No es un aviso médico Caja Negra." };
  }
  if (d.estado_solicitud_id !== ESTADO_ESPERANDO_JUNTA) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "La solicitud no está a la espera de dictamen de junta.",
    };
  }

  const clasif =
    d.auditor_medico_clasificacion && typeof d.auditor_medico_clasificacion === "object"
      ? d.auditor_medico_clasificacion
      : null;
  if (!clasif || clasif.requiere_junta_medica !== true) {
    return {
      ok: false,
      codigo: "SIN_CLASIFICACION_JUNTA",
      mensaje: "Falta clasificación del auditor que derive a junta.",
    };
  }
  if (d.junta_medica_dictamen && typeof d.junta_medica_dictamen === "object") {
    return {
      ok: false,
      codigo: "DICTAMEN_YA_REGISTRADO",
      mensaje: "Ya existe un dictamen de junta para esta solicitud.",
    };
  }

  const fechaDesde = String(d.fecha_desde || clasif.fecha_desde || "").slice(0, 10);
  const fechaHasta = String(d.fecha_hasta || clasif.fecha_hasta || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    return { ok: false, codigo: "FECHAS_INVALIDAS", mensaje: "Rango de fechas inválido en la solicitud." };
  }

  const dias =
    Number.isFinite(Number(d.dias_solicitados)) && Number(d.dias_solicitados) > 0
      ? Math.floor(Number(d.dias_solicitados))
      : diasCorridosInclusive(fechaDesde, fechaHasta);

  const dictamenBase = {
    dictamen_favorable: dictamenFavorable,
    registrado_en: FieldValue.serverTimestamp(),
    registrado_por_persona_id: registradoPorPersonaId,
    ...(input.observacionJunta
      ? { observacion: String(input.observacionJunta).slice(0, 2000) }
      : {}),
    ...(input.juntaMedicaSedeId
      ? { junta_medica_sede_id: String(input.juntaMedicaSedeId).trim() }
      : {}),
  };

  const rangoProyeccionAnterior = resolverRangoYmdEfectivoAvisoMedico(d);

  if (!dictamenFavorable) {
    await ref.update({
      estado_solicitud_id: ESTADO_RECHAZADA,
      junta_medica_dictamen: dictamenBase,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    const mdc = await mutarEstadoSolicitudMedicaMdc(db, {
      solicitudId,
      estadoDestino: ESTADO_RECHAZADA,
      rangoProyeccionAnterior,
    });
    return {
      ok: true,
      solicitud_id: solicitudId,
      estado_solicitud_id: ESTADO_RECHAZADA,
      mensaje_ui: "Dictamen de junta desfavorable. La solicitud quedó rechazada.",
      mdc_mutacion: mdc,
    };
  }

  const titular = String(d.titular_persona_id || "").trim();
  const aplicado = await aplicarLicenciaMedicaAprobada(db, {
    titular_persona_id: titular,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    dias_solicitados: dias,
    requiere_junta_medica: true,
    junta_medica_sede_id: input.juntaMedicaSedeId || dictamenBase.junta_medica_sede_id,
    dictamen: {
      favorable: true,
      registrado_por_persona_id: registradoPorPersonaId,
      ...(dictamenBase.observacion ? { observacion: dictamenBase.observacion } : {}),
    },
  });
  if (!aplicado.ok) return aplicado;

  await ref.update({
    estado_solicitud_id: ESTADO_APROBADA,
    dias_solicitados: dias,
    junta_medica_dictamen: dictamenBase,
    licencia_medica: aplicado.licencia_medica,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const mdc = await mutarEstadoSolicitudMedicaMdc(db, {
    solicitudId,
    estadoDestino: ESTADO_APROBADA,
    rangoProyeccionAnterior,
  });

  return {
    ok: true,
    solicitud_id: solicitudId,
    estado_solicitud_id: ESTADO_APROBADA,
    dias_solicitados: dias,
    licencia_medica: aplicado.licencia_medica,
    tramos_haberes: aplicado.tramos_haberes,
    mensaje_ui: "Dictamen favorable. Licencia médica aprobada con tramos de haberes.",
    mdc_mutacion: mdc,
  };
}

module.exports = {
  registrarDictamenJuntaMedica,
  ESTADO_ESPERANDO_JUNTA,
};
