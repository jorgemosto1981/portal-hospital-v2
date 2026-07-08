/**
 * Helpers CAMBIO-DIA (web) — espejo liviano de functions/modules/shared/cambioDiaSolicitudCore.js
 */

/**
 * @param {Record<string, unknown> | null | undefined} art
 */
export function articuloEsCambioDia(art) {
  if (!art || typeof art !== "object") return false;
  if (art.es_cambio_dia === true) return true;
  const ext = art.cambio_dia_solicitud;
  return Boolean(ext && typeof ext === "object" && String(ext.schema || "") === "CAMBIO_DIA_V1");
}

/**
 * @param {number} plazoPreavisoDias
 * @param {string} [hoyYmd]
 */
export function ymdMinimoPreaviso(plazoPreavisoDias, hoyYmd) {
  const n = Math.max(0, Math.floor(Number(plazoPreavisoDias) || 0));
  const hoy =
    hoyYmd && /^\d{4}-\d{2}-\d{2}$/.test(hoyYmd)
      ? hoyYmd
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const [y, m, d] = hoy.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
