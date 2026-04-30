import { DevCallablesPanel } from "./components/DevCallablesPanel.jsx";
import { StatusSection } from "./components/StatusSection.jsx";
import { usePortalHome } from "./hooks/usePortalHome.js";
import { Link } from "react-router-dom";

export default function PortalHome() {
  const p = usePortalHome();
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-6 sm:px-5 sm:py-8 md:max-w-5xl md:px-6 lg:max-w-6xl lg:px-8">
      <h1 className="text-xl font-semibold leading-snug tracking-tight text-slate-900 md:text-2xl">
        Inicio
      </h1>
      <p className="mb-5 mt-1 text-base leading-relaxed text-slate-600 sm:mb-6 md:mb-6">
        Resumen de conexión y diagnóstico técnico (Firebase en la raíz del repo).
      </p>
      <div className="mb-4">
        <Link
          to="/pantallas"
          className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Ver todas las pantallas
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 md:min-h-0">
      <StatusSection
        projectId={p.projectId}
        authAppName={p.authAppName}
        user={p.user}
        userPending={p.userPending}
        firestoreOp={p.firestoreOp}
      />
        </div>
        <div className="min-w-0 md:col-span-1 lg:col-span-2">
      <DevCallablesPanel
        callableOp={p.callableOp}
        callableMsg={p.callableMsg}
        callableBusy={p.callableBusy}
        onHealth={p.runHealth}
        onSync={p.runSyncClaims}
        hasUser={!!p.user}
      />
        </div>
      </div>
    </div>
  );
}
