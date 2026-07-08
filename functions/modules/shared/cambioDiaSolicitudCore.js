"use strict";

/**
 * Helpers CAMBIO-DIA — detección versión / payload solicitud.
 * @see docs/v2/CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md
 */

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 */
function versionEsCambioDia(versionData) {
  const ext = versionData?.cambio_dia_solicitud;
  return Boolean(ext && typeof ext === "object" && String(ext.schema || "") === "CAMBIO_DIA_V1");
}

/**
 * @param {Record<string, unknown> | null | undefined} sol
 */
function solicitudEsCambioDia(sol) {
  return sol?.es_cambio_dia === true || String(sol?.cambio_dia_schema || "") === "CAMBIO_DIA_V1";
}

/**
 * YMD mínimo para fecha_origen / fecha_destino: hoy + N días (calendario, zona BA).
 * @param {number} plazoPreavisoDias
 * @param {string} [hoyYmd]
 */
function ymdMinimoPreaviso(plazoPreavisoDias, hoyYmd) {
  const n = Math.max(0, Math.floor(Number(plazoPreavisoDias) || 0));
  const hoy =
    hoyYmd && /^\d{4}-\d{2}-\d{2}$/.test(hoyYmd)
      ? hoyYmd
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const [y, m, d] = hoy.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {{
 *   fechaOrigen: string,
 *   fechaDestino: string,
 *   motivo: string,
 *   permiteRetroactividad: boolean,
 *   plazoPreavisoInternoDias: number | null,
 *   motivoMaxLen?: number,
 *   hoyYmd?: string,
 * }} p
 */
function validarFechasMotivoCambioDia(p) {
  const fo = String(p.fechaOrigen || "").trim().slice(0, 10);
  const fd = String(p.fechaDestino || "").trim().slice(0, 10);
  const motivo = String(p.motivo || "").trim();
  const maxLen = Math.max(50, Math.floor(Number(p.motivoMaxLen) || 500));
  const errores = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fo) || !/^\d{4}-\d{2}-\d{2}$/.test(fd)) {
    errores.push("fecha_origen y fecha_destino deben ser YYYY-MM-DD.");
  }
  if (fo && fd && fo === fd) {
    errores.push("El día destino debe ser distinto del día origen.");
  }
  if (motivo.length < 3) {
    errores.push("El motivo es obligatorio (mín. 3 caracteres).");
  }
  if (motivo.length > maxLen) {
    errores.push(`El motivo no puede superar ${maxLen} caracteres.`);
  }

  const hoy =
    p.hoyYmd && /^\d{4}-\d{2}-\d{2}$/.test(p.hoyYmd)
      ? p.hoyYmd
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

  if (p.permiteRetroactividad !== true) {
    if (fo && fo < hoy) errores.push("No se permite fecha origen retroactiva.");
    if (fd && fd < hoy) errores.push("No se permite fecha destino retroactiva.");
  }

  const preaviso =
    p.plazoPreavisoInternoDias == null ? 0 : Math.max(0, Math.floor(Number(p.plazoPreavisoInternoDias)));
  if (preaviso > 0) {
    const min = ymdMinimoPreaviso(preaviso, hoy);
    if (fo && fo < min) {
      errores.push(`La fecha origen debe ser al menos ${preaviso} día(s) después de hoy (${min}).`);
    }
    if (fd && fd < min) {
      errores.push(`La fecha destino debe ser al menos ${preaviso} día(s) después de hoy (${min}).`);
    }
  }

  return { ok: errores.length === 0, errores, fecha_origen: fo, fecha_destino: fd, motivo };
}

module.exports = {
  versionEsCambioDia,
  solicitudEsCambioDia,
  ymdMinimoPreaviso,
  validarFechasMotivoCambioDia,
};
