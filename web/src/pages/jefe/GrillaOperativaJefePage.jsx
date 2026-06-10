import GrillaMesLicenciasPanel from "../../features/grilla/GrillaMesLicenciasPanel.jsx";
import {
  GRILLA_OPERATIVA_SHELL,
  resolveGrillaOperativaCapabilities,
} from "../../features/grilla/grillaOperativaCapabilities.js";
import Card from "../../components/ui/Card.jsx";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { claimsIncludeJefe } from "../../features/routing/portalRole.js";

/**
 * Grilla operativa GSO para jefatura (titular + equipo).
 * Ruta: /portal/jefe/grilla-operativa
 */
export default function GrillaOperativaJefePage() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esJefe = claimsIncludeJefe(claims);

  if (!esJefe) {
    return (
      <Card className="px-4 py-6">
        <p className="text-sm text-slate-700">Sin permisos de jefatura para esta sección.</p>
      </Card>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Grilla operativa</h1>
      <p className="mt-1 text-sm text-slate-600">
        Calendario propio y vista de equipo por grupo de trabajo. Período mensual GSO (licencias y gestión del día).
      </p>
      <GrillaMesLicenciasPanel
        capabilities={resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.JEFE)}
      />
    </section>
  );
}
