/**
 * T-07 — caché RAM de payloads de vista grilla (read model `vis_*` / listar por grupo).
 * Módulo puro: sin React; el hook `useGrillaMesVista` consulta antes de red.
 */

import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";

/**
 * Clave estable para un bounded context mensual GDT.
 * @param {{
 *   grupoTrabajoId?: string;
 *   anio: number;
 *   mes: number;
 *   modo?: string;
 *   personaId?: string;
 * }} parts
 * @returns {string}
 */
export function buildGrillaVistaCacheKey(parts) {
  const gdt = String(parts.grupoTrabajoId || "").trim() || "_sin_gdt";
  const anio = Number(parts.anio);
  const mes = Number(parts.mes);
  const mm = Number.isFinite(mes) ? String(mes).padStart(2, "0") : "00";
  const modo = String(parts.modo || GRILLA_MES_MODO.EQUIPO).trim();
  const pid =
    modo === GRILLA_MES_MODO.TITULAR
      ? String(parts.personaId || "").trim() || "_sin_persona"
      : "";
  const titularSuffix = pid ? `_tit_${pid}` : "";
  return `gdt_${gdt}_per_${anio}_${mm}_mod_${modo}${titularSuffix}`;
}

/**
 * @param {string} periodoYm — `YYYY-MM`
 * @returns {{ anio: number; mes: number } | null}
 */
export function anioMesDesdePeriodoCache(periodoYm) {
  const [yyyy, mm] = String(periodoYm || "").split("-");
  const anio = Number(yyyy);
  const mes = Number(mm);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return null;
  }
  return { anio, mes };
}

/**
 * Invalida todas las claves que comparten GDT + año + mes (cualquier modo).
 * @param {Map<string, unknown>} map
 * @param {string} grupoTrabajoId
 * @param {number} anio
 * @param {number} mes
 */
export function invalidateGrillaCacheGrupoMes(map, grupoTrabajoId, anio, mes) {
  const gdt = String(grupoTrabajoId || "").trim();
  if (!gdt) return 0;
  const mm = String(mes).padStart(2, "0");
  const prefix = `gdt_${gdt}_per_${anio}_${mm}_`;
  let removed = 0;
  for (const key of [...map.keys()]) {
    if (key.startsWith(prefix)) {
      map.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * @param {{ ttlMs?: number | null }} [options] — `ttlMs: null` desactiva TTL
 */
export function createGrillaCacheMemoryStore(options = {}) {
  const ttlMs = options.ttlMs === undefined ? 5 * 60 * 1000 : options.ttlMs;
  /** @type {Map<string, { data: unknown; cachedAt: number }>} */
  const map = new Map();

  function isExpired(entry) {
    if (ttlMs == null || ttlMs <= 0) return false;
    return Date.now() - entry.cachedAt > ttlMs;
  }

  /**
   * @param {string} key
   * @returns {unknown | undefined}
   */
  function get(key) {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (isExpired(entry)) {
      map.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    return get(key) !== undefined;
  }

  /**
   * @param {string} key
   * @param {unknown} data
   */
  function set(key, data) {
    map.set(key, { data, cachedAt: Date.now() });
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  function deleteKey(key) {
    return map.delete(key);
  }

  function clear() {
    map.clear();
  }

  /**
   * @param {string} grupoTrabajoId
   * @param {number} anio
   * @param {number} mes
   * @returns {number} claves eliminadas
   */
  function invalidateGrupoMes(grupoTrabajoId, anio, mes) {
    return invalidateGrillaCacheGrupoMes(map, grupoTrabajoId, anio, mes);
  }

  /**
   * @param {string} periodoYm
   * @param {string} grupoTrabajoId
   */
  function invalidateGrupoPeriodo(grupoTrabajoId, periodoYm) {
    const ref = anioMesDesdePeriodoCache(periodoYm);
    if (!ref) return 0;
    return invalidateGrupoMes(grupoTrabajoId, ref.anio, ref.mes);
  }

  return {
    get,
    set,
    has,
    delete: deleteKey,
    clear,
    invalidateGrupoMes,
    invalidateGrupoPeriodo,
    size: () => map.size,
  };
}

/** Store singleton de la app (compartido entre montajes del panel). */
export const grillaVistaCacheStore = createGrillaCacheMemoryStore();

/**
 * Tras mutación de fichadas / teoría / outbox — misma política que el panel GSO.
 * @param {{ ops?: Array<{ grupoId?: string }>; periodo?: string; gdtActivo?: string; grupoIdVista?: string }} params
 */
export function invalidarCacheGrillaTrasMutacion(params) {
  const periodoInv = String(params.periodo || "").trim();
  if (!periodoInv) return;
  const grupos = new Set();
  const gdt = String(params.gdtActivo || params.grupoIdVista || "").trim();
  if (gdt) grupos.add(gdt);
  for (const op of params.ops || []) {
    const og = String(op.grupoId || "").trim();
    if (og) grupos.add(og);
  }
  for (const gid of grupos) {
    grillaVistaCacheStore.invalidateGrupoPeriodo(gid, periodoInv);
  }
}
