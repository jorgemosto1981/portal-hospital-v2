"use strict";

const { FieldValue } = require("./context");
const { SCHEMA_MED_AVISO, ESTADO_PENDIENTE_CLASIFICACION } = require("./avisoMedicoCajaNegraCore");
const { resolverRangoYmdAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");
const {
  mutarEstadoSolicitudMedicaMdc,
} = require("./mutarEstadoSolicitudMedicaMdc");
const { iterarYmdInclusive } = require("./mdcRdaDocumentIds");
const {
  esLicenciaMedicaCortaAnual,
  esLicenciaMedicaLargaEpisodio,
  leerModoLicenciaMedicaDesdeVersion,
} = require("./licenciaMedicaTramosCore");
const { proyectarEpisodioContinuo } = require("./licenciaMedicaEpisodioCore");
const { aplicarLicenciaMedicaAprobada } = require("./aplicarLicenciaMedicaAprobadaCore");
const { sumarConsumoEpisodioLargaAprobado } = require("./licenciaMedicaConsumoEpisodio");
const {
  resolverArticuloLicenciaMedicaPublicado,
} = require("./resolverArticuloLicenciaMedicaClasificacionCore");

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
 * @param {{ causalLargaDuracionId?: string }} input
 * @param {Record<string, unknown>} d
 */
function resolverCausalLargaDuracionId(input, d) {
  const lm = d.licencia_medica && typeof d.licencia_medica === "object" ? d.licencia_medica : null;
  const desdeLm =
    lm && typeof lm.causal_larga_duracion_id === "string" ? lm.causal_larga_duracion_id : "";
  return String(
    input.causalLargaDuracionId || d.causal_larga_duracion_id || desdeLm || "",
  ).trim();
}

/**
 * @param {Record<string, unknown>} d
 */
function resolverCie10DesdeSolicitud(d) {
  const c = d.cie10;
  if (!c || typeof c !== "object") return null;
  const codigo = String(c.codigo || "").trim();
  const descripcion = String(c.descripcion || "").trim();
  if (!codigo || !descripcion) return null;
  return { codigo, descripcion, fecha_imputacion: c.fecha_imputacion ?? null };
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
 *   causalLargaDuracionId?: string,
 * }} input
 */
