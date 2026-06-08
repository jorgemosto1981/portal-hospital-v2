import { Navigate } from "react-router-dom";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeJefe, claimsIncludeRrhh } from "./portalRole.js";
import { GateSpinner } from "./RouteGuards.jsx";

/** Atajo `/portal/grilla` → ruta según rol (RRHH vs jefatura). */
export default function GrillaPortalRedirect() {
  const { user, authPending } = useAuthSession();
  const { claims, claimsLoading } = useAuthClaims(user);

  if (authPending || claimsLoading) {
    return <GateSpinner label="Redirigiendo a grilla…" />;
  }
  if (claimsIncludeRrhh(claims)) {
    return <Navigate to="/portal/rrhh/grilla-operativa" replace />;
  }
  if (claimsIncludeJefe(claims)) {
    return <Navigate to="/portal/jefe/grilla-operativa" replace />;
  }
  return <Navigate to="/portal/home" replace />;
}
