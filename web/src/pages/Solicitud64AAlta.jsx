import { Navigate } from "react-router-dom";

/**
 * Compat: ruta legada → hub de solicitudes (elegir artículo desde ahí).
 */
export default function Solicitud64AAlta() {
  return <Navigate to="/portal/solicitudes" replace />;
}
