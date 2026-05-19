import { Link, Outlet, useLocation } from "react-router-dom";

/**
 * Contenedor ticketera — rutas hijas: hub, Patrón B, LAO.
 */
export default function TicketeraShell() {
  const location = useLocation();
  const enHub = location.pathname === "/portal/solicitudes" || location.pathname === "/portal/solicitudes/";

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      {!enHub ? (
        <Link
          to="/portal/solicitudes"
          className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          ← Volver a solicitudes
        </Link>
      ) : null}
      {enHub ? (
        <>
          <h1 className="text-xl font-semibold text-slate-900">Solicitudes</h1>
          <p className="mt-1 text-sm text-slate-600">Elegí el tipo de licencia y completá el trámite.</p>
        </>
      ) : null}
      <div className={enHub ? "mt-6" : ""}>
        <Outlet />
      </div>
    </div>
  );
}
