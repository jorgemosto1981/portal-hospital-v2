/**
 * Ciclo de Visibilidad de Celda (CVC) — API nombrada para regenerar la capa visual
 * de celdas día sin recargar el mes entero.
 *
 * Documentación: docs/v2/RFC_CICLO_VIS_CELDA_GRILLA_V2.md
 *
 * Fases batch (gestión turno): ver FASE_CICLO_APLICAR_CAMBIO en grillaCicloAplicarCambioInmediato.js
 */

import { paresCeldaDesdeOp } from "../../../../shared/utils/grillaMesNodos/grillaMesNodoImpacto.js";

export { FASE_CICLO_APLICAR_CAMBIO } from "./grillaCicloAplicarCambioInmediato.js";

export {
  paresCeldaDesdeOp,
  nodosAfectadosPorOp,
  buildCellKey,
} from "../../../../shared/utils/grillaMesNodos/index.js";

export {
  patchFilasGrillaDesdeParchesVis,
  resolverParchesVisTrasBatchExito,
  parchesVisDesdeRespuestaBatch,
} from "./grillaMesNodosBatchParches.js";

export { mergeCeldaVisParche } from "../../../../shared/utils/grillaMesNodos/mergeCeldaVisParche.js";
export {
  coherirCeldaVisTeoriaFranco,
  celdaVisIndicaFrancoOperativo,
} from "../../../../shared/utils/visCeldaFusionLectura.js";

export { mergeCeldaNodoConFallback } from "./grillaDiaCeldaMerge.js";

/** Fases del ciclo de visibilidad (todas las mutaciones). */
export const FASE_CICLO_VIS_CELDA = Object.freeze({
  CARGA_MES: "carga_mes",
  SINCRONIZAR: "sincronizar",
  OVERLAY_PENDIENTE: "overlay_pendiente",
  RECARGA_MES: "recarga_mes",
});

/**
 * @param {import("../../../../shared/utils/grillaMesNodos/grillaMesNodoImpacto.js").CeldaPar[]} pares
 */
export function refsDesdeParesCelda(pares) {
  return (pares || []).map((p) => ({
    persona_id: p.persona_id,
    fecha_ymd: p.fecha_ymd,
    gdt: p.gdt,
  }));
}

/**
 * @param {Record<string, unknown>} op
 */
export function refsDesdeOpGrilla(op) {
  return refsDesdeParesCelda(paresCeldaDesdeOp(op));
}

/**
 * Sincroniza store + filas React desde `vis_*` (CVC-4).
 * Alias conceptual de `parchearCeldasTrasMutacion` en `GrillaMesLicenciasPanel`.
 *
 * @param {Array<{ persona_id?: string; fecha_ymd?: string; gdt?: string; grupo_trabajo_id?: string }>} refs
 * @param {{
 *   grillaMesNodos: { aplicarParchesVisEnGrilla: Function };
 *   vista: { patchFilasDesdeParchesVis: Function };
 *   invalidarCacheGrillaTrasMutacion: (p: Record<string, unknown>) => void;
 *   periodo?: string;
 *   gdtActivo?: string;
 *   grupoIdVista?: string;
 *   reemplazoTeoriaCompleto?: boolean;
 * }} deps
 */
export async function sincronizarCeldasVisGrilla(refs, deps) {
  const list = (Array.isArray(refs) ? refs : []).filter(
    (r) => r?.persona_id && r?.fecha_ymd && (r?.gdt || r?.grupo_trabajo_id),
  );
  if (!list.length) return [];

  const gdtInv = String(list[0]?.gdt || list[0]?.grupo_trabajo_id || deps.gdtActivo || "").trim();
  deps.invalidarCacheGrillaTrasMutacion({
    ops: [],
    periodo: deps.periodo,
    gdtActivo: gdtInv,
    grupoIdVista: deps.grupoIdVista,
  });

  const parches = await deps.grillaMesNodos.aplicarParchesVisEnGrilla(list, {
    reemplazoTeoriaCompleto: deps.reemplazoTeoriaCompleto === true,
  });

  if (parches.length) {
    deps.vista.patchFilasDesdeParchesVis(parches);
  }
  return parches;
}
