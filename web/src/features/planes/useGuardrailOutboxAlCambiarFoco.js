import { useCallback } from "react";

import {
  COPY_CONFIRMAR_DESCARTE_OUTBOX_AL_CAMBIAR_FOCO,
  debeAdvertirCambioFocoConOutbox,
  resolverFocoOrigenOutbox,
} from "./planRefinamientoConsolaUtils.js";

/**
 * @param {{
 *   ops: Array<Record<string, unknown>>;
 *   clearOutbox: () => void;
 *   focoOrigenExplicito: { grupoId?: string; periodo?: string };
 *   confirmar?: (mensaje: string) => boolean;
 * }} opts
 */
export function useGuardrailOutboxAlCambiarFoco({
  ops,
  clearOutbox,
  focoOrigenExplicito,
  confirmar = (mensaje) => window.confirm(mensaje),
}) {
  const intentarNavegacionFoco = useCallback(
    (focoDestino, onContinuar) => {
      const focoOrigen = resolverFocoOrigenOutbox(focoOrigenExplicito, ops);
      const dest = {
        grupoId: String(focoDestino?.grupoId ?? "").trim(),
        periodo: String(focoDestino?.periodo ?? "").trim(),
      };
      if (debeAdvertirCambioFocoConOutbox(ops, focoOrigen, dest)) {
        if (!confirmar(COPY_CONFIRMAR_DESCARTE_OUTBOX_AL_CAMBIAR_FOCO)) {
          return false;
        }
        clearOutbox();
      }
      onContinuar();
      return true;
    },
    [ops, clearOutbox, focoOrigenExplicito, confirmar],
  );

  return { intentarNavegacionFoco };
}
