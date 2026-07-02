import {
  ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA,
} from "../../constants/solicitudesArticuloV2.js";

const EST_JUNTA = "cfg_esa_esperando_dictamen_junta";

/**
 * Ruta de bandeja para el enlace «Ir a solicitud» del modal día (evita mandar avisos médicos a jefe/RRHH).
 * @param {Record<string, unknown> | null | undefined} resumen
 * @param {string} bandejaPatronDefault — jefe o RRHH según shell grilla
 * @returns {string} path vacío = no mostrar enlace
 */
export function rutaBandejaSolicitudDesdeResumenGrilla(resumen, bandejaPatronDefault) {
  if (!resumen?.es_aviso_medico) {
    return String(bandejaPatronDefault || "").trim();
  }
  const est = String(resumen.estado_solicitud_id || "").trim();
  if (est === EST_JUNTA) return "/portal/medico/junta";
  if (est === ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA) {
    return "/portal/medico/solicitudes";
  }
  return "";
}

/**
 * @param {Record<string, unknown> | null | undefined} resumen
 */
export function etiquetaEnlaceBandejaDesdeResumenGrilla(resumen) {
  if (resumen?.es_aviso_medico) return "Ir a bandeja médica";
  return "Ir a solicitud en bandeja";
}
