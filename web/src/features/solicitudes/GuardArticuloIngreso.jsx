import { Navigate } from "react-router-dom";

import { GateSpinner } from "../routing/RouteGuards.jsx";
import { useArticulosIngresoMenu } from "./ArticulosIngresoProvider.jsx";

/**
 * Bloquea rutas de alta por artículo si el agente no pasa elegibilidad (filtros + circuito) hoy.
 */
export default function GuardArticuloIngreso({ articuloId, children }) {
  const { loading, puedeSolicitarArticulo } = useArticulosIngresoMenu();

  if (loading) {
    return <GateSpinner label="Verificando artículos disponibles…" />;
  }
  if (!puedeSolicitarArticulo(articuloId)) {
    return <Navigate to="/portal/home" replace />;
  }
  return children;
}
