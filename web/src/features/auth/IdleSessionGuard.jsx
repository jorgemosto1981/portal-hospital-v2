import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { secureSignOut } from "./secureSignOut.js";
import { useAuthSession } from "./useAuthSession.js";

/** Tiempo máximo sin actividad antes de cerrar sesión (toda la app V2). */
export const IDLE_SESSION_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click", "wheel"];

const MOUSEMOVE_THROTTLE_MS = 1000;

/**
 * Cierra la sesión Firebase si no hay interacción con la ventana durante {@link IDLE_SESSION_MS}.
 * No renderiza UI; debe montarse dentro de `BrowserRouter`.
 */
export default function IdleSessionGuard() {
  const navigate = useNavigate();
  const { user } = useAuthSession();

  useEffect(() => {
    if (!user) return undefined;

    let timeoutId = /** @type {ReturnType<typeof setTimeout> | null} */ (null);

    const logout = async () => {
      await secureSignOut({ navigate, reason: "inactividad" });
    };

    const resetTimer = () => {
      if (timeoutId != null) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(logout, IDLE_SESSION_MS);
    };

    let lastMoveTs = 0;
    const onMouseMove = () => {
      const now = Date.now();
      if (now - lastMoveTs < MOUSEMOVE_THROTTLE_MS) return;
      lastMoveTs = now;
      resetTimer();
    };

    const onActivity = () => resetTimer();

    resetTimer();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      if (timeoutId != null) clearTimeout(timeoutId);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [user, navigate]);

  return null;
}
