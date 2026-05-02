import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthSession } from "../auth/useAuthSession.js";
import { useAuthClaims } from "../auth/useAuthClaims.js";
import { hasAnyPortalRole, MANAGEMENT_PORTAL_ROLES } from "./portalRole.js";
import { safeRedirectPath } from "./redirectPaths.js";
import runtimeFlags from "../../../../shared/runtimeFlags.json";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const OPEN_ACCESS_TEMP = runtimeFlags.OPEN_ACCESS_TEMP === true;

export function GateSpinner({ label = "Cargando…" }) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-slate-600">
      <span
        className="inline-block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
        aria-hidden
      />
      <p className="text-sm">{label}</p>
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
