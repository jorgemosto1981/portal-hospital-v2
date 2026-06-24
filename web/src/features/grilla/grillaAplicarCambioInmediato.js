import toast from "react-hot-toast";

import { laboralCallableErrorMessage } from "../../pages/datos-laborales/callableErrorMessage.js";
import { aplicarBatchAsistencia } from "../../services/coberturaParcialService.js";
import { MENSAJE_BATCH_LIM_001 } from "./grillaBypassTopeMovimientos.js";

/**
 * Aplica una operación de gestión de turno al servidor (batch de 1 op):
 * overrides, rematerialización de días y recálculo de analítica/fichadas.
 *
 * @param {Record<string, unknown>} op — contrato outbox (reemplazo, cobertura, adicional)
 * @param {{
 *   editorPersonaId?: string;
 *   periodo?: string;
 *   bypassTopeMovimientos?: boolean;
 *   motivoBypassTope?: string;
 * }} ctx
 */
export async function aplicarCambioGrillaInmediato(op, ctx = {}) {
  const result = await aplicarBatchAsistencia([op], {
    editorPersonaId: ctx.editorPersonaId,
    periodo: ctx.periodo,
    bypassTopeMovimientos: ctx.bypassTopeMovimientos,
    motivoBypassTope: ctx.motivoBypassTope,
  });
  return result;
}

/**
 * @param {unknown} e
 * @param {{ onConcurrencia?: () => void | Promise<void> }} [opts]
 * @returns {boolean} true si el error fue manejado con toast
 */
export function toastErrorAplicarCambioGrilla(e, opts = {}) {
  const msg = laboralCallableErrorMessage(e, "No se pudo aplicar el cambio.");
  if (msg.includes("ASI-CONC")) {
    toast.error("La grilla cambió. Recargá e intentá de nuevo.");
    void opts.onConcurrencia?.();
    return true;
  }
  if (msg.includes("ASI-GSO")) {
    toast.error("Mes anterior en solo lectura. No se pueden aplicar cambios.");
    return true;
  }
  if (msg.includes("ASI-PER")) {
    toast.error("Período cerrado.");
    return true;
  }
  if (msg.includes("BATCH-A005")) {
    toast.error("Falta la versión del día destino. Abrí de nuevo el modal y reintentá.");
    return true;
  }
  if (msg.includes("BATCH-020") || msg.includes("unimplemented")) {
    toast.error("Ese tipo de cambio aún no está en el servidor.");
    return true;
  }
  if (msg.includes("BATCH-LIM-001")) {
    toast.error(MENSAJE_BATCH_LIM_001);
    return true;
  }
  if (msg.includes("BATCH-LIM-002")) {
    toast.error("Motivo de excepción RRHH requerido (mín. 3 caracteres).");
    return true;
  }
  if (msg.includes("BATCH-LIM-003")) {
    toast.error("Solo RRHH puede autorizar excepciones al tope de movimientos.");
    return true;
  }
  if (/\[BATCH-/i.test(msg)) {
    toast.error(msg.replace(/^\[[^\]]+\]\s*/i, ""));
    return true;
  }
  toast.error(msg);
  return true;
}
