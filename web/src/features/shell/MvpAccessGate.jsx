import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import PublicAuthMenu from "../../components/layout/PublicAuthMenu.jsx";
import { ESTADO_PEND_ONBOARDING, subscribePersonaById } from "../../services/personaService.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useSyncAuthEmailConfirmado } from "../auth/useSyncAuthEmailConfirmado.js";
import { hasAnyPortalRole, MANAGEMENT_PORTAL_ROLES } from "../routing/portalRole.js";
import runtimeFlags from "../../../../shared/runtimeFlags.json";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

const PUBLIC_NO_PERSONA = new Set(["/vinculacion", "/registro", "/login"]);

const MSG_SIN_CADENA_LABORAL =
  "No tenés un legajo laboral activo completo (asignación HLc → puesto HLd → grupo HLg) con vigencia a hoy. " +
  "Solicitá a Recursos Humanos la carga o la corrección, o abrí Datos laborales si tu rol lo permite.";

/**
 * Bloquea solo si el token ya trae `cargo_activo: false` (p. ej. tras syncSessionClaims).
 * Tokens sin la clave siguen circulando hasta el próximo sync (migración suave).
 * @param {Record<string, unknown> | null | undefined} claims
 */
function shouldBlockMissingLaborChain(claims) {
  if (!claims || typeof claims !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(claims, "cargo_activo")) return false;
  return claims.cargo_activo !== true;
}

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

  useSyncAuthEmailConfirmado({
    user,
    personaId: pid,
    disabled: OPEN_ACCESS_TEMP || BYPASS_AUTH,
  });

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
    /** RRHH/admin puede operar sin legajo `persona_id` en el token (solo claims de rol). El portal de gestión sigue bajo `/portal/*`. */
    if (
      hasAnyPortalRole(claims, MANAGEMENT_PORTAL_ROLES) &&
      location.pathname.startsWith("/portal")
    ) {
      return children;
    }
    /** Datos laborales: el formulario elige `persona_id`; hace falta sesión Auth aunque el token aún no tenga vínculo DNI→persona. */
    if (location.pathname.startsWith("/portal/laboral")) {
      return children;
    }
    return <Navigate to="/vinculacion" replace state={{ from: location.pathname }} />;
  }

  const isMgmt = hasAnyPortalRole(claims, MANAGEMENT_PORTAL_ROLES);
  if (!isMgmt && shouldBlockMissingLaborChain(claims)) {
    const p0 = /** @type {Record<string, unknown> | null} */ (effectivePersona);
    const pendiente = p0 && p0.estado === ESTADO_PEND_ONBOARDING;
    const onOnboarding =
      location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");
    if (onOnboarding && (!p0 || pendiente)) {
      return children;
    }
    const onLaboral = location.pathname.includes("/portal/laboral");
    if (onLaboral) {
      return children;
    }
    return (
      <div className="flex min-h-dvh w-full flex-col bg-slate-100">
        <PublicAuthMenu active="none" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="max-w-md text-sm text-slate-700">{MSG_SIN_CADENA_LABORAL}</p>
          <p className="text-xs text-slate-500">
            Tras corregir datos, ejecutá &quot;syncSessionClaims&quot; o cerrá sesión y volvé a entrar para actualizar el token.
          </p>
        </div>
      </div>
    );
  }

  const p = /** @type {Record<string, unknown> | null} */ (effectivePersona);
  if (p && p.estado === ESTADO_PEND_ONBOARDING) {
    const m = p.metadata;
    if (m && /** @type {{ auth_vinculado?: boolean }} */ (m).auth_vinculado) {
      const onOnboarding =
        location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");
      if (!onOnboarding) {
        return <Navigate to="/onboarding" replace />;
      }
    }
  }

  return children;
}
