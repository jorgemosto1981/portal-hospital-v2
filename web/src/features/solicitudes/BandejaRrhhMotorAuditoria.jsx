import LaoAuditoriaDisplay from "../lao/LaoAuditoriaDisplay.jsx";
import { esSnapshotMotorV2, snapshotTieneAdvertencias } from "../lao/laoAuditoriaDisplayUtils.js";
import { formatInstanteBandeja } from "./bandejaSolicitudesFormat.js";

/**
 * Bloque de auditoría motor LAO en bandeja RRHH (snapshot inmutable).
 * @param {{
 *   snapshot?: Record<string, unknown> | null,
 *   motorValidadoEn?: unknown,
 *   onIrANotas?: () => void,
 * }} props
 */
export default function BandejaRrhhMotorAuditoria({ snapshot = null, motorValidadoEn = null, onIrANotas }) {
  if (!esSnapshotMotorV2(snapshot)) return null;

  const conAdvertencias = snapshotTieneAdvertencias(snapshot);
  const validadoLabel = formatInstanteBandeja(motorValidadoEn);

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
            Veredicto del motor (congelado)
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Snapshot al alta del trámite — no se recalcula en bandeja.
          </p>
          {validadoLabel ? (
            <p className="mt-1 text-[10px] text-slate-500">Validado: {validadoLabel}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-900">
          Inmutable
        </span>
      </div>

      {conAdvertencias && typeof onIrANotas === "function" ? (
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

      <LaoAuditoriaDisplay snapshot={snapshot} compacto={false} variant="rrhh" />
    </div>
  );
}
