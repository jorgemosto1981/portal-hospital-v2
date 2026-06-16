/** Semáforo fichada jefe — lectura de `validacion_fichada_dia` persistida (RFC Fase F). */

import { obtenerYmdHoyInstitucional } from "../../../../shared/utils/fechaInstitucionalBa.js";

/** @param {string|null|undefined} estado */
export function etiquetaEstadoSemaforoFichada(estado) {
  const e = String(estado || "").trim();
  if (e === "VERDE") return "Conforme";
  if (e === "AMARILLO") return "Atención";
  if (e === "ROJO") return "Incumplimiento";
  return null;
}

/** @param {string|null|undefined} estado */
export function simboloEstadoSemaforoFichada(estado) {
  const e = String(estado || "").trim();
  if (e === "VERDE") return "✓";
  if (e === "AMARILLO") return "!";
  if (e === "ROJO") return "✕";
  return null;
}

/** @param {string} estado */
export function clasesBadgeSemaforoFichada(estado) {
  const e = String(estado || "");
  if (e === "VERDE") return "bg-emerald-100 text-emerald-900 ring-emerald-300";
  if (e === "AMARILLO") return "bg-amber-100 text-amber-950 ring-amber-300";
  if (e === "ROJO") return "bg-rose-100 text-rose-900 ring-rose-300";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

/** Clase chip celda futura (sin evaluación fichadas). */
export const CLASE_CELDA_FUTURO_GRIS = "opacity-80 saturate-50";

/** @param {string|null|undefined} fechaYmd */
export function celdaEsDiaFuturoInstitucional(fechaYmd) {
  const ymd = String(fechaYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd > obtenerYmdHoyInstitucional();
}

/**
 * @param {Record<string, unknown>|null|undefined} cell
 * @param {{ fechaYmd?: string }} [opts]
 * @returns {{ estado: string; tooltip: string }|null}
 */
export function semaforoFichadaDesdeCelda(cell, opts = {}) {
  const fechaYmd = String(opts.fechaYmd || "").slice(0, 10);
  if (celdaEsDiaFuturoInstitucional(fechaYmd)) return null;

  if (!cell || typeof cell !== "object") return null;

  const v = cell.validacion_fichada_dia;
  if (v && typeof v === "object" && v.estado_semaforo) {
    const estado = String(v.estado_semaforo);
    const tooltip = String(v.texto_resumen || etiquetaEstadoSemaforoFichada(estado) || "");
    return { estado, tooltip };
  }

  const legacy = cell.estado_fichada_jefe ? String(cell.estado_fichada_jefe) : "";
  if (!legacy) return null;
  const map = { OK: "VERDE", ALERTA: "ROJO", RRHH_PENDIENTE: "AMARILLO", RRHH_RESUELTO: "VERDE" };
  const estado = map[legacy] || legacy;
  return {
    estado,
    tooltip: String(cell.estado_fichada_jefe_tooltip || etiquetaEstadoSemaforoFichada(estado) || ""),
  };
}

/** @deprecated Usar semaforoFichadaDesdeCelda */
export function estadoFichadaJefeDesdeCelda(cell) {
  return semaforoFichadaDesdeCelda(cell);
}

/** @deprecated legacy */
export function etiquetaEstadoFichadaJefe(estado) {
  const mapped = { OK: "VERDE", ALERTA: "ROJO", RRHH_PENDIENTE: "AMARILLO", RRHH_RESUELTO: "VERDE" };
  return etiquetaEstadoSemaforoFichada(mapped[String(estado)] || estado);
}

/** @deprecated legacy */
export function simboloEstadoFichadaJefe(estado) {
  const mapped = { OK: "VERDE", ALERTA: "ROJO", RRHH_PENDIENTE: "AMARILLO", RRHH_RESUELTO: "VERDE" };
  return simboloEstadoSemaforoFichada(mapped[String(estado)] || estado);
}

/** @deprecated legacy */
export function clasesBadgeEstadoFichadaJefe(estado) {
  const mapped = { OK: "VERDE", ALERTA: "ROJO", RRHH_PENDIENTE: "AMARILLO", RRHH_RESUELTO: "VERDE" };
  return clasesBadgeSemaforoFichada(mapped[String(estado)] || estado);
}
