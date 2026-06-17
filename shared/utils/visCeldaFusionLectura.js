/**
 * Lectura de celdas vis_* fusionando claves planas legacy `dias.18.campo`.
 * @param {Record<string, unknown>} data
 */
export function fusionarDiasDesdeClavesPlanas(data) {
  const dias = data.dias && typeof data.dias === "object" ? { ...data.dias } : {};
  for (const [key, value] of Object.entries(data)) {
    const m = key.match(/^dias\.(\d+)\.(.+)$/);
    if (!m) continue;
    const dk = m[1];
    const field = m[2];
    if (!dias[dk] || typeof dias[dk] !== "object") dias[dk] = {};
    const nestedCelda = data.dias?.[dk];
    if (
      nestedCelda
      && typeof nestedCelda === "object"
      && Object.prototype.hasOwnProperty.call(nestedCelda, field)
      && (field === "analitica_cumplimiento" || field === "validacion_fichada_dia")
    ) {
      continue;
    }
    // Las actualizaciones por dot-path (`dias.14.campo` en la raíz del doc) son la fuente vigente.
    dias[dk][field] = value;
  }
  return dias;
}

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @param {string} diaKey
 */
export function leerCeldaVisDiaFusionada(data, diaKey) {
  const dk = String(diaKey || "").trim();
  if (!dk || !data || typeof data !== "object") return {};
  const dias = fusionarDiasDesdeClavesPlanas(data);
  const celda = dias[dk];
  return celda && typeof celda === "object" ? celda : {};
}
