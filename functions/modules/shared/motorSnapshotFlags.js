"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Lectura mínima del snapshot del motor LAO: qué tan grave es y si trae
 * advertencias.
 *
 * Vive en shared porque el backend necesita las mismas respuestas que la UI sin
 * mandar el snapshot entero: la bandeja RRHH publica solo estos flags en el
 * listado y trae el veredicto completo recién cuando alguien lo despliega.
 */

const NIVEL_RANK = { bloqueante: 3, advertencia: 2, ok: 1, info: 0 };

/**
 * Normaliza el nivel de un check a uno conocido; lo desconocido es `info`.
 * @param {unknown} nivel
 */
function resolveWorstNivel(nivel) {
  const n = String(nivel || "").toLowerCase();
  return NIVEL_RANK[n] != null ? n : "info";
}

/** @param {Record<string, unknown> | null | undefined} snapshot */
function esSnapshotMotorV2(snapshot) {
  return Boolean(
    snapshot &&
      typeof snapshot === "object" &&
      (snapshot.motor_version === "lao-preview-v2" || Array.isArray(snapshot.checks)),
  );
}

/** @param {Record<string, unknown> | null | undefined} snapshot */
function snapshotTieneAdvertencias(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const warns = Array.isArray(snapshot.warnings) ? snapshot.warnings.length : 0;
  const advChecks = (Array.isArray(snapshot.checks) ? snapshot.checks : []).filter(
    (c) => resolveWorstNivel(c?.nivel) === "advertencia",
  ).length;
  return warns + advChecks > 0;
}

/** @param {Record<string, unknown> | null | undefined} snapshot */
function snapshotTieneBloqueantes(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  return (Array.isArray(snapshot.checks) ? snapshot.checks : []).some(
    (c) => resolveWorstNivel(c?.nivel) === "bloqueante",
  );
}

module.exports = { resolveWorstNivel, esSnapshotMotorV2, snapshotTieneAdvertencias, snapshotTieneBloqueantes };
