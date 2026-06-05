/**
 * Humaniza mensajes de validarEntorno (p. ej. reemplaza gdt_* por etiqueta_ui).
 * @param {string} mensaje
 * @param {Array<{ grupo_de_trabajo_id?: string; id?: string; etiqueta_ui?: string; label?: string; nombre?: string }>} [gruposVigentes]
 */
export function formatearMensajeEntorno(mensaje, gruposVigentes = []) {
  let out = String(mensaje || "").trim();
  if (!out) return out;
  for (const g of gruposVigentes) {
    const id = String(g.grupo_de_trabajo_id || g.id || "").trim();
    const label = String(g.etiqueta_ui || g.label || g.nombre || "").trim();
    if (id && label && out.includes(id)) {
      out = out.split(id).join(label);
    }
  }
  return out;
}

/**
 * @param {string[]} mensajes
 * @param {Array<Record<string, unknown>>} [gruposVigentes]
 */
export function formatearMensajesEntorno(mensajes, gruposVigentes = []) {
  const list = Array.isArray(mensajes) ? mensajes : [];
  return list.map((m) => formatearMensajeEntorno(String(m || ""), gruposVigentes)).filter(Boolean);
}
