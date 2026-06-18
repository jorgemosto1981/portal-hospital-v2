import { paresCeldaDesdeOp } from "../../../../shared/utils/grillaMesNodos/index.js";

/**
 * Agrupa pares celda para mínimas llamadas `obtenerVistaGrillaMesAgente` (una por persona × mes × gdt).
 * @param {Array<Record<string, unknown>>} ops
 */
export function agruparFetchVistaDesdeOps(ops) {
  /** @type {Map<string, { gdt: string; persona_id: string; anio: number; mes: number; fechas: Set<string> }>} */
  const map = new Map();
  for (const op of ops || []) {
    for (const par of paresCeldaDesdeOp(op)) {
      const [yyyy, mm] = String(par.fecha_ymd || "").split("-");
      const anio = Number(yyyy);
      const mes = Number(mm);
      if (!par.gdt || !par.persona_id || !Number.isFinite(anio) || !Number.isFinite(mes)) continue;
      const key = `${par.gdt}|${par.persona_id}|${anio}|${mes}`;
      let row = map.get(key);
      if (!row) {
        row = { gdt: par.gdt, persona_id: par.persona_id, anio, mes, fechas: new Set() };
        map.set(key, row);
      }
      row.fechas.add(par.fecha_ymd);
    }
  }
  return [...map.values()];
}

/**
 * @param {import("../../services/callables.js").callObtenerVistaGrillaMesAgente} fetchVista
 * @param {Array<Record<string, unknown>>} ops — outbox aplicado
 * @returns {Promise<Array<{ persona_id: string; fecha_ymd: string; gdt: string; celda: Record<string, unknown> }>>}
 */
export async function fetchParchesVisDesdeOpsOutbox(ops, fetchVista) {
  const grupos = agruparFetchVistaDesdeOps(ops);
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
      if (celda && typeof celda === "object") dias[dk] = { ...celda };
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
