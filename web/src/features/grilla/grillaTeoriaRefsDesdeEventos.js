/**
 * @param {unknown} eventos
 * @returns {Array<Record<string, unknown>>}
 */
export function teoriaRefsLicenciaDesdeEventos(eventos) {
  if (!Array.isArray(eventos)) return [];
  const out = [];
  for (const ev of eventos) {
    const ref = ev && typeof ev === "object" ? ev.teoria_ref : null;
    if (ref && typeof ref === "object") out.push(ref);
  }
  return out;
}
