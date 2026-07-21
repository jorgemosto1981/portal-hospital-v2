import { Navigate } from "react-router-dom";

/**
 * Legacy: la pre-alta vive en el hub «Alta nuevo usuario».
 * Conservamos la ruta para bookmarks y deep-links antiguos.
 */
export default function AltaAgenteRRHH() {
  return <Navigate to="/portal/rrhh/alta-agente" replace />;
}
