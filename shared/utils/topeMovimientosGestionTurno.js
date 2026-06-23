/**
 * [BATCH-LIM-001] — conteo de movimientos por tramo × día × persona × gdt (D0-A).
 * Fuente histórica: overrides en asistencia_diaria (Firestore).
 */

import { TOPE_MOVIMIENTOS_MAX } from "./topeMovimientosConfig.js";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} raw
 */
export function canonicalizarSegmentoTope(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^[A-Za-z]{1,4}$/.test(s)) return s.toUpperCase();
  return s;
}

/**
 * @param {string | null | undefined} creadoEn
 * @param {string | null | undefined} vigenteDesde
 */
export function overrideCuentaPorVigencia(creadoEn, vigenteDesde) {
  const desde = String(vigenteDesde || "").trim();
  if (!desde) return false;
  const t = String(creadoEn || "").trim();
  if (!t) return false;
  return t >= desde;
}

/**
 * @param {Record<string, unknown>} ov
 */
export function esTrasladoReemplazoV2Override(ov) {
  if (!ov || typeof ov !== "object" || ov.tipo !== "reemplazo") return false;
  const leg = String(ov.reemplazo_traslado_v2 || "").trim();
  if (leg === "origen" || leg === "destino") return true;
  if (Array.isArray(ov.segmentos_incorporados_destino) && ov.segmentos_incorporados_destino.length > 0) {
    return true;
  }
  const segs = ov.segmentos_a_trasladar || ov.segmentos_trasladar;
  const fo = String(ov.fecha_origen || "").trim();
  const fd = String(ov.fecha_destino || "").trim();
  return Array.isArray(segs) && segs.length > 0 && YMD.test(fo) && YMD.test(fd) && fo !== fd;
}

/**
 * @param {Record<string, unknown>} ov
 */
export function esIntercambioGuardiaV2Override(ov) {
  if (!ov || typeof ov !== "object" || ov.tipo !== "cobertura_parcial") return false;
  if (ov.schema_version === 2) return true;
  const fo = String(ov.fecha_origen || "").trim();
  const fd = String(ov.fecha_destino || "").trim();
  const so = ov.segmentos_cedidos_origen;
  const sd = ov.segmentos_cedidos_destino;
  return (
    YMD.test(fo)
    && YMD.test(fd)
    && Array.isArray(so)
    && so.length > 0
    && Array.isArray(sd)
    && sd.length > 0
  );
}

/**
 * @param {Record<string, unknown>} ov
 */
export function overrideCuentaParaTope(ov) {
  if (!ov || typeof ov !== "object") return false;
  if (ov.invalidado_por_replanificacion === true) return false;
  if (esTrasladoReemplazoV2Override(ov)) return true;
  if (esIntercambioGuardiaV2Override(ov)) return true;
  return false;
}

/**
 * @param {Record<string, unknown>} ov
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} gdt
 * @returns {Array<{ persona_id: string, fecha_ymd: string, segmento_id_canon: string, gdt: string, delta: number }>}
 */
export function derivarIncrementosDesdeOverridePersistido(ov, personaId, fechaYmd, gdt) {
  if (!overrideCuentaParaTope(ov)) return [];
  const pid = String(personaId || "").trim();
  const fecha = String(fechaYmd || "").trim().slice(0, 10);
  const g = String(gdt || ov.grupo_de_trabajo_id || "").trim();
  if (!pid || !YMD.test(fecha) || !g) return [];

  /** @type {Array<{ persona_id: string, fecha_ymd: string, segmento_id_canon: string, gdt: string, delta: number }>} */
  const out = [];
  const push = (p, f, seg) => {
    const canon = canonicalizarSegmentoTope(seg);
    if (!canon) return;
    out.push({
      persona_id: p,
      fecha_ymd: f,
      segmento_id_canon: canon,
      gdt: g,
      delta: 1,
    });
  };

  if (esTrasladoReemplazoV2Override(ov)) {
    const leg = String(ov.reemplazo_traslado_v2 || "").trim();
    if (leg === "destino") {
      for (const s of ov.segmentos_incorporados_destino || []) {
        push(pid, fecha, s);
      }
    } else {
      for (const s of ov.segmentos_a_trasladar || ov.segmentos_trasladar || []) {
        push(pid, fecha, s);
      }
    }
    return out;
  }

  if (esIntercambioGuardiaV2Override(ov)) {
    const po = String(ov.persona_origen_id || "").trim();
    const pc = String(ov.persona_cobertura_id || "").trim();
    const fo = String(ov.fecha_origen || "").trim().slice(0, 10);
    const fd = String(ov.fecha_destino || "").trim().slice(0, 10);
    if (pid === po && fecha === fo) {
      const segs = ov.segmentos_cedidos_origen || ov.segmentos_cubiertos || [];
      for (const s of segs) push(pid, fecha, s);
    } else if (pid === pc && fecha === fd) {
      for (const s of ov.segmentos_cedidos_destino || []) push(pid, fecha, s);
    }
  }
  return out;
}

