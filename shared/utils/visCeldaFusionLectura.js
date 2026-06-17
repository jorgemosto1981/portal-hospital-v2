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

/**
 * Sub-objeto materializado `presentacion_compuesto` (RFC filas celda).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {{ version?: number|null, turno_compuesto_id?: string|null, filas: Array<Record<string, unknown>> }|null}
 */
export function leerPresentacionCompuestoDesdeCelda(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return null;
  const raw = celdaVis.presentacion_compuesto;
  if (!raw || typeof raw !== "object") return null;
  const filas = Array.isArray(raw.filas)
    ? raw.filas.filter((f) => f && typeof f === "object")
    : [];
  if (!filas.length) return null;
  return {
    version: raw.version ?? null,
    turno_compuesto_id: raw.turno_compuesto_id ?? null,
    filas,
  };
}

/**
 * Filas listas para iterar en UI (array vacío si no hay matriz compuesta).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {Array<Record<string, unknown>>}
 */
export function filasPresentacionCompuestoDesdeCelda(celdaVis) {
  return leerPresentacionCompuestoDesdeCelda(celdaVis)?.filas ?? [];
}
