import { buildCellKey, normalizeFechaYmd, normalizeGdtId, normalizePersonaId } from "./grillaMesNodoKeys.js";

/** @typedef {{ gdt: string; persona_id: string; fecha_ymd: string }} CeldaPar */

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Record<string, unknown>} op
 */
export function gdtDesdeOp(op) {
  return normalizeGdtId(
    op?.grupo_trabajo_id || op?.grupoTrabajoId || op?.grupoId || op?.grupo_id,
  );
}

/**
 * Mismo criterio que `esBatchItemCoberturaV2` en cambiosTurno.js (batch v2 intercambio).
 * @param {Record<string, unknown>} op
 */
export function esCoberturaParcialBatchV2(op) {
  if (String(op?.tipo || "").trim() !== "cobertura_parcial") return false;
  if (Number(op?.schema_version) !== 2) return false;
  return RX_YMD.test(normalizeFechaYmd(op?.fecha_destino));
}

/**
 * Pares persona+fecha+gdt afectados por una op de outbox.
 * UI: alineado con `opAfectaDia` (preview). Backend rematerializa subconjunto en tipos legacy.
 *
 * @param {Record<string, unknown>} op
 * @returns {CeldaPar[]}
 */
export function paresCeldaDesdeOp(op) {
  if (!op || typeof op !== "object") return [];
  const gdt = gdtDesdeOp(op);
  if (!gdt) return [];

  const tipo = String(op.tipo || "").trim();
  /** @type {CeldaPar[]} */
  const out = [];

  const push = (persona_id, fecha_ymd) => {
    const pid = normalizePersonaId(persona_id);
    const fy = normalizeFechaYmd(fecha_ymd);
    if (!pid || !RX_YMD.test(fy)) return;
    out.push({ gdt, persona_id: pid, fecha_ymd: fy });
  };

  if (tipo === "cobertura_parcial") {
    const perO = op.personaOrigenId || op.persona_origen_id;
    const perD = op.personaDestinoId || op.personaCoberturaId || op.persona_cobertura_id;
    if (esCoberturaParcialBatchV2(op)) {
      push(perO, op.fecha);
      push(perD, op.fecha_destino);
      return out;
    }
    const fO = op.fechaOrigenYmd || op.fecha_origen || op.fechaYmd || op.fecha;
    const fD = op.fechaDestinoYmd || op.fecha_destino || op.fechaYmd || op.fecha;
    push(perO, fO);
    push(perD, fD);
    return out;
  }

  if (tipo === "reemplazo") {
    const per = op.personaId || op.persona_id;
    const fOrig = op.fechaOrigenYmd || op.fecha_origen_ymd || op.fecha_origen;
    const fDest = op.fechaDestinoYmd || op.fechaYmd || op.fecha_destino;
    push(per, fOrig);
    if (normalizeFechaYmd(fDest) !== normalizeFechaYmd(fOrig)) {
      push(per, fDest);
    }
    return out;
  }

  if (tipo === "adicional") {
    push(op.personaId || op.persona_id, op.fechaYmd || op.fecha);
    return out;
  }

  return out;
}

/**
 * @param {Record<string, unknown>} op
 * @returns {Set<string>}
 */
export function nodosAfectadosPorOp(op) {
  const keys = new Set();
  for (const par of paresCeldaDesdeOp(op)) {
    keys.add(buildCellKey(par));
  }
  return keys;
}

/**
 * @param {Array<Record<string, unknown>>} ops
 * @returns {Set<string>}
 */
export function nodosAfectadosPorOps(ops) {
  const keys = new Set();
  for (const op of ops || []) {
    for (const k of nodosAfectadosPorOp(op)) keys.add(k);
  }
  return keys;
}

/**
 * Claves estilo backend `clavesVisBatchItem` (persona|fecha|gdt) para tests contractuales.
 * @param {Record<string, unknown>} op
 * @returns {string[]}
 */
export function clavesVisBackendDesdeOp(op) {
  return paresCeldaDesdeOp(op).map((p) => `${p.persona_id}|${p.fecha_ymd}|${p.gdt}`);
}
