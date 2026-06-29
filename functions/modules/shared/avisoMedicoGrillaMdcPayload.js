"use strict";

const { SCHEMA_MED_AVISO, ESTADO_PENDIENTE_CLASIFICACION } = require("./avisoMedicoProvisoriosVigentesCore");

/** Código en celda — aviso sin certificado (etapas 1–2 RFC Caja Negra). */
const CODIGO_GRILLA_AVISO_PROVISORIO = "LM-P";
/** Código en celda — aviso completo pendiente de clasificación médica. */
const CODIGO_GRILLA_AVISO_COMPLETO = "LM";
const NIVEL_OCUPACION_AVISO_MEDICO = "cfg_nod_exclusivo";

/**
 * @param {Record<string, unknown>} d
 */
function esSolicitudMedAviso(d) {
  return String(d?.schema_version || "") === SCHEMA_MED_AVISO;
}

/**
 * @param {Record<string, unknown>} d
 */
function resolverCodigoGrillaAvisoMedico(d) {
  const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : {};
  return ing.es_licencia_incompleta === true
    ? CODIGO_GRILLA_AVISO_PROVISORIO
    : CODIGO_GRILLA_AVISO_COMPLETO;
}

/**
 * @param {Record<string, unknown>} d
 * @returns {{ fecha_desde: string, fecha_hasta: string }|null}
 */
function resolverRangoYmdAvisoMedico(d) {
  const desde = String(d.fecha_inicio_reposo_estimada || "").slice(0, 10);
  let hasta = String(d.fecha_fin_reposo_estimada || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) hasta = desde;
  if (hasta < desde) return null;
  return { fecha_desde: desde, fecha_hasta: hasta };
}

/**
 * Rango efectivo para MDC: fechas definitivas post-clasificación o estimadas pre-auditoría.
 * @param {Record<string, unknown>} d
 * @returns {{ fecha_desde: string, fecha_hasta: string }|null}
 */
function resolverRangoYmdEfectivoAvisoMedico(d) {
  const defDesde = String(d.fecha_desde || "").slice(0, 10);
  const defHasta = String(d.fecha_hasta || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(defDesde)) {
    let hasta = defHasta;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) hasta = defDesde;
    if (hasta >= defDesde) {
      return { fecha_desde: defDesde, fecha_hasta: hasta };
    }
  }
  return resolverRangoYmdAvisoMedico(d);
}

/**
 * @param {Record<string, unknown>} d
 * @param {string} solId
 */
function mapSolicitudMedAvisoParaMdc(d, solId) {
  const rango = resolverRangoYmdEfectivoAvisoMedico(d);
  if (!rango) return null;

  const articuloId = String(d.articulo_id || "").trim();
  const codigoExplicito = String(d.codigo_grilla || "").trim();
  const codigoGrilla =
    codigoExplicito || (articuloId ? "" : resolverCodigoGrillaAvisoMedico(d));

  return {
    ...d,
    id: solId,
    fecha_desde: rango.fecha_desde,
    fecha_hasta: rango.fecha_hasta,
    codigo_grilla: codigoGrilla,
    nivel_ocupacion_dia_id: NIVEL_OCUPACION_AVISO_MEDICO,
    articulo_id: articuloId,
    version_id_aplicada: String(d.version_id_aplicada || "").trim() || null,
    estado_solicitud_id: String(d.estado_solicitud_id || "").trim() || ESTADO_PENDIENTE_CLASIFICACION,
  };
}

module.exports = {
  CODIGO_GRILLA_AVISO_PROVISORIO,
  CODIGO_GRILLA_AVISO_COMPLETO,
  NIVEL_OCUPACION_AVISO_MEDICO,
  esSolicitudMedAviso,
  resolverCodigoGrillaAvisoMedico,
  resolverRangoYmdAvisoMedico,
  resolverRangoYmdEfectivoAvisoMedico,
  mapSolicitudMedAvisoParaMdc,
};
