import PlanTurnoServicioPage from "../jefe/PlanTurnoServicioPage.jsx";
import {
  PLANES_TURNO_SHELL,
  resolvePlanesTurnoCapabilities,
} from "../../features/planes/planesTurnoCapabilities.js";

/**
 * Turnos mensuales — shell RRHH (catálogo sector, permisos institucionales).
 * Ruta: /portal/rrhh/planes-turno
 */
export default function PlanTurnoServicioRrhhPage() {
  return (
    <PlanTurnoServicioPage
      capabilities={resolvePlanesTurnoCapabilities(PLANES_TURNO_SHELL.RRHH)}
    />
  );
}
