import { useEffect } from "react";

import { callNotificarCambioEmailAuth } from "../../services/callables.js";

/**
 * Tras `verifyBeforeUpdateEmail`, Firebase actualiza el email en Auth al abrir el enlace;
 * Firestore `usuarios_cuenta.username` queda desalineado hasta esta sync.
 * Llama al callable `notificarCambioEmailAuth` con etapa `confirmado` (idempotente en servidor).
 *
 * @param {{ user: import("firebase/auth").User | null; personaId: string | null; disabled?: boolean }} p
 */
export function useSyncAuthEmailConfirmado({ user, personaId, disabled = false }) {
  useEffect(() => {
    if (disabled || !user?.email || !personaId) return;
    const email = String(user.email).trim().toLowerCase();
    let cancelled = false;
    void (async () => {
      try {
        await callNotificarCambioEmailAuth({ etapa: "confirmado", nuevo_email: email });
      } catch {
        // Sin cambio pendiente u otra condición: no bloquear la app.
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [disabled, user?.uid, user?.email, personaId]);
}
