import { Navigate } from "react-router-dom";

import { GateSpinner } from "../routing/RouteGuards.jsx";
import { useArticulosIngresoMenu } from "./ArticulosIngresoProvider.jsx";

/**
 * Bloquea rutas de alta por artículo si el agente no pasa elegibilidad (filtros + circuito) hoy.
 */
export default function GuardArticuloIngreso({ articuloId, articuloIds, children }) {
  const { loading, puedeSolicitarArticulo } = useArticulosIngresoMenu();

  const ids = Array.isArray(articuloIds) && articuloIds.length > 0
    ? articuloIds
    : articuloId
      ? [articuloId]
      : [];

  if (loading) {
    return <GateSpinner label="Verificando artículos disponibles…" />;
  }
  const permitido = ids.some((id) => puedeSolicitarArticulo(id));
  if (!permitido) {
    return <Navigate to="/portal/home" replace />;
  }
  return children;
}
