/**
 * Utilidades bolsas LAO en saldos_articulo_agente.
 * @see docs/v2/PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md
 */

export const CFG_OS_EXTERNO_INFORMADO = "cfg_os_externo_informado";
export const CFG_OS_INTERNO = "cfg_os_interno";

const ULID_RE = "[0-9A-HJKMNP-TV-Z]{26}";

/**
 * @param {string} personaId
 * @param {number} anioCalendario — año del documento sal_YYYY_per_…
 */
export function saldoAnualDocId(personaId, anioCalendario) {
  const m = new RegExp(`^per_(${ULID_RE})$`, "i").exec(String(personaId || "").trim());
  if (!m) return null;
  const y = Number(anioCalendario);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return null;
  return `sal_${y}_per_${m[1]}`;
}

/**
 * @param {string} articuloId
 * @param {number} anioOrigen
 */
export function buildBolsaKey(articuloId, anioOrigen) {
  return `bol_${String(articuloId || "").trim()}_${Number(anioOrigen)}`;
}

/**
 * @param {string} personaId
 */
export function saldoGlobalDocId(personaId) {
  const m = new RegExp(`^per_(${ULID_RE})$`, "i").exec(String(personaId || "").trim());
  if (!m) return null;
  return `sal_global_per_${m[1]}`;
}

/**
 * @param {string} articuloId
 */
export function buildBolsaKeyGlobal(articuloId) {
  return `bol_${String(articuloId || "").trim()}_global`;
}

/**
 * Patrón B — ciclo en sal_YYYY (check-in: cupo versión − ya consumidos).
 */
export function buildBolsaCheckinPatronB(params) {
  const {
    articuloId,
    versionId,
    codigoGrilla = "",
    anioCiclo,
    cupoDias,
    diasConsumidosPrevios,
    origenSaldoId = CFG_OS_INTERNO,
  } = params;

  const cupo = Number(cupoDias);
  const usados = Number(diasConsumidosPrevios);
  if (!Number.isFinite(cupo) || cupo < 0) throw new Error("Cupo del ciclo inválido.");
  if (!Number.isFinite(usados) || usados < 0) throw new Error("Días consumidos previos inválidos.");
  if (usados > cupo) throw new Error("Los días usados no pueden superar el cupo del ciclo.");

  const anio = Number(anioCiclo);
  const disponible = cupo - usados;
  const bolsaId = buildBolsaKey(articuloId, anio);

  return {
    bolsaId,
    bolsa: {
      bolsa_id: bolsaId,
      articulo_id: String(articuloId).trim(),
      codigo_grilla: String(codigoGrilla).trim() || "ART",
      anio_origen: anio,
      cantidad_inicial: cupo,
      consumido: usados,
      disponible,
      fecha_vencimiento: null,
      es_arrastre: false,
      origen_saldo_id: origenSaldoId,
      version_id_origen: String(versionId).trim(),
      ultima_actualizacion: null,
    },
  };
}

/**
 * Patrón C — bolsa global; saldo inicial firmado (default 0).
 */
export function buildBolsaCheckinPatronC(params) {
  const { articuloId, versionId, codigoGrilla = "", saldoDisponible = 0, origenSaldoId = CFG_OS_EXTERNO_INFORMADO } =
    params;

  const disp = Number(saldoDisponible);
  if (!Number.isFinite(disp)) throw new Error("Saldo inicial inválido.");

  const bolsaId = buildBolsaKeyGlobal(articuloId);
  const cantidadInicial = Math.max(0, disp);
  const consumido = disp < 0 ? -disp : 0;

  return {
    bolsaId,
    bolsa: {
      bolsa_id: bolsaId,
      articulo_id: String(articuloId).trim(),
      codigo_grilla: String(codigoGrilla).trim() || "ART",
      anio_origen: 0,
      cantidad_inicial: cantidadInicial,
      consumido,
      disponible: disp,
      fecha_vencimiento: null,
      es_arrastre: true,
      origen_saldo_id: origenSaldoId,
      version_id_origen: String(versionId).trim(),
      ultima_actualizacion: null,
    },
  };
}

/**
 * Código corto denormalizado en la bolsa (grilla / UI), alineado al ejercicio de la versión.
 * @param {object | null | undefined} versionData
 * @param {number} anioOrigen
 * @param {string} [articuloCodigoFallback] — p. ej. código del núcleo `cfg_articulos`
 */
