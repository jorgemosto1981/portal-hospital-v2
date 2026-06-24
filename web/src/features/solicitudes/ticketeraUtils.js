export function ymdHoyBa() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/** @param {Record<string, unknown> | null | undefined} a */
export function etiquetaArticulo(a) {
  const cod = String(a?.codigo_grilla || "").trim();
  const nom = String(a?.nombre || "").trim();
  if (cod && nom) return `${cod} — ${nom}`;
  return cod || nom || a?.articulo_id || "Artículo";
}

export const PATRON_SALDO_A = "A";
export const PATRON_SALDO_B = "B";
export const PATRON_SALDO_C = "C";

/** Primer mensaje de bloqueo del motor (preview / elegibilidad). */
export function mensajeBloqueoPreview(preview) {
  if (!preview || typeof preview !== "object") return "";
  const mensajes = Array.isArray(preview.mensajes)
    ? preview.mensajes.map((m) => String(m || "").trim()).filter(Boolean)
    : [];
  if (mensajes.length) return mensajes[0];
  const eligible = preview.eligible === true || preview.ok === true;
  if (eligible) return "";
  return "No podés solicitar esta licencia con los datos ingresados.";
}
