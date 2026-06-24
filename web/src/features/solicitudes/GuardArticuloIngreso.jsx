import { Navigate, useSearchParams } from "react-router-dom";

import { GateSpinner } from "../routing/RouteGuards.jsx";
import { useArticulosIngresoMenu } from "./ArticulosIngresoProvider.jsx";
import { articuloIdDesdeSearchParams } from "./ticketeraRouteUtils.js";

/**
 * Bloquea alta si el artículo en query no está en el catálogo elegible (listarArticulosIngresoAgente).
 */
export default function GuardArticuloIngreso({ children }) {
  const [searchParams] = useSearchParams();
  const { loading, obtenerDatosArticuloElegible } = useArticulosIngresoMenu();

  const articuloId = articuloIdDesdeSearchParams(searchParams);

  if (loading) {
    return <GateSpinner label="Verificando elegibilidad del artículo en catálogo…" />;
  }

  if (!articuloId) {
    return <Navigate to="/portal/solicitudes" replace />;
  }

  const articuloElegible = obtenerDatosArticuloElegible(articuloId);
  if (!articuloElegible) {
    return <Navigate to="/portal/solicitudes?error=ELEG_NO_DISPONIBLE" replace />;
  }

  return children;
}
