/**
 * @param {{
 *   calle?: string,
 *   numero?: string,
 *   piso?: string,
 *   departamento?: string,
 *   codigo_postal?: string,
 *   referencia?: string,
 * }} dom
 */
export function formatDomicilioPersona(dom) {
  if (!dom || typeof dom !== "object") return "";
  const calle = String(dom.calle || "").trim();
  const numero = String(dom.numero || "").trim();
  const piso = String(dom.piso || "").trim();
  const depto = String(dom.departamento || "").trim();
  const cp = String(dom.codigo_postal || "").trim();
  const ref = String(dom.referencia || "").trim();

  const linea1 = [calle, numero].filter(Boolean).join(" ");
  const linea2 = [piso && `Piso ${piso}`, depto && `Depto ${depto}`].filter(Boolean).join(" ");
  const parts = [linea1, linea2, cp && `CP ${cp}`, ref].filter(Boolean);
  return parts.join(", ").trim();
}

/**
 * @param {Record<string, unknown>} personaRow — fila `personas`
 */
export function contactoPerfilDesdePersona(personaRow) {
  const r = personaRow && typeof personaRow === "object" ? personaRow : {};
  const contacto = r.contacto && typeof r.contacto === "object" ? r.contacto : {};
  const domicilio = r.domicilio && typeof r.domicilio === "object" ? r.domicilio : {};
  return {
    telefono_celular: String(contacto.telefono_celular || "").trim(),
    telefono_fijo: String(contacto.telefono_fijo || "").trim(),
    email: String(contacto.email_personal || "").trim(),
    domicilio_declarado: formatDomicilioPersona(domicilio),
  };
}
