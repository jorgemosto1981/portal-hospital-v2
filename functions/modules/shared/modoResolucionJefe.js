"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Modo del paso jerárquico inmediato (jefe) por configuración de artículo.
 * @see docs/v2/RFC_MODO_RESOLUCION_JEFE_CFG_ARTICULOS_V2.md
 */

const MODO_RESOLUCION_JEFE_AUTORIZACION = "autorizacion";
const MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO = "toma_conocimiento";
const MODO_RESOLUCION_JEFE_NINGUNO = "ninguno";

/** @type {readonly string[]} */
const MODOS_RESOLUCION_JEFE = Object.freeze([
  MODO_RESOLUCION_JEFE_AUTORIZACION,
  MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO,
  MODO_RESOLUCION_JEFE_NINGUNO,
]);

/**
 * @param {unknown} raw
 * @returns {typeof MODO_RESOLUCION_JEFE_AUTORIZACION | typeof MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO | typeof MODO_RESOLUCION_JEFE_NINGUNO}
 */
function normalizeModoResolucionJefe(raw) {
  const v = String(raw || "").trim();
  if (v === MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO) return MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO;
  if (v === MODO_RESOLUCION_JEFE_NINGUNO) return MODO_RESOLUCION_JEFE_NINGUNO;
  return MODO_RESOLUCION_JEFE_AUTORIZACION;
}

/**
 * Lee el modo desde una versión de cfg_articulos (fallback = autorización).
 * @param {Record<string, unknown> | null | undefined} versionData
 */
function modoResolucionJefeDesdeVersion(versionData) {
  const wf =
    versionData && typeof versionData === "object"
      ? /** @type {Record<string, unknown>} */ (versionData).bloque_workflow_sla_cobertura
      : null;
  const raw =
    wf && typeof wf === "object"
      ? /** @type {Record<string, unknown>} */ (wf).modo_resolucion_jefe
      : null;
  return normalizeModoResolucionJefe(raw);
}

/**
 * Snapshot en sol_* o heurística de transición (sols antiguas sin campo).
 * Art. 63-* → toma_conocimiento si falta el snapshot.
 * @param {Record<string, unknown> | null | undefined} sol
 * @param {string | null | undefined} codigoGrilla
 */
function modoResolucionJefeDesdeSolicitud(sol, codigoGrilla) {
  const raw = sol && typeof sol === "object" ? sol.modo_resolucion_jefe : null;
  if (raw != null && String(raw).trim() !== "") {
    return normalizeModoResolucionJefe(raw);
  }
  const cod = String(codigoGrilla || (sol && sol.codigo_grilla) || "")
    .trim()
    .toUpperCase();
  if (cod.startsWith("63")) return MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO;
  return MODO_RESOLUCION_JEFE_AUTORIZACION;
}

module.exports = { MODO_RESOLUCION_JEFE_AUTORIZACION, MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO, MODO_RESOLUCION_JEFE_NINGUNO, MODOS_RESOLUCION_JEFE, normalizeModoResolucionJefe, modoResolucionJefeDesdeVersion, modoResolucionJefeDesdeSolicitud };
