import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import toast from "react-hot-toast";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { authV2 } from "../../services/firebase.js";

/**
 * Cabecera de marca: logo institucional + título del sistema (móvil y escritorio).
 * Con sesión activa: acción global "Cerrar sesión" → signOut + /login.
 */
export default function AppBrandHeader() {
  const { user } = useAuthSession();
  const nav = useNavigate();
  const [signOutBusy, setSignOutBusy] = useState(false);

  async function handleSignOut() {
    if (!user) return;
    setSignOutBusy(true);
    try {
      await signOut(authV2);
      nav("/login", { replace: true });
    } catch (e) {
      const m = e instanceof Error ? e.message : "No se pudo cerrar sesión.";
      toast.error(m);
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 md:px-5">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 lg:max-w-6xl">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={LOGO_SRC}
            alt={INSTITUTION_NAME}
            className="h-10 w-auto max-h-12 max-w-[10rem] shrink-0 object-contain sm:h-11"
            loading="eager"
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug tracking-tight text-slate-900 md:text-lg">
              {APP_TITLE}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{INSTITUTION_NAME}</p>
          </div>
        </div>
        {user ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signOutBusy}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 md:px-4 md:text-sm"
          >
            {signOutBusy ? "Cerrando…" : "Cerrar sesión"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