/**
 * @param {{ persona_id: string, fecha_ymd: string, segmento_id_canon: string, gdt: string }} inc
 */
export function claveIncrementoTope(inc) {
  return `${inc.persona_id}|${inc.fecha_ymd}|${inc.segmento_id_canon}|${inc.gdt}`;
}

/**
 * Ítems normalizados de `normalizeBatchOp` (uno o varios por op raw).
 * @param {Array<Record<string, unknown>>} items
 */
export function derivarIncrementosTopeDesdeBatchItems(items) {
  const list = Array.isArray(items) ? items : [];
  /** @type {Array<{ persona_id: string, fecha_ymd: string, segmento_id_canon: string, gdt: string, delta: number }>} */
  const out = [];

  const esCoberturaV2Item = (it) => (
    it.tipo === "cobertura_parcial"
    && it.schema_version === 2
    && YMD.test(String(it.fecha_destino || ""))
  );

  for (const it of list) {
    const gdt = String(it.grupo_trabajo_id || "").trim();
    const ov = it.override && typeof it.override === "object" ? it.override : {};

    if (esCoberturaV2Item(it)) {
      const po = String(it.persona_origen_id || "").trim();
      const pc = String(it.persona_cobertura_id || "").trim();
      const fo = String(it.fecha || "").trim().slice(0, 10);
      const fd = String(it.fecha_destino || "").trim().slice(0, 10);
      for (const s of ov.segmentos_cedidos_origen || ov.segmentos_cubiertos || []) {
        out.push({
          persona_id: po,
          fecha_ymd: fo,
          segmento_id_canon: canonicalizarSegmentoTope(s),
          gdt,
          delta: 1,
        });
      }
      for (const s of ov.segmentos_cedidos_destino || []) {
        out.push({
          persona_id: pc,
          fecha_ymd: fd,
          segmento_id_canon: canonicalizarSegmentoTope(s),
          gdt,
          delta: 1,
        });
      }
      continue;
    }

    if (it.tipo === "reemplazo" && esTrasladoReemplazoV2Override(ov)) {
      const pid = String(it.persona_id || "").trim();
      const fecha = String(it.fecha || "").trim().slice(0, 10);
      out.push(...derivarIncrementosDesdeOverridePersistido(ov, pid, fecha, gdt));
    }
  }

  return out.filter((x) => x.segmento_id_canon && x.persona_id && YMD.test(x.fecha_ymd) && x.gdt);
}

/**
 * @param {Array<Record<string, unknown>>} overridesEnriquecidos — cada fila: override + persona_id_doc + fecha_ymd
 * @param {string | null | undefined} vigenteDesde
 */
