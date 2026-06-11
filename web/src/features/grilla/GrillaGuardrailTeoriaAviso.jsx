import { COPY_BADGE_RRHH_BYPASS } from "./grillaGuardrailsTeoriaUi.js";

/**
 * @param {{
 *   muestraBadgeBypassRrhh?: boolean;
 *   mensajeBloqueo?: string | null;
 * }} props
 */
export default function GrillaGuardrailTeoriaAviso({
  muestraBadgeBypassRrhh = false,
  mensajeBloqueo = null,
}) {
  if (!muestraBadgeBypassRrhh && !mensajeBloqueo) return null;

  return (
    <div className="mt-2 space-y-2">
      {muestraBadgeBypassRrhh ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-950">
          {COPY_BADGE_RRHH_BYPASS}
        </p>
      ) : null}
      {mensajeBloqueo ? (
        <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700">
          {mensajeBloqueo}
        </p>
      ) : null}
    </div>
  );
}
