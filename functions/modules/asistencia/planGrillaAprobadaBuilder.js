"use strict";

/**
 * Construye grilla_aprobada en memoria desde la foto teórica del plan (agentes[].dias).
 * @see docs/v2/RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md
 */

const { construirGrillaAprobadaDesdePlanFoto } = require("./planEnriquecimientoDias");

/**
 * @param {{ plan: object, planId: string }} params
 * @returns {Promise<object|null>}
 */
async function construirGrillaAprobada({ plan, planId }) {
  if (!plan || plan.tipo_plan !== "mensual" || !plan.periodo) return null;
  const agentesOut = await construirGrillaAprobadaDesdePlanFoto({ plan, planId });
  if (!agentesOut || agentesOut.length === 0) return null;

  return {
    version: 1,
    periodo: plan.periodo,
    grupo_id: plan.grupo_id || null,
    materializado_en: new Date().toISOString(),
    agentes: agentesOut,
  };
}

module.exports = { construirGrillaAprobada };
