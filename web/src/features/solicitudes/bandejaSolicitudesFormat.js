import { formatDateDdMmAaaa } from "../../pages/datos-laborales/utils.js";

export function formatRangoFechasBandeja(desde, hasta) {
  const d0 = formatDateDdMmAaaa(desde, "");
  const d1 = formatDateDdMmAaaa(hasta, "");
  if (!d0) return "—";
  if (!d1 || d1 === d0) return d0;
  return `${d0} – ${d1}`;
}

export function diasLabelBandeja(n) {
  const d = Number(n) || 1;
  return d === 1 ? "1 día" : `${d} días`;
}

/** @param {Record<string, unknown> | null | undefined} s */
export function tituloSolicitudBandeja(s) {
  const art = String(s?.articulo_label || "").trim();
  const patron = String(s?.patron_saldo || "").trim();
  const base = art || (patron ? `Patrón ${patron}` : "Solicitud");
  return `${base} · ${diasLabelBandeja(s?.dias_solicitados)}`;
}

/** @param {Record<string, unknown> | null | undefined} s */
/** Timestamp Firestore / ISO → texto legible (BA). */
export function formatInstanteBandeja(raw) {
  if (raw == null || raw === "") return "";
  let ms = NaN;
  if (typeof raw === "string") ms = Date.parse(raw);
  else if (typeof raw === "number") ms = raw < 1e12 ? raw * 1000 : raw;
  else if (typeof raw === "object") {
    const sec = Number(raw.seconds ?? raw._seconds);
    if (Number.isFinite(sec)) ms = sec * 1000;
  }
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** @param {Record<string, unknown> | null | undefined} s */
export function metaComplementariaBandeja(s) {
  const nombre = String(s?.titular_label || "—").trim();
  const fechas = formatRangoFechasBandeja(s?.fecha_desde, s?.fecha_hasta);
  const id = String(s?.solicitud_id || "").trim();
  const parts = [nombre, fechas, id].filter(Boolean);
  return parts.join(" · ");
}
