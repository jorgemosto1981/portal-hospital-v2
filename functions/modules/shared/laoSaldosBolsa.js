"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Utilidades bolsas LAO en saldos_articulo_agente.
 * @see docs/v2/PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md
 */

const CFG_OS_EXTERNO_INFORMADO = "cfg_os_externo_informado";
const CFG_OS_INTERNO = "cfg_os_interno";

const ULID_RE = "[0-9A-HJKMNP-TV-Z]{26}";

/**
 * @param {string} personaId
 * @param {number} anioCalendario — año del documento sal_YYYY_per_…
 */
function saldoAnualDocId(personaId, anioCalendario) {
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
function buildBolsaKey(articuloId, anioOrigen) {
  return `bol_${String(articuloId || "").trim()}_${Number(anioOrigen)}`;
}

/**
 * @param {string} personaId
 */
function saldoGlobalDocId(personaId) {
  const m = new RegExp(`^per_(${ULID_RE})$`, "i").exec(String(personaId || "").trim());
  if (!m) return null;
  return `sal_global_per_${m[1]}`;
}

/**
 * @param {string} articuloId
 */
function buildBolsaKeyGlobal(articuloId) {
  return `bol_${String(articuloId || "").trim()}_global`;
}

/**
 * Patrón B — ciclo en sal_YYYY (check-in: cupo versión − ya consumidos).
 */
function buildBolsaCheckinPatronB(params) {
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
function buildBolsaCheckinPatronC(params) {
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
function resolveCodigoGrillaForBolsa(versionData, anioOrigen, articuloCodigoFallback = "LAO") {
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
function buildBolsaPayload(params) {
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
function mergeBolsasFromSaldoDocs(saldoDocs) {
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
function findOldestAnioOrigenWithDisponible(saldosData, articuloId) {
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
function assertFifoAnioOrigen(saldosData, articuloId, anioElegido) {
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
function pickBolsaParaConsumo(saldosData, articuloId, anioOrigenBolsa) {
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

/**
 * Camino LAO según año civil de `fecha_desde` vs `anio_origen_bolsa` (misma regla que preview motor).
 * @param {string} fechaDesdeYmd
 * @param {number} anioOrigenBolsa
 */
function resolveCaminoLaoPreview(fechaDesdeYmd, anioOrigenBolsa) {
  const y = Number(String(fechaDesdeYmd || "").slice(0, 4));
  const anioNum = Number(anioOrigenBolsa);
  if (!Number.isInteger(y) || y < 1900 || !Number.isInteger(anioNum) || anioNum < 1900) {
    return "error_ano";
  }
  if (y > anioNum) return "stock";
  if (y < anioNum) return "error_ano";
  return "proporcional";
}

/**
 * Barrera contable para `simularLaoPreview` (saldos en `saldos_articulo_agente`).
 * @param {{
 *   saldosMerged: { bolsas?: Record<string, object> },
 *   articuloId: string,
 *   anioOrigenBolsa: number,
 *   diasSolicitados: number,
 *   fechaDesdeYmd: string,
 *   diasProporcionalesPiso?: number | null,
 * }} params
 */
function evaluarSaldoBolsaParaPreview(params) {
  const {
    saldosMerged,
    articuloId,
    anioOrigenBolsa,
    diasSolicitados,
    fechaDesdeYmd,
    diasProporcionalesPiso = null,
  } = params;

  const anioNum = Number(anioOrigenBolsa);
  const dias = Number(diasSolicitados);
  const camino = resolveCaminoLaoPreview(fechaDesdeYmd, anioNum);

  /** @type {string[]} */
  const motivos = [];

  if (camino === "error_ano") {
    motivos.push("El año de la fecha de inicio no puede ser menor que el año de origen de la bolsa.");
    return { ok: false, motivos, disponible: null, camino };
  }

  try {
    assertFifoAnioOrigen(saldosMerged, articuloId, anioNum);
  } catch (err) {
    motivos.push(err instanceof Error ? err.message : String(err));
    return { ok: false, motivos, disponible: null, camino };
  }

  const picked = pickBolsaParaConsumo(saldosMerged, articuloId, anioNum);
  if (!picked) {
    motivos.push(`No se encontró bolsa LAO para el año origen ${anioNum}.`);
    return { ok: false, motivos, disponible: null, camino };
  }

  const disponible = Number(picked.bolsa.disponible);
  const dispOk = Number.isFinite(disponible) ? disponible : 0;

  if (camino === "stock" && dias > dispOk) {
    motivos.push(
      `Saldo insuficiente. Solicitás ${dias} día(s), pero solo tenés ${dispOk} disponible(s) en la bolsa ${anioNum}.`,
    );
    return { ok: false, motivos, disponible: dispOk, camino, bolsa_id: picked.bolsaId };
  }

  if (camino === "proporcional" && dispOk > 0 && dias > dispOk) {
    motivos.push(
      `Saldo insuficiente. Solicitás ${dias} día(s), pero solo tenés ${dispOk} disponible(s) en la bolsa ${anioNum}.`,
    );
    return { ok: false, motivos, disponible: dispOk, camino, bolsa_id: picked.bolsaId };
  }

  const piso = Number(diasProporcionalesPiso);
  if (camino === "proporcional" && Number.isFinite(piso) && piso >= 0 && dias > piso) {
    motivos.push(
      `El pedido (${dias} día(s)) supera el piso proporcional calculado (${piso} día(s)) para el ejercicio ${anioNum}.`,
    );
    return { ok: false, motivos, disponible: dispOk, camino, bolsa_id: picked.bolsaId };
  }

  return { ok: true, motivos: [], disponible: dispOk, camino, bolsa_id: picked.bolsaId };
}

module.exports = { CFG_OS_EXTERNO_INFORMADO, CFG_OS_INTERNO, saldoAnualDocId, buildBolsaKey, saldoGlobalDocId, buildBolsaKeyGlobal, buildBolsaCheckinPatronB, buildBolsaCheckinPatronC, resolveCodigoGrillaForBolsa, buildBolsaPayload, mergeBolsasFromSaldoDocs, findOldestAnioOrigenWithDisponible, assertFifoAnioOrigen, pickBolsaParaConsumo, resolveCaminoLaoPreview, evaluarSaldoBolsaParaPreview };
