import { Link, Outlet, useLocation } from "react-router-dom";

import { TICKETERA } from "./ticketeraUi.js";

/**
 * Contenedor ticketera — rutas hijas: hub, Patrón B (con artículo), LAO.
 */
export default function TicketeraShell() {
  const location = useLocation();
  const enHub =
    location.pathname === "/portal/solicitudes" || location.pathname === "/portal/solicitudes/";

  return (
    <div className={TICKETERA.pageWrap}>
      {!enHub ? (
        <Link to="/portal/solicitudes" className={`mb-4 ${TICKETERA.linkBack}`}>
          ← Volver a solicitudes
        </Link>
      ) : null}
      {enHub ? (
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Solicitudes</h1>
          <p className={TICKETERA.hubIntro}>Elegí el tipo de licencia y completá el trámite.</p>
        </header>
      ) : null}
      <div className={enHub ? "" : "mt-2"}>
        <Outlet />
      </div>
    </div>
  );
}
