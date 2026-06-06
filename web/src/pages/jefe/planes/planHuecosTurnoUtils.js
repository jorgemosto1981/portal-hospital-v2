/**
 * US-9 / US-10: huecos laborable|guardia sin turno_id (misma regla que assertPlanSinHuecosTurno).
 */

/** @param {object|null|undefined} cel */
export function celdaEsHuecoTurnoPlan(cel) {
  if (!cel || typeof cel !== "object") return false;
  const tipo = String(cel.tipo_dia || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (tipo !== "laborable" && tipo !== "guardia") return false;
  const tid = cel.turno_id;
  if (tid == null) return true;
  return String(tid).trim() === "";
}

/**
 * @param {Array<{ persona_id?: string }>} agentes
 * @param {Record<string, Record<string, object>>} grillaPorPersona
 * @param {{ omitirCelda?: (personaId: string, ymd: string, cel: object) => boolean }} [options]
 */
export function contarHuecosTurnoPlan(agentes, grillaPorFila, options = {}) {
  const { omitirCelda } = options;
  let n = 0;
  for (const ag of agentes || []) {
    const key =
      String(ag?.fila_id || "").trim()
      || (String(ag?.hlg_id || "").trim()
        ? `${String(ag.persona_id || "").trim()}__${String(ag.hlg_id).trim()}`
        : String(ag.persona_id || "").trim());
    if (!key) continue;
    const row = grillaPorFila[key] || {};
    for (const [ymd, cel] of Object.entries(row)) {
      if (omitirCelda?.(key, ymd, cel, ag)) continue;
      if (celdaEsHuecoTurnoPlan(cel)) n += 1;
    }
  }
  return n;
}

/** @param {{ agentes?: Array<{ persona_id?: string, dias?: Record<string, object> }> } | null | undefined} plan */
export function contarHuecosEnPlanMensual(plan) {
  const agentes = plan?.agentes;
  if (!Array.isArray(agentes) || agentes.length === 0) return 0;
  const grilla = {};
  for (const ag of agentes) {
    const pid = String(ag.persona_id || "").trim();
    if (!pid) continue;
    grilla[pid] = ag.dias && typeof ag.dias === "object" ? ag.dias : {};
  }
  return contarHuecosTurnoPlan(agentes, grilla);
}

/** @param {number} n */
export function tooltipBloqueoHuecosPlan(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const unidad = n === 1 ? "asignación sin turno" : "asignaciones sin turno";
  return `Hay ${n} ${unidad} (laborable/guardia). Corregí la grilla antes de enviar o aprobar; la habilitación está bloqueada (PLT-US9-001).`;
}
