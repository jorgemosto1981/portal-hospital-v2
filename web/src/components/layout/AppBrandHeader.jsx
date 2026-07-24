import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { APP_TITLE, INSTITUTION_NAME, LOGO_SRC } from "../../constants/appBrand.js";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useConcurrentSessionWarning } from "../../features/auth/useConcurrentSessionWarning.js";
import { secureSignOut } from "../../features/auth/secureSignOut.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { subscribePersonaById } from "../../services/personaService.js";

/**
 * @param {Record<string, unknown> | null | undefined} persona
 * @param {Record<string, unknown> | null | undefined} claims
 */
function resolveUsuarioLabel(persona, claims) {
  const fromPersona = [persona?.apellido, persona?.nombre]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
  if (fromPersona) return fromPersona;
  const fromClaims = String(claims?.nombre_completo || claims?.display_name || "").trim();
  if (fromClaims) return fromClaims;
  return "";
}

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
  const [persona, setPersona] = useState(/** @type {Record<string, unknown> | null} */ (null));

  useEffect(() => {
    if (!user || !personaId) {
      setPersona(null);
      return undefined;
    }
    return subscribePersonaById(personaId, setPersona);
  }, [user, personaId]);

  const usuarioLabel = useMemo(() => resolveUsuarioLabel(persona, claims), [persona, claims]);

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
      <div className="mx-auto flex min-h-12 max-w-5xl items-center justify-between gap-2 px-3 py-1.5 md:min-h-14 md:gap-3 md:px-4 md:py-2 lg:max-w-6xl">
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
            {/* Móvil: identidad bajo la marca. Escritorio: va junto a Salir. */}
            {user && usuarioLabel ? (
              <p className="truncate text-[11px] font-semibold text-slate-700 md:hidden" title={usuarioLabel}>
                {usuarioLabel}
              </p>
            ) : null}
          </div>
        </div>
        {user ? (
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {(usuarioLabel || lastLoginLabel) ? (
              <div className="hidden min-w-0 max-w-[16rem] text-right leading-tight md:block lg:max-w-xs">
                {usuarioLabel ? (
                  <p className="truncate text-xs font-semibold text-slate-800" title={usuarioLabel}>
                    {usuarioLabel}
                  </p>
                ) : null}
                {lastLoginLabel ? (
                  <p
                    className="truncate text-[11px] text-slate-500"
                    title={`Acceso anterior a esta sesión: ${lastLoginLabel}`}
                  >
                    Acceso anterior: {lastLoginLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signOutBusy}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-50 touch-manipulation md:rounded-xl md:px-4 md:py-2 md:text-sm"
            >
              {signOutBusy ? "Cerrando…" : "Salir"}
            </button>
          </div>
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