async function clasificarSolicitudMedicaAuditor(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  const auditorPersonaId = String(input.auditorPersonaId || "").trim();
  let articuloId = String(input.articuloId || "").trim();
  let versionIdAplicada = String(input.versionIdAplicada || "").trim();
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

  articuloId = articuloId || String(d.articulo_id || "").trim();
  versionIdAplicada =
    versionIdAplicada ||
    String(d.version_id_aplicada || d.version_aplicada_id || d.version_aplicada || "").trim();

  if (dictamenFavorable && (!/^art_/i.test(articuloId) || !/^ver_/i.test(versionIdAplicada))) {
    const causalLargaIdProbe = resolverCausalLargaDuracionId(input, d);
    const cie10Probe = resolverCie10DesdeSolicitud(d);
    const intentLarga = /^cfg_cld_/i.test(causalLargaIdProbe) && Boolean(cie10Probe);
    const resuelto = await resolverArticuloLicenciaMedicaPublicado(db, intentLarga ? "larga" : "corta");
    if (!resuelto?.articuloId || !resuelto?.versionId) {
      return {
        ok: false,
        codigo: "ARTICULO_VERSION_INVALIDO",
        mensaje: intentLarga
          ? "No hay artículo 16 (licencia larga) publicado en catálogo."
          : "No hay artículo 14 (licencia médica corta) publicado. Verifique cfg_articulos o indique artículo en la clasificación.",
      };
    }
    articuloId = resuelto.articuloId;
    versionIdAplicada = resuelto.versionId;
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

  const rangoProyeccionAnterior = resolverRangoYmdAvisoMedico(d);

  if (!dictamenFavorable) {
    await ref.update({
      estado_solicitud_id: ESTADO_RECHAZADA,
      auditor_medico_clasificacion: {
        ...clasificacionBase,
        dictamen_favorable: false,
      },
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
      mensaje_ui: "Solicitud rechazada por medicina laboral.",
      mdc_mutacion: mdc,
    };
  }

  const ver = await cargarVersionArticulo(db, articuloId, versionIdAplicada);
  if (!ver.ok) return ver;

  const esCorta = esLicenciaMedicaCortaAnual(ver.versionData);
  const esLarga = esLicenciaMedicaLargaEpisodio(ver.versionData);
  if (!esCorta && !esLarga) {
    return {
      ok: false,
      codigo: "ARTICULO_NO_LICENCIA_MEDICA",
      mensaje: "El artículo no es licencia médica corta ni larga episodio.",
    };
  }

  const dias = diasCorridosInclusive(fechaDesde, fechaHasta);
  if (dias < 1) {
    return { ok: false, codigo: "DIAS_INVALIDOS", mensaje: "El período debe tener al menos un día." };
  }

  const titular = String(d.titular_persona_id || "").trim();
  const requiereJunta = dias > 15;
  const estadoDestino = requiereJunta ? ESTADO_ESPERANDO_JUNTA : ESTADO_APROBADA;
  const modoLicencia = leerModoLicenciaMedicaDesdeVersion(ver.versionData);

  let causalLargaId = null;
  if (esLarga) {
    causalLargaId = resolverCausalLargaDuracionId(input, d);
    if (!/^cfg_cld_/i.test(causalLargaId)) {
      return {
        ok: false,
        codigo: "CAUSAL_LARGA_REQUERIDA",
        mensaje:
          "Licencia larga: indicá causal_larga_duracion_id (Art. 19) en el aviso o en la clasificación.",
      };
    }
    const cie10 = resolverCie10DesdeSolicitud(d);
    if (!cie10) {
      return {
        ok: false,
        codigo: "CIE10_REQUERIDO",
        mensaje: "Licencia larga: falta diagnóstico CIE-10 en la solicitud.",
      };
    }
  }

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
      ...(esLarga ? { causal_larga_duracion_id: causalLargaId } : {}),
      ...(esLarga ? { cie10: resolverCie10DesdeSolicitud(d) } : {}),
    },
    actualizado_en: FieldValue.serverTimestamp(),
  };

  if (esLarga) {
    patch.causal_larga_duracion_id = causalLargaId;
    const cie10 = resolverCie10DesdeSolicitud(d);
    if (cie10) patch.cie10 = cie10;
  }

  const gdt = String(input.grupoTrabajoIdAncla || d.grupo_trabajo_id_ancla || "").trim();
  if (/^gdt_/i.test(gdt)) {
    patch.grupo_trabajo_id_ancla = gdt;
  }

  let tramosCalc = { tramos_haberes: {} };
  let episodioPreview = null;

  if (!requiereJunta) {
    const aplicado = await aplicarLicenciaMedicaAprobada(db, {
      titular_persona_id: titular,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      dias_solicitados: dias,
      requiere_junta_medica: false,
      modo_licencia_medica_id: modoLicencia || undefined,
      causal_larga_duracion_id: causalLargaId,
    });
    if (!aplicado.ok) return aplicado;
    patch.licencia_medica = aplicado.licencia_medica;
    tramosCalc = { tramos_haberes: aplicado.tramos_haberes || {} };
    episodioPreview = aplicado.episodio_preview || null;
  } else if (esLarga) {
    const consumido_previo_episodio = await sumarConsumoEpisodioLargaAprobado(db, {
      titular_persona_id: titular,
      fecha_desde: fechaDesde,
    });
    const proy = proyectarEpisodioContinuo({
      consumido_previo_episodio,
      dias_solicitados: dias,
    });
    if (proy.excede_tope_continuo) {
      return {
        ok: false,
        codigo: "EXCEDE_TOPE_EPISODIO",
        mensaje: `El episodio continuo superaría ${proy.tope_episodio_dias} días.`,
      };
    }
    episodioPreview = proy;
  }

  await ref.update(patch);

  const mdc = await mutarEstadoSolicitudMedicaMdc(db, {
    solicitudId,
    estadoDestino,
    rangoProyeccionAnterior,
  });

  const mensajeJunta = esLarga
    ? "Clasificación registrada (licencia larga). La solicitud quedó a la espera del dictamen de junta médica."
    : "Clasificación registrada. La solicitud quedó a la espera del dictamen de junta médica.";
  const mensajeAprobada = esLarga
    ? "Licencia médica larga otorgada. Episodio continuo registrado (S_MED_LARGA)."
    : "Licencia médica otorgada. Medicina laboral aplicó los tramos de haberes.";

  return {
    ok: true,
    solicitud_id: solicitudId,
    estado_solicitud_id: estadoDestino,
    dias_solicitados: dias,
    requiere_junta_medica: requiereJunta,
    preview_tramos: tramosCalc.tramos_haberes,
    ...(esLarga && causalLargaId ? { causal_larga_duracion_id: causalLargaId } : {}),
    ...(episodioPreview ? { preview_episodio: episodioPreview } : {}),
    mensaje_ui: requiereJunta ? mensajeJunta : mensajeAprobada,
    mdc_mutacion: mdc,
  };
}

module.exports = {
  ESTADO_RECHAZADA,
  ESTADO_APROBADA,
  ESTADO_ESPERANDO_JUNTA,
  clasificarSolicitudMedicaAuditor,
  diasCorridosInclusive,
};
