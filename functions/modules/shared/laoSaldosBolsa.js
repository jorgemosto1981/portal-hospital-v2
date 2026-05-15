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

module.exports = { CFG_OS_EXTERNO_INFORMADO, CFG_OS_INTERNO, saldoAnualDocId, buildBolsaKey, buildBolsaPayload, mergeBolsasFromSaldoDocs, findOldestAnioOrigenWithDisponible, assertFifoAnioOrigen, pickBolsaParaConsumo };
