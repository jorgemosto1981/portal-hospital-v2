import { Navigate, useSearchParams } from "react-router-dom";
import { useMemo } from "react";

import { useAuthSession } from "./useAuthSession.js";
import AccesoPortal from "./AccesoPortal.jsx";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";

/** @param {string | null} raw */
function safeRedirectPath(raw) {
  if (!raw || typeof raw !== "string") return "/inicio";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/inicio";
  return t;
}

/**
 * Ruta `/login`: acceso unificado (sesión + primer registro). Si ya hay sesión, redirige a `redirect` o `/inicio`.
 */
export default function LoginRoute() {
  const { user, authPending } = useAuthSession();
  const [searchParams] = useSearchParams();
  const afterLogin = useMemo(() => safeRedirectPath(searchParams.get("redirect")), [searchParams]);

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
    return <Navigate to={afterLogin} replace />;
  }

  return <AccesoPortal />;
}
