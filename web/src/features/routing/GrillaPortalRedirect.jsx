import { Navigate } from "react-router-dom";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { useEtapa1RuntimeOptional } from "../etapa1/Etapa1RuntimeProvider.jsx";
import { resolveGrillaPortalRedirectPath } from "./portalPerifericoCapabilities.js";
import { GateSpinner } from "./RouteGuards.jsx";

/** Atajo `/portal/grilla` → shell GSO según última visita + gates (sin `claimsIncludeRrhh`). */
export default function GrillaPortalRedirect() {
  const { user, authPending } = useAuthSession();
  const { claims, claimsLoading, hasPortalRoles } = useAuthClaims(user);
  const etapa1 = useEtapa1RuntimeOptional();

  if (authPending || claimsLoading) {
    return <GateSpinner label="Redirigiendo a grilla…" />;
  }

  const destino = resolveGrillaPortalRedirectPath(claims, hasPortalRoles, undefined, {
    jefeGsoHabilitado: etapa1?.jefeGsoHabilitado === true,
  });
  return <Navigate to={destino} replace />;
}
