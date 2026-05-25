import { useEffect, useState } from "react";

import { useAuthSession } from "./useAuthSession.js";
import AccesoPortal from "./AccesoPortal.jsx";
import { clearPostLoginLoaderFlag } from "./postLoginLoader.js";

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const AUTH_INIT_SLOW_MS = 12_000;

/**
 * Ruta `/login`: acceso unificado (sesión + primer registro).
 * No redirigir automáticamente por tener sesión: evita carrera con `syncSessionClaims` en el login;
 * la navegación post-ingreso la dispara `AccesoPortal` tras sync OK (o el usuario usa “Ir al inicio”).
 */
export default function LoginRoute() {
  const { authPending } = useAuthSession();
  const [authSlow, setAuthSlow] = useState(false);

  useEffect(() => {
    clearPostLoginLoaderFlag();
  }, []);

  useEffect(() => {
    if (!authPending) {
      setAuthSlow(false);
      return;
    }
    const t = window.setTimeout(() => setAuthSlow(true), AUTH_INIT_SLOW_MS);
    return () => window.clearTimeout(t);
  }, [authPending]);

  if (!BYPASS_AUTH && authPending) {
    if (authSlow) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
          <div className="max-w-sm rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-900">La sesión tarda en iniciar</p>
            <p className="mt-2 text-sm text-slate-600">
              Si persiste, revisá VPN o firewall (Firebase Auth / Cloud Functions) y recargá.
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <span
            className="inline-block size-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
            aria-hidden
          />
          <p className="text-sm">Cargando…</p>
        </div>
      </div>
    );
  }

  return <AccesoPortal />;
}
