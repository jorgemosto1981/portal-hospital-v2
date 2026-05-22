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

/** Código artículo para renglón principal (ej. 64-B). */
function codigoArticuloBandeja(s) {
  const cod = String(s?.codigo_grilla || "").trim();
  if (cod) return cod;
  const label = String(s?.articulo_label || "").trim();
  if (label.includes("—")) return label.split("—")[0].trim();
  if (label) return label;
  const patron = String(s?.patron_saldo || "").trim();
  return patron ? `Patrón ${patron}` : "Artículo";
}

function nombreArticuloBandeja(s) {
  const nom = String(s?.articulo_nombre || "").trim();
  if (nom) return nom;
  const label = String(s?.articulo_label || "").trim();
  if (label.includes("—")) return label.split("—").slice(1).join("—").trim();
  return label;
}

/** Renglón 1: código artículo · nombre artículo · fecha · días */
export function renglonPrincipalBandeja(s) {
  const articulo = codigoArticuloBandeja(s);
  const nombreArt = nombreArticuloBandeja(s);
  const fecha = formatRangoFechasBandeja(s?.fecha_desde, s?.fecha_hasta);
  const dias = diasLabelBandeja(s?.dias_solicitados);
  return [articulo, nombreArt, fecha, dias].filter(Boolean).join(" · ");
}

/** Renglón 3 (sin id): titular · DNI */
export function renglonTitularDniBandeja(s) {
  const nombre = String(s?.titular_label || "").trim();
  const dni = String(s?.titular_dni || "").replace(/\D/g, "").trim();
  const parts = [];
  if (nombre) parts.push(nombre);
  if (dni) parts.push(`DNI ${dni}`);
  return parts.join(" · ");
}

/** @deprecated Usar renglonPrincipalBandeja en listas */
export function tituloSolicitudBandeja(s) {
  return renglonPrincipalBandeja(s);
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
