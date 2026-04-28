import Card from "../../../components/ui/Card.jsx";
import { formatValue, takeFirst } from "../utils.js";

export default function IntegridadReferencialCard({
  totalAlertasIntegridad,
  hldSinCargo,
  hlcActivosSinGrupo,
  hlgSinDato,
  hlcConGrupoInvalido,
  hlcConEfectorDesignacionInvalido,
  hlcConEfectorCumplimientoInvalido,
}) {
  return (
    <Card className="px-4 py-4 md:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-slate-900">Fase 1 · Paso 4/5 (Integridad referencial)</p>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            totalAlertasIntegridad > 0
              ? "bg-rose-50 text-rose-700 ring-rose-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
          }`}
        >
          {totalAlertasIntegridad > 0
            ? `${totalAlertasIntegridad} alerta(s)`
            : "Sin alertas de integridad"}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Control de cruces entre `hlc_*`, `hld_*`, `hlg_*`, `grupos_de_trabajo` y `cfg_efectores`.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HLd sin HLc (cargo_id)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{hldSinCargo.length}</p>
          {takeFirst(hldSinCargo).map((row) => (
            <p key={row.id} className="mt-1 font-mono text-xs text-slate-600">
              {row.id} {"->"} cargo_id: {formatValue(row.cargo_id)}
            </p>
          ))}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            HLc activos sin grupo asignado (advertencia)
          </p>
          <p className="mt-1 text-xl font-semibold text-amber-800">{hlcActivosSinGrupo.length}</p>
          {takeFirst(hlcActivosSinGrupo).map((row) => (
            <p key={row.id} className="mt-1 font-mono text-xs text-amber-700">
              {row.id} {"->"} persona_id: {formatValue(row.persona_id)}
            </p>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            HLg sin HLd (dato_laboral_id)
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{hlgSinDato.length}</p>
          {takeFirst(hlgSinDato).map((row) => (
            <p key={row.id} className="mt-1 font-mono text-xs text-slate-600">
              {row.id} {"->"} dato_laboral_id: {formatValue(row.dato_laboral_id)}
            </p>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            HLc con grupo no resoluble
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{hlcConGrupoInvalido.length}</p>
          {takeFirst(hlcConGrupoInvalido).map((row) => (
            <p key={row.id} className="mt-1 font-mono text-xs text-slate-600">
              {row.id} {"->"} grupo: {formatValue(row.grupo_de_trabajo_id)}
            </p>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            HLc con efector no resoluble
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {hlcConEfectorDesignacionInvalido.length + hlcConEfectorCumplimientoInvalido.length}
          </p>
          {takeFirst(hlcConEfectorDesignacionInvalido).map((row) => (
            <p key={`${row.id}-des`} className="mt-1 font-mono text-xs text-slate-600">
              {row.id} {"->"} efector_designacion_id: {formatValue(row.efector_designacion_id)}
            </p>
          ))}
          {takeFirst(hlcConEfectorCumplimientoInvalido).map((row) => (
            <p key={`${row.id}-cum`} className="mt-1 font-mono text-xs text-slate-600">
              {row.id} {"->"} efector_cumplimiento_id: {formatValue(row.efector_cumplimiento_id)}
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
}
