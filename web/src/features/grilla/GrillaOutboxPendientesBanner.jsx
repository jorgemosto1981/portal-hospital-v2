import { useEffect, useMemo, useState } from "react";

import GrillaGuardrailTeoriaAviso from "./GrillaGuardrailTeoriaAviso.jsx";

import {
  agruparOpsOutboxPorTarjeta,
  agruparOpsOutboxPorTitulo,
  labelPeriodoOutbox,
  mergePersonaLabelsDesdeOps,
  outboxOpId,
  resumenLineaOutboxOp,
  tituloGrupoOutboxOp,
} from "./grillaOutboxLabels.js";

/**
 * @param {{
 *   ops: Array<Record<string, unknown>>;
 *   personaLabels: Record<string, string>;
 *   turnosPorId?: Record<string, object>;
 *   aplicandoBatch: boolean;
 *   onQuitarOp?: (opId: string) => void;
 *   confirmRemoveId: string | null;
 *   onPedirQuitar: (opId: string) => void;
 *   onConfirmarQuitar: (opId: string) => void;
 *   onCancelarQuitar: () => void;
 *   mostrarEncabezadosFuncion: boolean;
 * }} props
 */
function OutboxOpsPorFuncion({
  ops,
  personaLabels,
  turnosPorId = {},
  aplicandoBatch,
  onQuitarOp,
  confirmRemoveId,
  onPedirQuitar,
  onConfirmarQuitar,
  onCancelarQuitar,
  mostrarEncabezadosFuncion,
}) {
  const grupos = useMemo(() => agruparOpsOutboxPorTitulo(ops), [ops]);
  const ctx = { personaLabels, turnosPorId };

  return (
    <div className="space-y-2">
      {grupos.map((grupo) => (
        <section
          key={grupo.tipo}
          className={`rounded-lg border ${grupo.claseGrupo} p-1.5`}
        >
          {mostrarEncabezadosFuncion ? (
            <h4 className={`px-1.5 pb-1 text-xs font-semibold ${grupo.clase}`}>
              {grupo.titulo}
              <span className="ml-1 font-normal text-slate-600">({grupo.ops.length})</span>
            </h4>
          ) : null}
          <ul className="space-y-1">
            {grupo.ops.map((op, idx) => {
              const linea = resumenLineaOutboxOp(op, ctx);
              const opId = outboxOpId(op, idx);
              const enConfirmQuitar = confirmRemoveId === opId;

              return (
                <li
                  key={opId}
                  className={`rounded-lg border px-2 py-1.5 text-xs text-indigo-950 ${
                    enConfirmQuitar
                      ? "border-rose-200 bg-rose-50/90"
                      : "border-indigo-100 bg-white/90"
                  }`}
                >
                  {!mostrarEncabezadosFuncion ? (
                    <p className={`mb-1 text-[11px] font-semibold ${grupo.clase}`}>
                      {grupo.titulo}
                    </p>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 leading-snug">{linea}</span>
                    {onQuitarOp && !enConfirmQuitar ? (
                      <button
                        type="button"
                        onClick={() => onPedirQuitar(opId)}
                        disabled={aplicandoBatch}
                        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-slate-400 active:bg-slate-100 active:text-rose-700 disabled:opacity-40"
                        aria-label={`Quitar: ${linea}`}
                        title="Quitar"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  {enConfirmQuitar ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rose-200/80 pt-2">
                      <span className="text-rose-900">¿Quitar este cambio?</span>
                      <button
                        type="button"
                        onClick={() => onConfirmarQuitar(opId)}
                        className="min-h-9 rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white active:bg-rose-800"
                      >
                        Quitar
                      </button>
                      <button
                        type="button"
                        onClick={onCancelarQuitar}
                        className="min-h-9 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-900 active:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Banner F4 — cola local agrupada por tarjeta (grupo × mes) y función (A/B/C v2).
 * @param {{
 *   ops: Array<Record<string, unknown>>;
 *   aplicandoBatch: boolean;
 *   personaLabels?: Record<string, string>;
 *   grupoLabels?: Record<string, string>;
 *   turnosPorId?: Record<string, object>;
 *   onAplicar: () => void;
 *   onLimpiar: () => void;
 *   onQuitarOp?: (opId: string) => void;
 *   onAbrirAyuda?: () => void;
 *   puedeAplicarBatch?: boolean;
 *   mensajeBloqueoBatch?: string | null;
 *   muestraBadgeBypassRrhh?: boolean;
 * }} props
 */
export default function GrillaOutboxPendientesBanner({
  ops,
  aplicandoBatch,
  personaLabels = {},
  grupoLabels = {},
  turnosPorId = {},
  onAplicar,
  onLimpiar,
  onQuitarOp,
  onAbrirAyuda,
  puedeAplicarBatch = true,
  mensajeBloqueoBatch = null,
  muestraBadgeBypassRrhh = false,
}) {
  const count = ops.length;
  const tarjetas = useMemo(() => agruparOpsOutboxPorTarjeta(ops), [ops]);
  const personaLabelsMerged = useMemo(
    () => mergePersonaLabelsDesdeOps(ops, personaLabels),
    [ops, personaLabels],
  );

  const [confirmAplicar, setConfirmAplicar] = useState(false);
  const [confirmLimpiar, setConfirmLimpiar] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    setConfirmAplicar(false);
    setConfirmLimpiar(false);
    setConfirmRemoveId(null);
  }, [count]);

  useEffect(() => {
    if (!confirmRemoveId) return;
    if (!ops.some((op, idx) => outboxOpId(op, idx) === confirmRemoveId)) {
      setConfirmRemoveId(null);
    }
  }, [ops, confirmRemoveId]);

  if (count === 0) return null;

  const cancelarConfirmaciones = () => {
    setConfirmAplicar(false);
    setConfirmLimpiar(false);
    setConfirmRemoveId(null);
  };

  const pedirQuitarFila = (opId) => {
    setConfirmAplicar(false);
    setConfirmLimpiar(false);
    setConfirmRemoveId(opId);
  };

  const confirmarQuitarFila = (opId) => {
    if (onQuitarOp) onQuitarOp(opId);
    setConfirmRemoveId(null);
  };

  const handleAplicar = () => {
    if (aplicandoBatch || !puedeAplicarBatch) return;
    if (!confirmAplicar) {
      setConfirmLimpiar(false);
      setConfirmRemoveId(null);
      setConfirmAplicar(true);
      return;
    }
    cancelarConfirmaciones();
    onAplicar();
  };

  const handleLimpiar = () => {
    if (!confirmLimpiar) {
      setConfirmAplicar(false);
      setConfirmRemoveId(null);
      setConfirmLimpiar(true);
      return;
    }
    cancelarConfirmaciones();
    onLimpiar();
  };

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-900">
      <div className="flex items-center gap-2">
        <p className="font-medium">Cambios pendientes: {count}</p>
        {onAbrirAyuda ? (
          <button
            type="button"
            onClick={onAbrirAyuda}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300 bg-white text-xs font-bold text-indigo-700 active:bg-indigo-100"
            title="¿Cómo funciona Aplicar cambios?"
            aria-label="Ayuda sobre cambios pendientes"
          >
            ?
          </button>
        ) : null}
      </div>

      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {tarjetas.map((tarjeta) => {
          const refOp = tarjeta.ops[0];
          const grupoLabel = tituloGrupoOutboxOp(refOp, grupoLabels);
          const periodoLabel = labelPeriodoOutbox(tarjeta.periodo);
          const mostrarEncabezadosFuncion = tarjeta.ops.length > 1;

          return (
            <article
              key={tarjeta.key}
              className="rounded-xl border border-slate-300 bg-slate-50 p-2 text-slate-800"
            >
              <header className="mb-2 flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-sm font-semibold text-slate-900">{grupoLabel}</span>
                <span className="shrink-0 text-right text-xs text-slate-600">
                  <span className="block capitalize">{periodoLabel}</span>
                  <span className="font-medium text-slate-500">
                    {tarjeta.ops.length} cambio{tarjeta.ops.length === 1 ? "" : "s"}
                  </span>
                </span>
              </header>
              <OutboxOpsPorFuncion
                ops={tarjeta.ops}
                personaLabels={personaLabelsMerged}
                turnosPorId={turnosPorId}
                aplicandoBatch={aplicandoBatch}
                onQuitarOp={onQuitarOp}
                confirmRemoveId={confirmRemoveId}
                onPedirQuitar={pedirQuitarFila}
                onConfirmarQuitar={confirmarQuitarFila}
                onCancelarQuitar={() => setConfirmRemoveId(null)}
                mostrarEncabezadosFuncion={mostrarEncabezadosFuncion}
              />
            </article>
          );
        })}
      </div>

      <GrillaGuardrailTeoriaAviso
        muestraBadgeBypassRrhh={muestraBadgeBypassRrhh}
        mensajeBloqueo={!puedeAplicarBatch ? mensajeBloqueoBatch : null}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAplicar}
          disabled={aplicandoBatch || !puedeAplicarBatch}
          title={!puedeAplicarBatch ? mensajeBloqueoBatch || undefined : undefined}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
            confirmAplicar
              ? "bg-emerald-700 active:bg-emerald-800"
              : "bg-indigo-700 active:bg-indigo-800"
          }`}
        >
          {aplicandoBatch
            ? "Aplicando..."
            : confirmAplicar
              ? `Confirmar envío (${count})`
              : "Aplicar cambios"}
        </button>
        <button
          type="button"
          onClick={handleLimpiar}
          disabled={aplicandoBatch}
          className={`min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60 ${
            confirmLimpiar
              ? "border-rose-400 bg-rose-100 text-rose-900 active:bg-rose-200"
              : "border-indigo-300 bg-white text-indigo-700 active:bg-indigo-100"
          }`}
        >
          {confirmLimpiar ? `Confirmar limpieza (${count})` : "Limpiar cola"}
        </button>
        {confirmAplicar || confirmLimpiar ? (
          <button
            type="button"
            onClick={cancelarConfirmaciones}
            disabled={aplicandoBatch}
            className="min-h-11 rounded-lg px-2 text-sm text-indigo-700 underline-offset-2 active:underline disabled:opacity-60"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}
