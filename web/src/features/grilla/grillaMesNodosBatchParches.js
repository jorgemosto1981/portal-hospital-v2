import { paresCeldaDesdeOp } from "../../../../shared/utils/grillaMesNodos/index.js";
import { mergeCeldaVisParche } from "../../../../shared/utils/grillaMesNodos/mergeCeldaVisParche.js";

/** Tiempo máximo para fetch de vis en el tramo crítico (no debe colgar el overlay). */
export const FETCH_PATCHES_VIS_TIMEOUT_MS = 12_000;

/**
 * @param {{ persona_id?: string; fecha_ymd?: string; gdt?: string }} p
 */
export function parcheCeldaKey(p) {
  return `${String(p.persona_id || "").trim()}|${String(p.fecha_ymd || "").trim().slice(0, 10)}|${String(p.gdt || "").trim()}`;
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("fetch-parches-timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Agrupa pares celda para mínimas llamadas `obtenerVistaGrillaMesAgente` (una por persona × mes × gdt).
 * @param {Array<Record<string, unknown>>} ops
 */
export function agruparFetchVistaDesdeOps(ops) {
  /** @type {Array<{ gdt?: string; persona_id?: string; fecha_ymd?: string; fecha?: string }>} */
  const refs = [];
  for (const op of ops || []) {
    for (const par of paresCeldaDesdeOp(op)) {
      refs.push({
        gdt: par.gdt,
        persona_id: par.persona_id,
        fecha_ymd: par.fecha_ymd,
      });
    }
  }
  return agruparFetchVistaDesdeReferencias(refs);
}

/**
 * Agrupa referencias explícitas persona × fecha × gdt para fetch mínimo de vis.
 * @param {Array<{ gdt?: string; grupo_trabajo_id?: string; persona_id?: string; fecha_ymd?: string; fecha?: string }>} refs
 */
export function agruparFetchVistaDesdeReferencias(refs) {
  /** @type {Map<string, { gdt: string; persona_id: string; anio: number; mes: number; fechas: Set<string> }>} */
  const map = new Map();
  for (const ref of refs || []) {
    const persona_id = String(ref.persona_id || "").trim();
    const gdt = String(ref.gdt || ref.grupo_trabajo_id || "").trim();
    const fechaYmd = String(ref.fecha_ymd || ref.fecha || "").trim().slice(0, 10);
    const [yyyy, mm] = fechaYmd.split("-");
    const anio = Number(yyyy);
    const mes = Number(mm);
    if (!gdt || !persona_id || !Number.isFinite(anio) || !Number.isFinite(mes)) continue;
    const key = `${gdt}|${persona_id}|${anio}|${mes}`;
    let row = map.get(key);
    if (!row) {
      row = { gdt, persona_id, anio, mes, fechas: new Set() };
      map.set(key, row);
    }
    row.fechas.add(fechaYmd);
  }
  return [...map.values()];
}

/**
 * @param {Array<{ gdt: string; persona_id: string; anio: number; mes: number; fechas: Set<string> }>} grupos
 * @param {import("../../services/callables.js").callObtenerVistaGrillaMesAgente} fetchVista
 */
async function fetchParchesVisDesdeGrupos(grupos, fetchVista) {
  /** @type {Array<{ persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>} */
  const parches = [];
  for (const g of grupos) {
    const res = await fetchVista({
      persona_id: g.persona_id,
      grupo_trabajo_id: g.gdt,
      anio: g.anio,
      mes: g.mes,
    });
    const payload = res?.data ?? res;
    const dias = payload?.dias && typeof payload.dias === "object" ? payload.dias : {};
    for (const fechaYmd of g.fechas) {
      const dk = String(fechaYmd || "").slice(8, 10);
      const celda = dias[dk];
      if (!celda || typeof celda !== "object") continue;
      parches.push({
        persona_id: g.persona_id,
        fecha_ymd: fechaYmd,
        gdt: g.gdt,
        celda: { ...celda },
      });
    }
  }
  return parches;
}

/**
 * @param {import("../../services/callables.js").callObtenerVistaGrillaMesAgente} fetchVista
 * @param {Array<Record<string, unknown>>} ops — outbox aplicado
 * @returns {Promise<Array<{ persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>>}
 */
export async function fetchParchesVisDesdeOpsOutbox(ops, fetchVista) {
  return fetchParchesVisDesdeGrupos(agruparFetchVistaDesdeOps(ops), fetchVista);
}

/**
 * Parches vis para confirmar batch: prioriza `dias_actualizados` del servidor;
 * fetch solo si faltan celdas y con timeout (tramo crítico del ciclo de aplicación).
 *
 * @param {Array<Record<string, unknown>>} ops
 * @param {Record<string, unknown> | null | undefined} batchResult
 * @param {import("../../services/callables.js").callObtenerVistaGrillaMesAgente} fetchVista
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function resolverParchesVisTrasBatchExito(ops, batchResult, fetchVista, opts = {}) {
  const list = Array.isArray(ops) ? ops : [];
  const fromBatch = parchesVisDesdeRespuestaBatch(batchResult);
  const keysBatch = new Set(fromBatch.map((p) => parcheCeldaKey(p)));

  const visto = new Set();
  /** @type {Array<{ persona_id: string; fecha_ymd: string; gdt: string }>} */
  const paresNecesarios = [];
  for (const op of list) {
    for (const par of paresCeldaDesdeOp(op)) {
      const k = parcheCeldaKey(par);
      if (visto.has(k)) continue;
      visto.add(k);
      paresNecesarios.push(par);
    }
  }

  const faltanEnBatch = paresNecesarios.some((p) => !keysBatch.has(parcheCeldaKey(p)));
  let fromFetch = [];
  if (faltanEnBatch && typeof fetchVista === "function") {
    const timeoutMs = opts.timeoutMs ?? FETCH_PATCHES_VIS_TIMEOUT_MS;
    try {
      fromFetch = await withTimeout(
        fetchParchesVisDesdeOpsOutbox(list, fetchVista),
        timeoutMs,
      );
    } catch {
      fromFetch = [];
    }
  }
  return mergeParchesVisLista(fromFetch, fromBatch);
}

/**
 * Fetch puntual de celdas vis tras fichada / capa teoría (Fase C — sin reload del mes).
 * @param {Array<{ gdt?: string; grupo_trabajo_id?: string; persona_id?: string; fecha_ymd?: string; fecha?: string }>} refs
 * @param {import("../../services/callables.js").callObtenerVistaGrillaMesAgente} fetchVista
 */
export async function fetchParchesVisDesdeReferencias(refs, fetchVista) {
  return fetchParchesVisDesdeGrupos(agruparFetchVistaDesdeReferencias(refs), fetchVista);
}

/**
 * Última lista gana por celda (persona × fecha × gdt).
 * @param  {...Array<{ persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>} listas
 */
export function mergeParchesVisLista(...listas) {
  /** @type {Map<string, { persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>} */
  const map = new Map();
  for (const lista of listas) {
    if (!Array.isArray(lista)) continue;
    for (const p of lista) {
      if (!p?.persona_id || !p?.fecha_ymd || !p?.gdt || !p?.celda) continue;
      const key = `${String(p.persona_id).trim()}|${String(p.fecha_ymd).trim().slice(0, 10)}|${String(p.gdt).trim()}`;
      map.set(key, p);
    }
  }
  return [...map.values()];
}

/**
 * Aplica parches vis en `filas[].dias` (read model equipo) sin refetch del mes.
 * @param {Array<Record<string, unknown>>} filas
 * @param {Array<{ persona_id: string; fecha_ymd: string; celda: Record<string, unknown> }>} parches
 */
export function patchFilasGrillaDesdeParchesVis(filas, parches) {
  if (!Array.isArray(filas) || !parches?.length) return filas || [];
  const porPersona = new Map();
  for (const p of parches) {
    const pid = String(p.persona_id || "").trim();
    const fy = String(p.fecha_ymd || "").trim().slice(0, 10);
    if (!pid || !/^\d{4}-\d{2}-\d{2}$/.test(fy)) continue;
    const dk = fy.slice(8, 10);
    if (!porPersona.has(pid)) porPersona.set(pid, new Map());
    porPersona.get(pid).set(dk, p.celda);
  }
  if (!porPersona.size) return filas;

  return filas.map((fila) => {
    const pid = String(fila?.persona_id || "").trim();
    const diasPatch = porPersona.get(pid);
    if (!diasPatch?.size) return fila;
    const dias = fila?.dias && typeof fila.dias === "object" ? { ...fila.dias } : {};
    for (const [dk, celda] of diasPatch) {
      if (celda && typeof celda === "object") {
        dias[dk] = mergeCeldaVisParche(dias[dk], celda);
      }
    }
    return { ...fila, dias };
  });
}

/**
 * Normaliza `dias_actualizados` del callable `aplicarBatchAsistencia` al contrato del store.
 * @param {Record<string, unknown> | null | undefined} batchResult
 * @returns {Array<{ persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>}
 */
export function parchesVisDesdeRespuestaBatch(batchResult) {
  const raw = batchResult?.dias_actualizados ?? batchResult?.parches ?? [];
  if (!Array.isArray(raw)) return [];
  /** @type {Array<{ persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>} */
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const persona_id = String(row.persona_id || "").trim();
    const fecha_ymd = String(row.fecha_ymd || row.fecha || "").trim().slice(0, 10);
    const gdt = String(row.grupo_trabajo_id || row.gdt || "").trim();
    const celda = row.celda ?? row.data;
    if (!persona_id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_ymd) || !gdt || !celda || typeof celda !== "object") {
      continue;
    }
    out.push({
      persona_id,
      fecha_ymd,
      gdt,
      celda: { ...celda },
    });
  }
  return out;
}
