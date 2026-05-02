import { signOut } from "firebase/auth";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

import { DevCallablesPanel } from "./components/DevCallablesPanel.jsx";
import { StatusSection } from "./components/StatusSection.jsx";
import { usePortalHome } from "./hooks/usePortalHome.js";
import Card from "../../components/ui/Card.jsx";
import { authV2 } from "../../services/firebase.js";

export default function PortalHome() {
  const p = usePortalHome();
  const nav = useNavigate();
  const [logoutBusy, setLogoutBusy] = useState(false);

  const copyPrimerAccesoUrl = useCallback(async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/login?alta=1` : "/login?alta=1";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado. Podés enviarlo por mail o chat al agente.");
    } catch {
      toast.error("No se pudo copiar. Copiá manualmente el texto de abajo.");
    }
  }, []);

  const logoutYLogin = useCallback(async () => {
    setLogoutBusy(true);
    try {
      await signOut(authV2);
    } catch {
      /* ignore */
    }
    setLogoutBusy(false);
    nav("/login", { replace: true });
  }, [nav]);

  const haySesion = Boolean(p.user);

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-6 sm:px-5 sm:py-8 md:max-w-5xl md:px-6 lg:max-w-6xl lg:px-8">
      <h1 className="text-xl font-semibold leading-snug tracking-tight text-slate-900 md:text-2xl">
        Inicio
      </h1>
      <p className="mb-5 mt-1 text-base leading-relaxed text-slate-600 sm:mb-6 md:mb-6">
        Resumen de conexión y diagnóstico técnico (Firebase en la raíz del repo).
      </p>
      <Card className="mb-5 border-slate-200/80 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold text-slate-900">Acceso al portal</p>
        {haySesion ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Ya tenés sesión iniciada. Los enlaces a <span className="font-mono">/login</span> no cambian de pantalla
              porque el portal te devuelve acá. Para <strong>probar el login</strong> cerrá sesión abajo. Para{" "}
              <strong>agentes nuevos</strong>, copiá el enlace de primer acceso y compartilo.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={copyPrimerAccesoUrl}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Copiar enlace de primer acceso
              </button>
              <button
                type="button"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                onClick={logoutYLogin}
                disabled={logoutBusy}
              >
                {logoutBusy ? "Cerrando…" : "Cerrar sesión e ir al login"}
              </button>
            </div>
            <p className="mt-3 break-all rounded-lg bg-white/80 px-2 py-1.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200/80">
              {typeof window !== "undefined" ? `${window.location.origin}/login?alta=1` : "/login?alta=1"}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Modo sin sesión: abrí el login o el flujo de primer acceso desde acá.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/login?alta=1"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Primer acceso (nuevo agente)
              </Link>
            </div>
          </>
        )}
      </Card>
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
