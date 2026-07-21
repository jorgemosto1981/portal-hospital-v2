import Card from "../../components/ui/Card.jsx";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { claimsIncludeJefe, claimsIncludeRrhh } from "../../features/routing/portalRole.js";
import {
  PLANES_TURNO_SHELL,
  resolvePlanesTurnoCapabilities,
} from "../../features/planes/planesTurnoCapabilities.js";
import PlanTurnoServicioPage from "./PlanTurnoServicioPage.jsx";

/**
 * Turnos mensuales — shell jefatura.
 * Ruta: /portal/jefe/planes-turno
 * Temporal ("Cosas del jefe"): RRHH opera esta shell hasta acta de aprobación.
 */
export default function PlanTurnoServicioJefePage() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const puedeOperar = claimsIncludeJefe(claims) || claimsIncludeRrhh(claims);

  if (!puedeOperar) {
    return (
      <Card className="px-4 py-6">
        <p className="text-sm text-slate-700">Sin permisos de jefatura para esta sección.</p>
      </Card>
    );
  }

  return (
    <PlanTurnoServicioPage
      capabilities={resolvePlanesTurnoCapabilities(PLANES_TURNO_SHELL.JEFE)}
    />
  );
}
