"use strict";

/**
 * Helpers CAMBIO-DIA — detección versión / payload solicitud.
 * @see docs/v2/CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md
 */

/** Máximo de días corridos entre ausencia inicial y prestación destino. */
const CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS = 10;

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
 * @param {string} ymd
 * @param {number} deltaDias
 */
function ymdAddDays(ymd, deltaDias) {
  const s = String(ymd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.floor(Number(deltaDias) || 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Días corridos absolutos entre dos YMD (0 si iguales).
 * @param {string} a
 * @param {string} b
 */
function diasCorridosEntre(a, b) {
  const sa = String(a || "").trim().slice(0, 10);
  const sb = String(b || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sa) || !/^\d{4}-\d{2}-\d{2}$/.test(sb)) return null;
  const [ya, ma, da] = sa.split("-").map(Number);
  const [yb, mb, db] = sb.split("-").map(Number);
  const ta = Date.UTC(ya, ma - 1, da);
  const tb = Date.UTC(yb, mb - 1, db);
  return Math.abs(Math.round((tb - ta) / 86400000));
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
  return ymdAddDays(hoy, n);
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
 *   ventanaMaxDiasCorridos?: number,
 * }} p
 */
function validarFechasMotivoCambioDia(p) {
  const fo = String(p.fechaOrigen || "").trim().slice(0, 10);
  const fd = String(p.fechaDestino || "").trim().slice(0, 10);
  const motivo = String(p.motivo || "").trim();
  const maxLen = Math.max(50, Math.floor(Number(p.motivoMaxLen) || 500));
  const ventana =
    p.ventanaMaxDiasCorridos == null
      ? CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS
      : Math.max(1, Math.floor(Number(p.ventanaMaxDiasCorridos)));
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
    // Destino: únicamente ventana ±N respecto del origen (sin piso “hoy”).
  }

  const preaviso =
    p.plazoPreavisoInternoDias == null ? 0 : Math.max(0, Math.floor(Number(p.plazoPreavisoInternoDias)));
  if (preaviso > 0) {
    const min = ymdMinimoPreaviso(preaviso, hoy);
    if (fo && fo < min) {
      errores.push(`La fecha origen debe ser al menos ${preaviso} día(s) después de hoy (${min}).`);
    }
    // Destino: no aplica el mismo piso de anticipación; lo limita la ventana ±N y no-retroactividad.
  }

  if (fo && fd && /^\d{4}-\d{2}-\d{2}$/.test(fo) && /^\d{4}-\d{2}-\d{2}$/.test(fd) && fo !== fd) {
    const gap = diasCorridosEntre(fo, fd);
    if (gap != null && gap > ventana) {
      errores.push(
        `La Fecha de Prestación Destino no puede distar más de ${ventana} días corridos de la Fecha de Ausencia Inicial (hoy hay ${gap} días entre ambas).`,
      );
    }
  }

  return { ok: errores.length === 0, errores, fecha_origen: fo, fecha_destino: fd, motivo };
}

module.exports = {
  CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS,
  versionEsCambioDia,
  solicitudEsCambioDia,
  ymdAddDays,
  diasCorridosEntre,
  ymdMinimoPreaviso,
  validarFechasMotivoCambioDia,
};
