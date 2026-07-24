import Card from "../../components/ui/Card.jsx";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import PlantelPorGdtPanel from "../../features/plantel/PlantelPorGdtPanel.jsx";
import { claimsIncludeJefe, claimsIncludeRrhh } from "../../features/routing/portalRole.js";

/**
 * Plantel / estructura por GDT — jefatura (rama acotada).
 * Ruta: /portal/jefe/plantel
 * Temporal ("Cosas del jefe"): RRHH también puede operar esta shell.
 */
export default function PlantelJefePage() {
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
    <PlantelPorGdtPanel
      modo="jefe"
      titulo="Plantel de mi rama"
      subtitulo="Solo tu GDT vigente y subgrupos descendientes. El detalle de integrantes se autoriza en servidor."
    />
  );
}
