import { Link } from "react-router-dom";

import {
  ALTA_ONBOARDING_STEPS,
  buildAltaOnboardingHref,
} from "./evalAltaOnboardingPasos.js";

const ESTADO_UI = {
  ok: {
    label: "Listo",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  pendiente: {
    label: "Pendiente",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  bloqueado: {
    label: "Bloqueado",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};

/**
 * @param {{
 *   personaId: string,
 *   loading?: boolean,
 *   error?: Error | null,
 *   estado: Record<string, 'pendiente' | 'ok' | 'bloqueado'>,
 *   pasosCompletos?: boolean,
 *   hlcCount?: number,
 *   checkinCerrado?: boolean,
 *   anioA?: unknown,
 *   onRefresh?: () => void,
 * }} props
 */
export function AltaOnboardingTracker({
  personaId,
  loading,
  error,
  estado,
  pasosCompletos,
  hlcCount,
  checkinCerrado,
  anioA,
  onRefresh,
}) {
  const per = String(personaId || "").trim();
  const tienePersona = /^per_/i.test(per);

  if (!tienePersona) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        Elegí un agente para ver el progreso de alta (cáscara → laboral → check-in de saldos).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Orden recomendado: pre-alta → HLc/HLg en laboral → check-in y cierre global.
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar estado"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          No se pudo cargar el estado: {error.message}
        </p>
      ) : null}

      {pasosCompletos ? (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Alta operativa completa para este agente (cáscara, laboral y check-in cerrado
          {anioA != null && anioA !== "" ? ` · año A ${String(anioA)}` : ""}).
        </p>
      ) : null}

      <ul className="space-y-3">
        {ALTA_ONBOARDING_STEPS.map((step) => {
          const stepEstado = estado[step.id] || "bloqueado";
          const ui = ESTADO_UI[stepEstado] || ESTADO_UI.bloqueado;
          const href = buildAltaOnboardingHref(step.path, per);
          const accionDisabled = stepEstado === "bloqueado";

          let detalle = step.descripcion;
          if (step.id === "laboral" && typeof hlcCount === "number") {
            detalle = `${step.descripcion} HLc operativos: ${hlcCount}.`;
          }
          if (step.id === "checkin") {
            detalle = checkinCerrado
              ? "Check-in global cerrado en portal."
              : `${step.descripcion}${stepEstado === "bloqueado" ? " (requiere HLc vigente)." : ""}`;
          }

          return (
            <li
              key={step.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Paso {step.numero}
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold text-slate-900">{step.titulo}</h3>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ui.className}`}
                >
                  {ui.label}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{detalle}</p>
              {accionDisabled ? (
                <p className="mt-3 text-xs text-slate-500">Completá el paso anterior para habilitar.</p>
              ) : (
                <Link
                  to={href}
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white touch-manipulation hover:bg-blue-700"
                >
                  {step.accionLabel} →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
