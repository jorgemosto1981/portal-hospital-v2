"use strict";

const { SCHEMA_MED_AVISO, ESTADO_PENDIENTE_CLASIFICACION } = require("./avisoMedicoCajaNegraCore");
const { resolverRangoYmdEfectivoAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");
const {
  esLicenciaMedicaCortaAnual,
  esLicenciaMedicaLargaEpisodio,
} = require("./licenciaMedicaTramosCore");
const { buildLicenciaMedicaPreviewParaPatronB } = require("./licenciaMedicaPreviewPatronB");
const {
  resolverArticuloLicenciaMedicaPublicado,
} = require("./resolverArticuloLicenciaMedicaClasificacionCore");
const { diasCorridosInclusive } = require("./clasificarSolicitudMedicaAuditorCore");

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
  return { codigo, descripcion };
}

/**
 * Preview normativo para dictamen auditor (sin persistir). RFC Caja Negra §5.3.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solicitudId: string,
 *   articuloId?: string,
 *   versionIdAplicada?: string,
 *   fechaDesde?: string,
 *   fechaHasta?: string,
 *   causalLargaDuracionId?: string,
 * }} input
 */
async function previsualizarClasificacionMedicaAuditor(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  if (!/^sol_/i.test(solicitudId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO", mensaje: "solicitud_id inválido." };
  }

  const snap = await db.collection("solicitudes_articulo").doc(solicitudId).get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADA", mensaje: "Solicitud no encontrada." };
  }

  const d = snap.data() || {};
  if (d.schema_version !== SCHEMA_MED_AVISO) {
    return { ok: false, codigo: "SCHEMA_INVALIDO", mensaje: "No es un aviso médico Caja Negra." };
  }
  if (d.estado_solicitud_id !== ESTADO_PENDIENTE_CLASIFICACION) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "La solicitud no está pendiente de clasificación.",
    };
  }

  const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : {};
  if (ing.es_licencia_incompleta === true) {
    return {
      ok: false,
      codigo: "AVISO_INCOMPLETO",
      mensaje: "Complete el certificado antes de previsualizar tramos.",
    };
  }

  const rangoEfectivo = resolverRangoYmdEfectivoAvisoMedico(d);
  let fechaDesde = String(input.fechaDesde || "").slice(0, 10);
  let fechaHasta = String(input.fechaHasta || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) && rangoEfectivo) {
    fechaDesde = rangoEfectivo.fecha_desde;
    fechaHasta = rangoEfectivo.fecha_hasta;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta) ||
    fechaHasta < fechaDesde
  ) {
    return { ok: false, codigo: "FECHAS_INVALIDAS", mensaje: "Rango de fechas inválido." };
  }

  const dias = diasCorridosInclusive(fechaDesde, fechaHasta);
  if (dias < 1) {
    return { ok: false, codigo: "DIAS_INVALIDOS", mensaje: "El período debe tener al menos un día." };
  }

  let articuloId = String(input.articuloId || d.articulo_id || "").trim();
  let versionIdAplicada = String(
    input.versionIdAplicada || d.version_id_aplicada || d.version_aplicada_id || "",
  ).trim();

  if (!/^art_/i.test(articuloId) || !/^ver_/i.test(versionIdAplicada)) {
    const causalLargaIdProbe = resolverCausalLargaDuracionId(input, d);
    const cie10Probe = resolverCie10DesdeSolicitud(d);
    const intentLarga = /^cfg_cld_/i.test(causalLargaIdProbe) && Boolean(cie10Probe);
    const resuelto = await resolverArticuloLicenciaMedicaPublicado(db, intentLarga ? "larga" : "corta");
    if (!resuelto?.articuloId || !resuelto?.versionId) {
      return {
        ok: false,
        codigo: "ARTICULO_VERSION_INVALIDO",
        mensaje: "No hay artículo de licencia médica publicado para la previsualización.",
      };
    }
    articuloId = resuelto.articuloId;
    versionIdAplicada = resuelto.versionId;
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

  const titular = String(d.titular_persona_id || "").trim();
  const anio = Number(fechaDesde.slice(0, 4));
  const causalLargaId = resolverCausalLargaDuracionId(input, d);

  const preview = await buildLicenciaMedicaPreviewParaPatronB(db, {
    versionData: ver.versionData,
    titular_persona_id: titular,
    anio_calendario: anio,
    fecha_desde: fechaDesde,
    dias_solicitados: dias,
    causal_larga_duracion_id: /^cfg_cld_/i.test(causalLargaId) ? causalLargaId : null,
    dictamen_favorable: false,
  });

  if (!preview) {
    return {
      ok: false,
      codigo: "PREVIEW_NO_DISPONIBLE",
      mensaje: "No se pudo calcular la previsualización para este artículo.",
    };
  }

  const modo_preview = esCorta ? "corta_anual" : "larga_episodio";
  const requiere_junta_medica = dias > 15;

  return {
    ok: true,
    solicitud_id: solicitudId,
    titular_persona_id: titular,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    dias_solicitados: dias,
    articulo_id: articuloId,
    version_id_aplicada: versionIdAplicada,
    modo_preview,
    requiere_junta_medica,
    preview,
    mensaje_ui: String(preview.mensaje_ui || "").trim(),
    mensaje_ui_corto: String(preview.mensaje_ui_corto || "").trim(),
    solo_informativo: true,
  };
}

module.exports = { previsualizarClasificacionMedicaAuditor };
