import { Navigate, useLocation } from "react-router-dom";

export default function RedirectTicketeraAlta() {
  const { search } = useLocation();
  return <Navigate to={`/portal/solicitudes/alta${search}`} replace />;
}
