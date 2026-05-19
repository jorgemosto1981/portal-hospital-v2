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
export function metaComplementariaBandeja(s) {
  const nombre = String(s?.titular_label || "—").trim();
  const fechas = formatRangoFechasBandeja(s?.fecha_desde, s?.fecha_hasta);
  const id = String(s?.solicitud_id || "").trim();
  const parts = [nombre, fechas, id].filter(Boolean);
  return parts.join(" · ");
}