export function mapaConteoHistoricoTope(overridesEnriquecidos, vigenteDesde) {
  const rows = Array.isArray(overridesEnriquecidos) ? overridesEnriquecidos : [];
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const porBatch = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const ov = row && typeof row === "object" ? row : {};
    const meta = /** @type {Record<string, unknown>} */ (ov);
    const inner = meta.override && typeof meta.override === "object" ? meta.override : meta;
    if (!overrideCuentaParaTope(inner)) continue;
    if (!overrideCuentaPorVigencia(inner.creado_en, vigenteDesde)) continue;

    const personaDoc = String(meta.persona_id_doc || inner.persona_id || "").trim();
    const fechaDoc = String(meta.fecha_ymd || "").trim().slice(0, 10);
    const batchId = String(inner.op_batch_id || `sin_batch_${i}_${fechaDoc}`).trim();

    const list = porBatch.get(batchId) || [];
    list.push({ ov: inner, personaDoc, fechaDoc });
    porBatch.set(batchId, list);
  }

  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const entries of porBatch.values()) {
    /** @type {Set<string>} */
    const vistos = new Set();
    for (const { ov, personaDoc, fechaDoc } of entries) {
      const gdt = String(ov.grupo_de_trabajo_id || "").trim();
      const pid = String(ov.persona_id || personaDoc).trim();
      const incs = derivarIncrementosDesdeOverridePersistido(ov, pid, fechaDoc, gdt);
      for (const inc of incs) {
        const k = claveIncrementoTope(inc);
        if (vistos.has(k)) continue;
        vistos.add(k);
        totals.set(k, (totals.get(k) || 0) + inc.delta);
      }
    }
  }
  return totals;
}

/**
 * @param {{
 *   overridesEnriquecidos: Array<Record<string, unknown>>;
 *   batchItems: Array<Record<string, unknown>>;
 *   vigenteDesde: string | null | undefined;
 *   tope?: number;
 * }} params
 */
export function evaluarTopeMovimientosBatch(params) {
  const {
    overridesEnriquecidos,
    batchItems,
    vigenteDesde,
    tope = TOPE_MOVIMIENTOS_MAX,
  } = params || {};

  const desde = String(vigenteDesde || "").trim();
  if (!desde) {
    return { ok: true, violaciones: [], omitido: true };
  }

  const hist = mapaConteoHistoricoTope(overridesEnriquecidos, desde);
  const pending = derivarIncrementosTopeDesdeBatchItems(batchItems);

  /** @type {Map<string, number>} */
  const pendingMap = new Map();
  for (const inc of pending) {
    const k = claveIncrementoTope(inc);
    pendingMap.set(k, (pendingMap.get(k) || 0) + inc.delta);
  }

  /** @type {Array<Record<string, unknown>>} */
  const violaciones = [];
  for (const [clave, deltaNuevo] of pendingMap) {
    const prev = hist.get(clave) || 0;
    if (prev + deltaNuevo > tope) {
      const [persona_id, fecha_ymd, segmento_id_canon, gdt] = clave.split("|");
      violaciones.push({
        clave,
        persona_id,
        fecha_ymd,
        segmento_id_canon,
        gdt,
        conteo_previo: prev,
        delta_nuevo: deltaNuevo,
        tope,
      });
    }
  }

  return { ok: violaciones.length === 0, violaciones, omitido: false };
}

/**
 * @param {string | null | undefined} vigenteDesde
 * @param {string} [nowIso]
 */
export function topeMovimientosActivo(vigenteDesde, nowIso = new Date().toISOString()) {
  const desde = String(vigenteDesde || "").trim();
  if (!desde) return false;
  return String(nowIso) >= desde;
}

/**
 * @param {{
 *   overridesMes: Array<Record<string, unknown>>;
 *   persona_id: string;
 *   fecha_ymd: string;
 *   segmento_id: string;
 *   gdt: string;
 *   vigenteDesde: string | null | undefined;
 * }} params
 */
export function contarMovimientosTramoDia(params) {
  const {
    overridesMes,
    persona_id,
    fecha_ymd,
    segmento_id,
    gdt,
    vigenteDesde,
  } = params || {};
  const canon = canonicalizarSegmentoTope(segmento_id);
  const clave = claveIncrementoTope({
    persona_id: String(persona_id || "").trim(),
    fecha_ymd: String(fecha_ymd || "").trim().slice(0, 10),
    segmento_id_canon: canon,
    gdt: String(gdt || "").trim(),
  });
  const map = mapaConteoHistoricoTope(overridesMes, vigenteDesde);
  return map.get(clave) || 0;
}
