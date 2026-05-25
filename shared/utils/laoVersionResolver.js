/**
 * Resolución de versión LAO publicada por correspondencia_anio (ejercicio).
 * @see docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md §4.1
 */

export const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

export const CHECKIN_COPY_ANIO_A =
  "A partir del año A inclusive en adelante, el cupo de LAO se acredita por antigüedad y matriz en el portal (no se carga por check-in).";

/**
 * @param {object} versionData
 * @returns {number | null}
 */
export function getCorrespondenciaAnioFromVersion(versionData) {
  const n = versionData?.bloque_topes_plazos_computo?.correspondencia_anio;
  const num = Number(n);
  if (!Number.isInteger(num) || num < 1900 || num > 2100) return null;
  return num;
}

/**
 * @param {object} versionData
 * @param {number} anioOrigen
 */
export function versionMatchesAnioOrigen(versionData, anioOrigen) {
  const corr = getCorrespondenciaAnioFromVersion(versionData);
  return corr != null && corr === Number(anioOrigen);
}

/**
 * @param {Array<{ id?: string, data?: () => object } | { id?: string, versionData?: object }>} versionEntries
 * @param {number} correspondenciaAnio
 * @returns {{ versionId: string, versionData: object, correspondencia_anio: number } | null}
 */
export function pickPublishedVersionByCorrespondenciaAnio(versionEntries, correspondenciaAnio) {
  const target = Number(correspondenciaAnio);
  if (!Number.isInteger(target) || target < 1900) return null;

  for (const entry of versionEntries) {
    const data =
      typeof entry?.data === "function"
        ? entry.data()
        : entry?.versionData && typeof entry.versionData === "object"
          ? entry.versionData
          : entry && typeof entry === "object" && !entry.data
            ? entry
            : null;
    if (!data) continue;

    if (String(data.estado_version_id || "").trim() !== CFG_EST_VER_PUBLICADA) continue;
    if (data?.bloque_identidad_naturaleza?.es_lao_anual !== true) continue;

    const corr = getCorrespondenciaAnioFromVersion(data);
    if (corr !== target) continue;

    const versionId = typeof entry.id === "string" ? entry.id : null;
    if (!versionId) continue;

    return { versionId, versionData: data, correspondencia_anio: corr };
  }
  return null;
}

/**
 * @param {number} anioOrigen
 * @param {number} anioA — año calendario A (go-live) informado en check-in
 */
export function assertCheckinAnioAllowed(anioOrigen, anioA) {
  const y = Number(anioOrigen);
  const a = Number(anioA);
  if (!Number.isInteger(y) || !Number.isInteger(a)) {
    throw new Error("anio_origen y anio_corte_a deben ser enteros.");
  }
  if (y >= a) {
    throw new Error(
      `Check-in: el año ${y} debe ser menor que A (${a}). ${CHECKIN_COPY_ANIO_A}`,
    );
  }
}

/**
 * @param {object} versionData
 * @param {number} anioOrigenBolsa
 */
export function assertVersionInvariantForBolsa(versionData, anioOrigenBolsa) {
  if (!versionMatchesAnioOrigen(versionData, anioOrigenBolsa)) {
    const corr = getCorrespondenciaAnioFromVersion(versionData);
    throw new Error(
      `La versión aplicada (correspondencia_anio=${corr ?? "n/d"}) no coincide con anio_origen_bolsa=${anioOrigenBolsa}.`,
    );
  }
}
