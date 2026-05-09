import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthSession } from "../auth/useAuthSession.js";
import { useAuthClaims } from "../auth/useAuthClaims.js";
import { hasAnyPortalRole, MANAGEMENT_PORTAL_ROLES } from "./portalRole.js";
import { safeRedirectPath } from "./redirectPaths.js";
import runtimeFlags from "../../../../shared/runtimeFlags.json";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

const GATE_SPINNER_LOADING_STEPS = [
  "Validando sesión",
  "Cargando permisos",
  "Sincronizando datos iniciales",
];

export function GateSpinner({ label = "Cargando…" }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const n = GATE_SPINNER_LOADING_STEPS.length;
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % n);
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
          <span>{GATE_SPINNER_LOADING_STEPS[stepIndex]}...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Rutas públicas (login): si ya hay sesión, no mostrar el formulario.
 * @param {{ children: import("react").ReactNode }} p
 */
export function PublicRoute({ children }) {
  const { user, authPending } = useAuthSession();
  const location = useLocation();
  if (OPEN_ACCESS_TEMP || BYPASS_AUTH) {
    return children;
  }
  if (authPending) {
    return <GateSpinner />;
  }
  if (user) {
    const qs = new URLSearchParams(location.search);
    return <Navigate to={safeRedirectPath(qs.get("redirect"))} replace />;
  }
  return children;
}

/**
 * Requiere usuario de Firebase Auth (salvo bypass / open access).
 * @param {{ children: import("react").ReactNode }} p
 */
export function ProtectedRoute({ children }) {
  const { user, authPending } = useAuthSession();
  const location = useLocation();
  if (OPEN_ACCESS_TEMP || BYPASS_AUTH) {
    return children;
  }
  if (authPending) {
    return <GateSpinner label="Validando sesión…" />;
  }
  if (!user) {
    const pathWithQuery = `${location.pathname || "/portal/home"}${location.search || ""}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(pathWithQuery)}`} replace />;
  }
  return children;
}

/**
 * @param {{ roles?: readonly string[]; children?: import("react").ReactNode }} p
 */
export function RoleGuard({ roles = MANAGEMENT_PORTAL_ROLES, children }) {
  const { user, authPending } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);
  const allowed = roles.length ? roles : MANAGEMENT_PORTAL_ROLES;

  if (OPEN_ACCESS_TEMP || BYPASS_AUTH) {
    return children ?? <Outlet />;
  }
  if (authPending || claimsLoading) {
    return <GateSpinner label="Validando permisos…" />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!hasAnyPortalRole(claims, allowed)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          No tenés permiso para acceder a esta sección. Se requiere uno de los roles:{" "}
          <span className="font-mono">{allowed.join(", ")}</span>.
        </div>
      </div>
    );
  }
  return children ?? <Outlet />;
}
