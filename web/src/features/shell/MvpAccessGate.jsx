import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import PublicAuthMenu from "../../components/layout/PublicAuthMenu.jsx";
import { ESTADO_PEND_ONBOARDING, subscribePersonaById } from "../../services/personaService.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { useAuthClaims } from "../auth/useAuthClaims.js";
import runtimeFlags from "../../../../shared/runtimeFlags.json";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

const PUBLIC_NO_PERSONA = new Set(["/vinculacion", "/registro"]);

/**
 * Pivote MVP: exige vinculación (claim `persona_id`) y bloquea en el wizard mientras el legajo
 * siga en PENDIENTE_ONBOARDING con ficha vinculada.
 * @param {{ children: import("react").ReactNode }} p
 */
export default function MvpAccessGate({ children }) {
  const { user, authPending } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const location = useLocation();
  const [persona, setPersona] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const pid = typeof claims?.persona_id === "string" ? /** @type {string} */ (claims.persona_id) : null;
  const effectivePersona = pid ? persona : null;

  useEffect(() => {
    if (!pid) {
      return;
    }
    return subscribePersonaById(pid, setPersona);
  }, [pid]);

  if (OPEN_ACCESS_TEMP || BYPASS_AUTH) {
    return children;
  }
  if (authPending) {
    return (
      <div className="flex min-h-dvh w-full flex-col bg-slate-100">
        <PublicAuthMenu active="none" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-slate-600">
          <span
            className="inline-block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
            aria-hidden
          />
          <p className="text-sm">Cargando…</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return children;
  }
  if (claimsLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-sm text-slate-500">
        Sincronizando permisos…
      </div>
    );
  }
  if (!pid) {
    if (PUBLIC_NO_PERSONA.has(location.pathname)) {
      return children;
    }
    return <Navigate to="/vinculacion" replace state={{ from: location.pathname }} />;
  }

  const p = /** @type {Record<string, unknown> | null} */ (effectivePersona);
  if (p && p.estado === ESTADO_PEND_ONBOARDING) {
    const m = p.metadata;
    if (m && /** @type {{ auth_vinculado?: boolean }} */ (m).auth_vinculado) {
      if (location.pathname !== "/onboarding" && !location.pathname.startsWith("/onboarding/")) {
        return <Navigate to="/onboarding" replace />;
      }
    }
  }

  return children;
}
