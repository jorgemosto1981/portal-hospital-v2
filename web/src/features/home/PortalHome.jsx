import { DevCallablesPanel } from "./components/DevCallablesPanel.jsx";
import { StatusSection } from "./components/StatusSection.jsx";
import { usePortalHome } from "./hooks/usePortalHome.js";

export default function PortalHome() {
  const p = usePortalHome();
  return (
    <main className="mx-auto w-full max-w-[390px] px-4 py-6 sm:px-5 sm:py-8">
      <h1 className="text-xl font-semibold leading-snug tracking-tight text-slate-900">Portal Hospital V2</h1>
      <p className="mb-5 mt-1 text-base leading-relaxed text-slate-600 sm:mb-6">
        App web · Firebase SDK (raíz del repo).
      </p>
      <StatusSection
        projectId={p.projectId}
        authAppName={p.authAppName}
        user={p.user}
        userPending={p.userPending}
        firestoreMsg={p.firestoreMsg}
      />
      <DevCallablesPanel
        callableMsg={p.callableMsg}
        callableBusy={p.callableBusy}
        rrhh={p.rrhh}
        reg={p.reg}
        onHealth={p.runHealth}
        onSync={p.runSyncClaims}
        onRrhh={p.runRrhhAlta}
        onPasoB={p.runPasoB}
        hasUser={!!p.user}
      />
    </main>
  );
}
