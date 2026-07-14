/**
 * Helpers CAMBIO-DIA (web) — espejo liviano de functions/modules/shared/cambioDiaSolicitudCore.js
 */

/** Etiqueta de tarjeta / título visible en ticketera (Soft Launch). */
export const CAMBIO_DIA_TITULO_UI = "Cambio de Día de Asistencia";

/** Máximo de días corridos entre ausencia inicial y prestación destino. */
export const CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS = 10;

/**
 * Texto de toma de conocimiento que el agente debe aceptar al enviar.
 */
export const CAMBIO_DIA_TOMA_CONOCIMIENTO_TEXTO =
  "Tomo conocimiento de que el Cambio de Día de Asistencia es excepcional y se evalúa " +
  "en el marco de necesidades sanitarias y de los servicios (no por motivos particulares). " +
  "Debo detallar las razones con claridad. Esta solicitud requiere autorización de jefatura; " +
  "puedo seguir el estado (pendiente, aprobada o rechazada) en este mismo Portal Digital. " +
  "Si es rechazada, el día de asistencia permanece sin cambios.";

/**
 * @param {string} ymd
 * @param {number} deltaDias
 */
export function ymdAddDays(ymd, deltaDias) {
  const s = String(ymd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.floor(Number(deltaDias) || 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number | null}
 */
export function diasCorridosEntre(a, b) {
  const sa = String(a || "").trim().slice(0, 10);
  const sb = String(b || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sa) || !/^\d{4}-\d{2}-\d{2}$/.test(sb)) return null;
  const [ya, ma, da] = sa.split("-").map(Number);
  const [yb, mb, db] = sb.split("-").map(Number);
  return Math.abs(Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000));
}

/**
 * Rango permitido del destino: exactamente ±ventana días corridos desde la ausencia.
 * Sin piso de preaviso ni de “hoy”: solo fo ± N.
 * @param {string} fechaOrigenYmd
 * @param {string} [_ymdMinPreaviso] — compat; no se usa
 * @param {number} [ventana]
 * @param {unknown} [_opts] — compat; no se usa
 */
export function rangoFechaDestinoCambioDia(
  fechaOrigenYmd,
  _ymdMinPreaviso,
  ventana = CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS,
  _opts,
) {
  const fo = String(fechaOrigenYmd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fo)) {
    return { min: "", max: "", ok: false };
  }
  const win = Math.max(1, Math.floor(Number(ventana) || CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS));
  const min = ymdAddDays(fo, -win);
  const max = ymdAddDays(fo, win);
  return { min, max, ok: Boolean(min && max && min <= max) };
}

/**
 * @param {string} fechaOrigen
 * @param {string} fechaDestino
 * @param {string} ymdMin
 * @param {{ permiteRetroactividad?: boolean, preaviso?: number, ventana?: number, hoyYmd?: string }} [opts]
 */
export function mensajesValidacionFechasCambioDia(fechaOrigen, fechaDestino, ymdMin, opts = {}) {
  const fo = String(fechaOrigen || "").trim().slice(0, 10);
  const fd = String(fechaDestino || "").trim().slice(0, 10);
  const msgs = [];
  const ventana = opts.ventana ?? CAMBIO_DIA_VENTANA_MAX_DIAS_CORRIDOS;
  const hoy =
    opts.hoyYmd && /^\d{4}-\d{2}-\d{2}$/.test(opts.hoyYmd) ? opts.hoyYmd : undefined;

  if (fo && !/^\d{4}-\d{2}-\d{2}$/.test(fo)) {
    msgs.push("La Fecha de Ausencia Inicial no es válida.");
  }
  if (fd && !/^\d{4}-\d{2}-\d{2}$/.test(fd)) {
    msgs.push("La Fecha de Prestación Destino no es válida.");
  }
  if (fo && fd && fo === fd) {
    msgs.push("La Fecha de Prestación Destino debe ser distinta de la Fecha de Ausencia Inicial.");
  }
  if (opts.permiteRetroactividad !== true && hoy) {
    if (fo && fo < hoy) msgs.push("No se permite una Fecha de Ausencia Inicial retroactiva.");
    // Destino: solo ventana ±N respecto de la ausencia (puede quedar antes de hoy).
  }
  if (ymdMin && /^\d{4}-\d{2}-\d{2}$/.test(ymdMin)) {
    if (fo && fo < ymdMin) {
      msgs.push(
        `La Fecha de Ausencia Inicial debe respetar la anticipación mínima (día mínimo: ${ymdToDdMmYyyy(ymdMin) || ymdMin}).`,
      );
    }
    // Destino: solo ventana ±N y no retroactivo; el preaviso no aplana el calendario destino.
  }
  if (fo && fd && /^\d{4}-\d{2}-\d{2}$/.test(fo) && /^\d{4}-\d{2}-\d{2}$/.test(fd) && fo !== fd) {
    const gap = diasCorridosEntre(fo, fd);
    if (gap != null && gap > ventana) {
      msgs.push(
        `La Fecha de Prestación Destino no puede distar más de ${ventana} días corridos de la Fecha de Ausencia Inicial (hay ${gap} días entre ambas). Elegí una fecha dentro de la ventana permitida.`,
      );
    }
  }
  return msgs;
}

/**
 * @param {Record<string, unknown> | null | undefined} art
 */
export function articuloEsCambioDia(art) {
  if (!art || typeof art !== "object") return false;
  if (art.es_cambio_dia === true) return true;
  const ext = art.cambio_dia_solicitud;
  if (ext && typeof ext === "object" && String(ext.schema || "") === "CAMBIO_DIA_V1") return true;
  const codigo = String(art.codigo_grilla || art.codigo || "")
    .trim()
    .toUpperCase();
  if (codigo === "CAMBIO-DIA" || codigo === "C-DIA") return true;
  const nombre = String(art.nombre || "")
    .trim()
    .toLowerCase();
  return (
    nombre.includes("cambio de día") ||
    nombre.includes("cambio de dia") ||
    nombre.includes("traslado propio")
  );
}

/**
 * YYYY-MM-DD (storage) → DD-MM-YYYY (UI).
 * @param {string | null | undefined} ymd
 */
export function ymdToDdMmYyyy(ymd) {
  const s = String(ymd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
}

/**
 * @param {string | null | undefined} estadoId
 */
export function labelEstadoSolicitudAgente(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_borrador") return "Borrador";
  if (e === "cfg_esa_en_revision_jefe") return "Pendiente de autorización (jefe)";
  if (e === "cfg_esa_aprobada") return "Autorizada";
  if (e === "cfg_esa_aprobada_pendiente_aplicacion") {
    return "Autorizada · pendiente de aplicar en grilla";
  }
  if (e === "cfg_esa_rechazada") return "Rechazada";
  if (e === "cfg_esa_cancelada") return "Cancelada";
  if (e.includes("revision")) return "En revisión";
  return e || "—";
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
