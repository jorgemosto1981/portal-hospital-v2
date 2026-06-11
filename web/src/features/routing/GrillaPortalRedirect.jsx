import { Navigate } from "react-router-dom";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { resolveGrillaPortalRedirectPath } from "./portalPerifericoCapabilities.js";
import { GateSpinner } from "./RouteGuards.jsx";

/** Atajo `/portal/grilla` → shell GSO según última visita + gates (sin `claimsIncludeRrhh`). */
export default function GrillaPortalRedirect() {
  const { user, authPending } = useAuthSession();
  const { claims, claimsLoading, hasPortalRoles } = useAuthClaims(user);

  if (authPending || claimsLoading) {
    return <GateSpinner label="Redirigiendo a grilla…" />;
  }

  const destino = resolveGrillaPortalRedirectPath(claims, hasPortalRoles);
  return <Navigate to={destino} replace />;
}
