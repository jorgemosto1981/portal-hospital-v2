import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useConcurrentSessionWarning } from "../../features/auth/useConcurrentSessionWarning.js";
import { secureSignOut } from "../../features/auth/secureSignOut.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";

/**
 * Cabecera de marca: logo institucional + título del sistema (móvil y escritorio).
 * Con sesión activa: acción global "Cerrar sesión" → signOut + /login.
 */
export default function AppBrandHeader() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const personaId = typeof claims?.persona_id === "string" ? claims.persona_id.trim() : "";
  const { showWarning, dismissWarning, lastLoginLabel } = useConcurrentSessionWarning({ user, personaId });
  const nav = useNavigate();
  const [signOutBusy, setSignOutBusy] = useState(false);

  async function handleSignOut() {
    if (!user) return;
    setSignOutBusy(true);
    try {
      await secureSignOut({ navigate: nav, reason: "logout" });
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo cerrar sesión.";
      toast.error(m);
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 w-full min-w-0 max-w-full shrink-0 overflow-x-hidden border-b border-slate-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 md:px-5">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-2 px-3 md:h-auto md:min-h-14 md:gap-3 md:px-4 md:py-2 lg:max-w-6xl">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <img
            src={LOGO_SRC}
            alt={INSTITUTION_NAME}
            className="h-8 w-auto max-w-[5.5rem] shrink-0 object-contain md:h-10 md:max-w-[10rem]"
            loading="eager"
            decoding="async"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900 md:text-lg">
              {APP_TITLE}
            </p>
            <p className="hidden truncate text-xs font-medium text-slate-500 md:block">{INSTITUTION_NAME}</p>
            {user && lastLoginLabel ? (
              <p className="hidden text-[11px] text-slate-500 md:block">Ultimo acceso: {lastLoginLabel}</p>
            ) : null}
          </div>
        </div>
        {user ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signOutBusy}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-50 touch-manipulation md:rounded-xl md:px-4 md:py-2 md:text-sm"
          >
            {signOutBusy ? "Cerrando…" : "Salir"}
          </button>
        ) : null}
      </div>
      {user && showWarning ? (
        <div className="mx-auto w-full max-w-5xl rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 md:mt-2 md:px-3 md:py-2 md:text-xs lg:max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              Advertencia de seguridad: detectamos otra sesion activa recientemente para esta cuenta. Si no reconoces la actividad, cambia tu contrasena/PIN.
            </p>
            <button
              type="button"
              onClick={dismissWarning}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
