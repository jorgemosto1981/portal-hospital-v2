import { useCallback, useEffect, useState } from "react";

import LaoAuditoriaDisplay from "../lao/LaoAuditoriaDisplay.jsx";
import { formatInstanteBandeja } from "./bandejaSolicitudesFormat.js";

/**
 * Veredicto del motor LAO en bandeja RRHH (snapshot inmutable), plegado.
 *
 * El snapshot no viaja en el listado: se pide al abrir. La advertencia sí queda
 * a la vista siempre, porque es justamente el motivo para abrirlo.
 *
 * @param {{
 *   tieneVeredicto?: boolean,
 *   tieneAdvertencias?: boolean,
 *   snapshot?: Record<string, unknown> | null,
 *   validadoEn?: unknown,
 *   cargando?: boolean,
 *   error?: string,
 *   pedido?: boolean,
 *   onCargar?: () => void,
 *   onIrANotas?: () => void,
 * }} props
 */
export default function BandejaRrhhMotorAuditoria({
  tieneVeredicto = false,
  tieneAdvertencias = false,
  snapshot = null,
  validadoEn = null,
  cargando = false,
  error = "",
  pedido = false,
  onCargar,
  onIrANotas,
}) {
  const [abierto, setAbierto] = useState(false);

  // La carga va en un efecto: pedirla desde el updater de `setAbierto` actualiza
  // al padre mientras el hijo todavía está renderizando.
  useEffect(() => {
    if (abierto && !pedido) onCargar?.();
  }, [abierto, pedido, onCargar]);

  const toggle = useCallback(() => {
    setAbierto((prev) => !prev);
  }, []);

  if (!tieneVeredicto) return null;

  const validadoLabel = formatInstanteBandeja(validadoEn);

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-white p-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={abierto}
        className="flex min-h-[44px] w-full touch-manipulation items-center justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-violet-800">
            Veredicto del motor (congelado)
          </span>
          <span className="mt-0.5 block text-xs text-slate-600">
            Snapshot al alta del trámite — no se recalcula en bandeja.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {tieneAdvertencias ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
              Advertencias
            </span>
          ) : null}
          <span aria-hidden="true" className="text-slate-500">
            {abierto ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {tieneAdvertencias && typeof onIrANotas === "function" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950">
          <p className="font-medium">El motor registró advertencias normativas.</p>
          <p className="mt-1 text-xs">
            Si RRHH autoriza una excepción, documentala en las notas antes de aprobar o rechazar.
          </p>
          <button
            type="button"
            onClick={onIrANotas}
            className="mt-2 min-h-11 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 active:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Ir a notas de RRHH
          </button>
        </div>
      ) : null}

      {abierto ? (
        <>
          {cargando ? (
            <p className="text-sm text-slate-600" role="status">
              Cargando el veredicto del motor…
            </p>
          ) : null}

          {error ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              <p>{error}</p>
              <button
                type="button"
                onClick={onCargar}
                className="min-h-11 touch-manipulation rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 active:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {!cargando && !error && snapshot ? (
            <>
              {validadoLabel ? (
                <p className="text-[10px] text-slate-500">Validado: {validadoLabel}</p>
              ) : null}
              <LaoAuditoriaDisplay snapshot={snapshot} compacto={false} variant="rrhh" />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