export function resolveCodigoGrillaForBolsa(versionData, anioOrigen, articuloCodigoFallback = "LAO") {
  const fromVersion =
    versionData?.bloque_identidad_naturaleza?.visualizacion?.codigo_grilla ??
    versionData?.visualizacion?.codigo_grilla;
  if (typeof fromVersion === "string" && fromVersion.trim()) {
    return fromVersion.trim();
  }
  const y = Number(anioOrigen);
  const raw = String(articuloCodigoFallback || "LAO").trim() || "LAO";
  const base = raw.replace(/-\d{4}$/, "") || raw;
  if (Number.isInteger(y) && y >= 1900 && y <= 2100) {
    return `${base}-${y}`;
  }
  return raw;
}

/**
 * @param {{
 *   articuloId: string,
 *   versionId: string,
 *   codigoGrilla?: string,
 *   anioOrigen: number,
 *   cantidadInicial: number,
 *   esArrastre?: boolean,
 *   origenSaldoId?: string,
 * }} params
 */
export function buildBolsaPayload(params) {
  const {
    articuloId,
    versionId,
    codigoGrilla = "LAO",
    anioOrigen,
    cantidadInicial,
    esArrastre = true,
    origenSaldoId = CFG_OS_EXTERNO_INFORMADO,
  } = params;

  const dias = Number(cantidadInicial);
  if (!Number.isFinite(dias) || dias < 0) {
    throw new Error("cantidad_inicial inválida.");
  }

  const anio = Number(anioOrigen);
  const bolsaId = buildBolsaKey(articuloId, anio);

  return {
    bolsaId,
    bolsa: {
      bolsa_id: bolsaId,
      articulo_id: String(articuloId).trim(),
      codigo_grilla: String(codigoGrilla).trim() || "LAO",
      anio_origen: anio,
      cantidad_inicial: dias,
      consumido: 0,
      disponible: dias,
      fecha_vencimiento: null,
      es_arrastre: esArrastre === true,
      origen_saldo_id: origenSaldoId,
      version_id_origen: String(versionId).trim(),
      ultima_actualizacion: null,
    },
  };
}

/**
 * Fusiona mapas `bolsas` de varios documentos sal_YYYY_per_*.
 * @param {Array<{ bolsas?: Record<string, object> }>} saldoDocs
 */
export function mergeBolsasFromSaldoDocs(saldoDocs) {
  /** @type {Record<string, object>} */
  const bolsas = {};
  for (const doc of saldoDocs) {
    if (!doc || typeof doc.bolsas !== "object") continue;
    Object.assign(bolsas, doc.bolsas);
  }
  return { bolsas };
}

/**
 * @param {object} saldosData
 * @param {string} articuloId
 * @returns {number | null} menor anio_origen con disponible > 0
 */
export function findOldestAnioOrigenWithDisponible(saldosData, articuloId) {
  const bolsas = saldosData && typeof saldosData.bolsas === "object" ? saldosData.bolsas : {};
  const art = String(articuloId || "").trim();
  let minYear = null;

  for (const b of Object.values(bolsas)) {
    if (!b || typeof b !== "object") continue;
    if (String(b.articulo_id || "").trim() !== art) continue;
    const disp = Number(b.disponible);
    if (!Number.isFinite(disp) || disp <= 0) continue;
    const y = Number(b.anio_origen);
    if (!Number.isInteger(y)) continue;
    if (minYear == null || y < minYear) minYear = y;
  }
  return minYear;
}

/**
 * @param {object} saldosData
 * @param {string} articuloId
 * @param {number} anioElegido
 */
export function assertFifoAnioOrigen(saldosData, articuloId, anioElegido) {
  const oldest = findOldestAnioOrigenWithDisponible(saldosData, articuloId);
  if (oldest == null) return;
  const elegido = Number(anioElegido);
  if (Number.isInteger(oldest) && elegido > oldest) {
    throw new Error(`FIFO: primero consumí la bolsa del año ${oldest} (saldo pendiente).`);
  }
}

/**
 * @param {object} saldosData
 * @param {string} articuloId
 * @param {number} anioOrigenBolsa
 */
export function pickBolsaParaConsumo(saldosData, articuloId, anioOrigenBolsa) {
  const bolsas = saldosData && typeof saldosData.bolsas === "object" ? saldosData.bolsas : {};
  const art = String(articuloId || "").trim();
  const anio = Number(anioOrigenBolsa);
  for (const [bolsaId, b] of Object.entries(bolsas)) {
    if (!b || typeof b !== "object") continue;
    if (String(b.articulo_id || "").trim() !== art) continue;
    if (Number(b.anio_origen) !== anio) continue;
    return { bolsaId, bolsa: b };
  }
  return null;
}
