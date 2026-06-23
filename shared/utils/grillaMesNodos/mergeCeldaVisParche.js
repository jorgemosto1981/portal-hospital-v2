import {
  coherirCeldaVisTeoriaFranco,
  coherirPresentacionCompuestoAlTeoricoVis,
  alinearFlagsTipoDiaAlTeoricoOperativo,
} from "../visCeldaFusionLectura.js";

/**
 * Fusiona parche vis post-batch/teoría sin perder capa fichada si el servidor
 * no reenvió esos campos (materialización solo teoría/analítica).
 *
 * Regla: si `patch` **no trae** la clave, se conserva el valor previo.
 * Si trae `fichadas_reales: []` explícito, se respeta (sanación / borrado).
 *
 * @param {Record<string, unknown>|null|undefined} prev
 * @param {Record<string, unknown>|null|undefined} patch
 * @returns {Record<string, unknown>}
 */
export function mergeCeldaVisParche(prev, patch) {
  if (!patch || typeof patch !== "object") {
    return prev && typeof prev === "object" ? { ...prev } : {};
  }
  const base = prev && typeof prev === "object" ? prev : {};
  const merged = { ...base, ...patch };

  const preservarSiAusente = [
    "fichadas_reales",
    "fichadas_reales_version",
    "fichada_presencia",
    "capa_realidad",
  ];

  for (const campo of preservarSiAusente) {
    if (!Object.prototype.hasOwnProperty.call(patch, campo) && base[campo] !== undefined) {
      merged[campo] = base[campo];
    }
  }

  return coherirCeldaVisTeoriaFranco(
    alinearFlagsTipoDiaAlTeoricoOperativo(coherirPresentacionCompuestoAlTeoricoVis(merged)),
  );
}
