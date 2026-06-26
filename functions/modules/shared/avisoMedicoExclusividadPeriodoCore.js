"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Exclusividad de días — aviso médico vs otras solicitudes / aportes.
 * @see RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md
 */

const SCHEMA_SOL_MED_AVISO = "SOL_MED_AVISO_V1";

/** Estados que ocupan días en el calendario del titular (bloquean otro aviso/licencia). */
const ESTADOS_SOLICITUD_OCUPAN_DIA_AVISO_MED = new Set([
  "cfg_esa_borrador",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
  "cfg_esa_aprobada",
  "cfg_esa_pendiente_clasificacion_medica",
  "cfg_esa_esperando_dictamen_junta",
]);

/**
 * @param {string} d1
 * @param {string} h1
 * @param {string} d2
 * @param {string} h2
 */
function rangosYmdSeSolapan(d1, h1, d2, h2) {
  const a = String(d1 || "").slice(0, 10);
  const b = String(h1 || d1 || "").slice(0, 10);
  const c = String(d2 || "").slice(0, 10);
  const d = String(h2 || d2 || "").slice(0, 10);
  if (!a || !c) return false;
  return a <= d && c <= b;
}

/**
 * @param {Record<string, unknown> | null | undefined} s
 * @returns {{ desde: string, hasta: string } | null}
 */
function resolverRangoYmdSolicitudArticulo(s) {
  if (!s || typeof s !== "object") return null;
  const schema = String(s.schema_version || "").trim();
  if (schema === SCHEMA_SOL_MED_AVISO) {
    const desde = String(s.fecha_inicio_reposo_estimada || "").slice(0, 10);
    const hasta = String(s.fecha_fin_reposo_estimada || s.fecha_inicio_reposo_estimada || "").slice(
      0,
      10,
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return { desde, hasta: desde };
    return desde <= hasta ? { desde, hasta } : null;
  }
  const desde = String(s.fecha_desde || "").slice(0, 10);
  const hasta = String(s.fecha_hasta || s.fecha_desde || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return null;
  return { desde, hasta };
}

/**
 * @param {string} estadoId
 */
function estadoSolicitudOcupaDiasParaAvisoMed(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_rechazada") return false;
  return ESTADOS_SOLICITUD_OCUPAN_DIA_AVISO_MED.has(e);
}

/**
 * @param {string} desde
 * @param {string} hasta
 * @param {Array<{ id: string, data: Record<string, unknown> }>} solicitudes
 * @param {string} [excludeSolId]
 */
function buscarConflictoSolapamientoSolicitudes(desde, hasta, solicitudes, excludeSolId = "") {
  const d = String(desde || "").slice(0, 10);
  const h = String(hasta || desde || "").slice(0, 10);
  if (!d) return null;
  const ex = String(excludeSolId || "").trim();
  for (const row of solicitudes || []) {
    if (!row?.id) continue;
    if (ex && row.id === ex) continue;
    const s = row.data || {};
    const estado = String(s.estado_solicitud_id || "").trim();
    if (!estadoSolicitudOcupaDiasParaAvisoMed(estado)) continue;
    const rango = resolverRangoYmdSolicitudArticulo(s);
    if (!rango) continue;
    if (rangosYmdSeSolapan(d, h, rango.desde, rango.hasta)) {
      return {
        conflicto_solicitud_id: row.id,
        conflicto_estado_solicitud_id: estado,
        conflicto_desde: rango.desde,
        conflicto_hasta: rango.hasta,
      };
    }
  }
  return null;
}

module.exports = { SCHEMA_SOL_MED_AVISO, ESTADOS_SOLICITUD_OCUPAN_DIA_AVISO_MED, rangosYmdSeSolapan, resolverRangoYmdSolicitudArticulo, estadoSolicitudOcupaDiasParaAvisoMed, buscarConflictoSolapamientoSolicitudes };
