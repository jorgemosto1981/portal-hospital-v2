import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Compat: redirige al carril Patrón B de la ticketera unificada.
 */
export default function Solicitud64AAlta() {
  const [searchParams] = useSearchParams();
  const fecha = String(searchParams.get("fecha") || "").trim();
  const q = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return <Navigate to={`/portal/solicitudes/patron-b${q}`} replace />;
}
