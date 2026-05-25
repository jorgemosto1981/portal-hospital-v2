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
const POST_LOGIN_LOADER_FLAG = "portal_post_login_loading_v1";
const POST_LOGIN_LOADER_MIN_MS = 1000;

function readPostLoginLoaderStartedAt() {
  if (typeof window === "undefined") return 0;
  let raw = "";
  try {
    raw = window.sessionStorage.getItem(POST_LOGIN_LOADER_FLAG) || "";
  } catch {
    return 0;
  }
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.enabled === true && Number.isFinite(Number(parsed.startedAt))) {
      return Number(parsed.startedAt);
    }
  } catch {
    // Compatibilidad con versión previa del flag.
    if (raw === "1") return Date.now();
  }
  return 0;
}

function clearPostLoginLoaderFlag() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(POST_LOGIN_LOADER_FLAG);
  } catch {
    // No-op: el flag es opcional.
  }
}

const PUBLIC_NO_PERSONA = new Set(["/vinculacion", "/registro", "/login"]);

const MSG_SIN_CADENA_LABORAL =
  "No tenés un legajo laboral activo completo (asignación HLc → puesto HLd → grupo HLg) con vigencia a hoy. " +
  "Solicitá a Recursos Humanos la carga o la corrección, o abrí Datos laborales si tu rol lo permite.";

function PostLoginPortalLoader({ label }) {
  const loadingSteps = [
    "Validando sesión",
    "Cargando permisos",
    "Sincronizando datos iniciales",
  ];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 1200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/90 px-6 py-7 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <span className="h-6 w-6 animate-pulse rounded-full bg-blue-600/80" aria-hidden />
        </div>
        <p className="text-base font-semibold text-slate-900">Cargando Portal Digital...</p>
        <p className="mt-1 text-sm text-slate-600">{label}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span
            className="inline-block size-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
            aria-hidden
          />
          <span>{loadingSteps[stepIndex]}...</span>
        </div>
      </div>
    </div>
  );
}

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
  const [postLoginLoaderStartedAt] = useState(readPostLoginLoaderStartedAt);
  const [showPostLoginLoader, setShowPostLoginLoader] = useState(postLoginLoaderStartedAt > 0);
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

  useEffect(() => {
    if (!showPostLoginLoader) return;
    if (authPending || claimsLoading) return;
    const elapsed = Math.max(0, Date.now() - Number(postLoginLoaderStartedAt || 0));
    const waitMs = Math.max(0, POST_LOGIN_LOADER_MIN_MS - elapsed);
    const timer = window.setTimeout(() => {
      clearPostLoginLoaderFlag();
      setShowPostLoginLoader(false);
    }, waitMs);
    return () => window.clearTimeout(timer);
  }, [showPostLoginLoader, authPending, claimsLoading, postLoginLoaderStartedAt]);

  if (OPEN_ACCESS_TEMP || BYPASS_AUTH) {
    return children;
  }
  if (authPending) {
    if (showPostLoginLoader) {
      return (
        <div className="flex min-h-dvh w-full flex-col bg-slate-100">
          <PublicAuthMenu active="none" />
          <PostLoginPortalLoader label="Estamos preparando tu espacio de trabajo" />
        </div>
      );
    }
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
    if (showPostLoginLoader) {
      return (
        <div className="flex min-h-dvh w-full flex-col bg-slate-100">
          <PublicAuthMenu active="none" />
          <PostLoginPortalLoader label="Sincronizando permisos del portal" />
        </div>
      );
    }
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
