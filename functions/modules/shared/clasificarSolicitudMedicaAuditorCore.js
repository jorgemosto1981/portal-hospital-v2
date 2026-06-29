"use strict";

const { FieldValue } = require("./context");
const { SCHEMA_MED_AVISO, ESTADO_PENDIENTE_CLASIFICACION } = require("./avisoMedicoCajaNegraCore");
const { iterarYmdInclusive } = require("./mdcRdaDocumentIds");
const {
  esLicenciaMedicaCortaAnual,
  calcularTramosLicenciaMedicaCorta,
  CFG_MLM_CORTA_ANUAL,
} = require("./licenciaMedicaTramosCore");
const { sumarConsumoCortaAnualAprobado } = require("./licenciaMedicaConsumoCortaAnual");

const ESTADO_RECHAZADA = "cfg_esa_rechazada";
const ESTADO_APROBADA = "cfg_esa_aprobada";
const ESTADO_ESPERANDO_JUNTA = "cfg_esa_esperando_dictamen_junta";

/**
 * @param {string} desde
 * @param {string} hasta
 */
function diasCorridosInclusive(desde, hasta) {
  return iterarYmdInclusive(desde, hasta).length;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {string} versionId
 */
async function cargarVersionArticulo(db, articuloId, versionId) {
  const art = String(articuloId || "").trim();
  const ver = String(versionId || "").trim();
  if (!/^art_/i.test(art) || !/^ver_/i.test(ver)) {
    return { ok: false, codigo: "ARTICULO_VERSION_INVALIDO", mensaje: "Artículo o versión inválidos." };
  }
  const snap = await db.collection("cfg_articulos").doc(art).collection("versiones").doc(ver).get();
  if (!snap.exists) {
    return { ok: false, codigo: "VERSION_NO_ENCONTRADA", mensaje: "Versión de artículo no encontrada." };
  }
  return { ok: true, versionData: snap.data() || {}, articuloId: art, versionId: ver };
}

/**
 * Clasificación médica auditor — Caja Negra (RFC §5).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solicitudId: string,
 *   auditorPersonaId: string,
 *   articuloId: string,
 *   versionIdAplicada: string,
 *   fechaDesde: string,
 *   fechaHasta: string,
 *   grupoTrabajoIdAncla?: string,
 *   observacionAuditor?: string,
 *   dictamenFavorable: boolean,
 * }} input
 */
async function clasificarSolicitudMedicaAuditor(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  const auditorPersonaId = String(input.auditorPersonaId || "").trim();
  const articuloId = String(input.articuloId || "").trim();
  const versionIdAplicada = String(input.versionIdAplicada || "").trim();
  const fechaDesde = String(input.fechaDesde || "").slice(0, 10);
  const fechaHasta = String(input.fechaHasta || "").slice(0, 10);
  const dictamenFavorable = input.dictamenFavorable === true;

  if (!/^sol_/i.test(solicitudId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO", mensaje: "solicitud_id inválido." };
  }
  if (!/^per_/i.test(auditorPersonaId)) {
    return { ok: false, codigo: "AUDITOR_INVALIDO", mensaje: "Auditor inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta) || fechaHasta < fechaDesde) {
    return { ok: false, codigo: "FECHAS_INVALIDAS", mensaje: "Rango de fechas inválido." };
  }

  const ref = db.collection("solicitudes_articulo").doc(solicitudId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADA", mensaje: "Solicitud no encontrada." };
  }

  const d = snap.data() || {};
  if (d.schema_version !== SCHEMA_MED_AVISO) {
    return { ok: false, codigo: "SCHEMA_INVALIDO", mensaje: "No es un aviso médico Caja Negra." };
  }
  if (d.estado_solicitud_id !== ESTADO_PENDIENTE_CLASIFICACION) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud no está pendiente de clasificación." };
  }

  const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : {};
  if (ing.es_licencia_incompleta === true) {
    return {
      ok: false,
      codigo: "AVISO_INCOMPLETO",
      mensaje: "El agente debe completar el certificado antes de la clasificación.",
    };
  }
  const adjuntos = Array.isArray(ing.adjuntos) ? ing.adjuntos : [];
  if (!adjuntos.length) {
    return { ok: false, codigo: "SIN_CERTIFICADO", mensaje: "Falta certificado médico en el aviso." };
  }

  const clasificacionBase = {
    auditor_persona_id: auditorPersonaId,
    clasificado_en: FieldValue.serverTimestamp(),
    articulo_id: articuloId,
    version_id_aplicada: versionIdAplicada,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    ...(input.observacionAuditor
      ? { observacion_auditor: String(input.observacionAuditor).slice(0, 2000) }
      : {}),
  };

  if (!dictamenFavorable) {
    await ref.update({
      estado_solicitud_id: ESTADO_RECHAZADA,
      auditor_medico_clasificacion: {
        ...clasificacionBase,
        dictamen_favorable: false,
      },
      actualizado_en: FieldValue.serverTimestamp(),
    });
    return {
      ok: true,
      solicitud_id: solicitudId,
      estado_solicitud_id: ESTADO_RECHAZADA,
      mensaje_ui: "Solicitud rechazada por medicina laboral.",
    };
  }

  const ver = await cargarVersionArticulo(db, articuloId, versionIdAplicada);
  if (!ver.ok) return ver;
  if (!esLicenciaMedicaCortaAnual(ver.versionData)) {
    return {
      ok: false,
      codigo: "ARTICULO_NO_CORTA_ANUAL",
      mensaje: "En esta fase solo se clasifican artículos de licencia médica corta anual.",
    };
  }

  const dias = diasCorridosInclusive(fechaDesde, fechaHasta);
  if (dias < 1) {
    return { ok: false, codigo: "DIAS_INVALIDOS", mensaje: "El período debe tener al menos un día." };
  }

  const anio = Number(fechaDesde.slice(0, 4));
  const titular = String(d.titular_persona_id || "").trim();
  const consumido_previo = await sumarConsumoCortaAnualAprobado(db, {
    titular_persona_id: titular,
    anio_calendario: anio,
  });
  const tramosCalc = calcularTramosLicenciaMedicaCorta({
    consumido_previo,
    dias_solicitados: dias,
  });

  const requiereJunta = dias > 15;
  const estadoDestino = requiereJunta ? ESTADO_ESPERANDO_JUNTA : ESTADO_APROBADA;

  /** @type {Record<string, unknown>} */
  const patch = {
    articulo_id: articuloId,
    version_id_aplicada: versionIdAplicada,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    dias_solicitados: dias,
    estado_solicitud_id: estadoDestino,
    auditor_medico_clasificacion: {
      ...clasificacionBase,
      dictamen_favorable: true,
      dias_solicitados: dias,
      requiere_junta_medica: requiereJunta,
    },
    actualizado_en: FieldValue.serverTimestamp(),
  };

  const gdt = String(input.grupoTrabajoIdAncla || d.grupo_trabajo_id_ancla || "").trim();
  if (/^gdt_/i.test(gdt)) {
    patch.grupo_trabajo_id_ancla = gdt;
  }

  if (!requiereJunta) {
    patch.licencia_medica = {
      modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
      anio_calendario: anio,
      consumido_previo_al_aprobar: consumido_previo,
      tramos_haberes: tramosCalc.tramos_haberes,
      dias_solicitud_total: dias,
    };
  }

  await ref.update(patch);

  return {
    ok: true,
    solicitud_id: solicitudId,
    estado_solicitud_id: estadoDestino,
    dias_solicitados: dias,
    requiere_junta_medica: requiereJunta,
    preview_tramos: tramosCalc.tramos_haberes,
    mensaje_ui: requiereJunta
      ? "Clasificación registrada. La solicitud quedó a la espera del dictamen de junta médica."
      : "Licencia médica otorgada. Medicina laboral aplicó los tramos de haberes.",
  };
}

module.exports = {
  ESTADO_RECHAZADA,
  ESTADO_APROBADA,
  ESTADO_ESPERANDO_JUNTA,
  clasificarSolicitudMedicaAuditor,
  diasCorridosInclusive,
};
