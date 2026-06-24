import { Navigate, useSearchParams } from "react-router-dom";

import { useArticulosIngresoMenu } from "../features/solicitudes/ArticulosIngresoProvider.jsx";
import { articuloIdDesdeSearchParams } from "../features/solicitudes/ticketeraRouteUtils.js";
import { WIZARD_BY_PATRON } from "../features/solicitudes/ticketeraWizardRegistry.js";

export default function TicketeraAltaPage() {
  const [searchParams] = useSearchParams();
  const { obtenerDatosArticuloElegible } = useArticulosIngresoMenu();

  const articuloId = articuloIdDesdeSearchParams(searchParams);
  const articuloInfo = articuloId ? obtenerDatosArticuloElegible(articuloId) : null;

  if (!articuloInfo) {
    return <Navigate to="/portal/solicitudes" replace />;
  }

  const ComponenteWizard = WIZARD_BY_PATRON[articuloInfo.patron_saldo];
  if (!ComponenteWizard) {
    return <Navigate to="/portal/solicitudes?error=PATRON_NO_SOPORTADO" replace />;
  }

  return <ComponenteWizard />;
}
