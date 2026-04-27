import { Navigate } from "react-router-dom";

import { useAuthSession } from "./useAuthSession.js";
import LoginScreen from "./LoginScreen.jsx";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

/**
 * Ruta dedicada `/login`: mismo formulario que en `/`, y redirección a inicio si ya hay sesión.
 */
export default function LoginRoute() {
  const { user, authPending } = useAuthSession();

  if (!BYPASS_AUTH && authPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <span
            className="inline-block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
            aria-hidden
          />
          <p className="text-sm">Cargando…</p>
        </div>
      </div>
    );
  }

  if (!BYPASS_AUTH && user) {
    return <Navigate to="/" replace />;
  }

  return <LoginScreen />;
}
