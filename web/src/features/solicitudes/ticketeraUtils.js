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
