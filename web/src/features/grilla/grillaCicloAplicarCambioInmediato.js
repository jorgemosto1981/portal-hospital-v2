import { paresCeldaDesdeOp } from "../../../../shared/utils/grillaMesNodos/index.js";

import { aplicarCambioGrillaInmediato } from "./grillaAplicarCambioInmediato.js";
import { refrescarAnaliticaFichadaDiasTrasOp } from "./refrescarAnaliticaFichadaDiasTrasOp.js";

/**
 * Ciclo de aplicación inmediata (gestión de turno → grilla sin F5).
 *
 * | Fase           | Responsabilidad                                      | Bloquea overlay (`aplicandoBatch`) |
 * |----------------|------------------------------------------------------|------------------------------------|
 * | INICIO         | Cerrar modales, `marcarOpsPendientes`, flag true     | Sí — inicio del bloqueo            |
 * | SERVIDOR       | `aplicarBatchAsistencia`                             | Sí                                 |
 * | PARCHE_CRITICO | Invalidar caché + parches vis (batch prioridad) + UI | Sí                                 |
 * | FIN_BLOQUEO_UI | `setAplicandoBatch(false)` en `finally` del panel    | No — fin del bloqueo               |
 * | POST           | Sanación analítica + re-parche opcional              | No — en background                 |
 */
export const FASE_CICLO_APLICAR_CAMBIO = Object.freeze({
  INICIO: "inicio",
  SERVIDOR: "servidor",
  PARCHE_CRITICO: "parche_critico",
  FIN_BLOQUEO_UI: "fin_bloqueo_ui",
  POST: "post",
});

/**
 * Fase SERVIDOR.
 * @param {Record<string, unknown>} enriched
 * @param {{ editorPersonaId?: string; periodo?: string }} ctx
 */
export async function faseServidorAplicarCambio(enriched, ctx) {
  return aplicarCambioGrillaInmediato(enriched, ctx);
}

/**
 * Fase PARCHE_CRITICO (sin sanación analítica — eso es POST).
 * @param {Record<string, unknown>} enriched
 * @param {Record<string, unknown>} batchResult
 * @param {{
 *   invalidarCache: (p: Record<string, unknown>) => void;
 *   confirmarBatchTrasExito: (ops: unknown[], result: unknown) => Promise<unknown[]>;
 * }} deps
 */
export async function faseParcheCriticoTrasBatch(enriched, batchResult, deps) {
  deps.invalidarCache({ ops: [enriched] });
  const parches = await deps.confirmarBatchTrasExito([enriched], batchResult);
  return /** @type {Array<Record<string, unknown>>} */ (parches);
}

/**
 * Fase POST — no await en el panel; no debe extender `aplicandoBatch`.
 * @param {Record<string, unknown>} enriched
 * @param {{
 *   parchearCeldasTrasMutacion: (refs: unknown[], opts?: Record<string, unknown>) => Promise<unknown[]>;
 * }} deps
 */
export function iniciarFasePostCicloAplicarCambio(enriched, deps) {
  void (async () => {
    try {
      await refrescarAnaliticaFichadaDiasTrasOp(enriched);
      const refs = paresCeldaDesdeOp(enriched).map((p) => ({
        persona_id: p.persona_id,
        fecha_ymd: p.fecha_ymd,
        gdt: p.gdt,
      }));
      if (refs.length) {
        await deps.parchearCeldasTrasMutacion(refs, { reemplazoTeoriaCompleto: true });
      }
    } catch {
      /* POST no bloquea la grilla */
    }
  })();
}
