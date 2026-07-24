import { useEffect, useMemo, useState } from "react";

import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { callEjecutarPaseInternoGdt } from "../../services/callables.js";
import { ymdHoyBa } from "../solicitudes/ticketeraUtils.js";
import { aplanarOpcionesGdtDestino } from "./buildArbolGdt.js";

/**
 * Modal — pase interno de GDT (SPIKE Fase 2).
 * fecha_efectiva = último día de trabajo en el grupo origen.
 *
 * @param {{
 *   abierto: boolean;
 *   onCerrar: () => void;
 *   onExito?: (result: Record<string, unknown>) => void;
 *   agente: {
 *     persona_id: string;
 *     apellido?: string;
 *     nombre?: string;
 *     dni?: string;
 *     hlg_id: string;
 *     nivel_jerarquico?: number | null;
 *   } | null;
 *   gdtOrigenId: string;
 *   gdtOrigenNombre?: string;
 *   arbol: Array<{ id: string, nombre: string, children?: unknown[] }>;
 *   personaSesionId?: string;
 * }} props
 */
export default function PaseInternoModal({
  abierto,
  onCerrar,
  onExito,
  agente,
  gdtOrigenId,
  gdtOrigenNombre = "",
  arbol = [],
  personaSesionId = "",
}) {
  const destinos = useMemo(
    () => aplanarOpcionesGdtDestino(arbol, gdtOrigenId),
    [arbol, gdtOrigenId],
  );

  const [gdtDestinoId, setGdtDestinoId] = useState("");
  const [fechaEfectiva, setFechaEfectiva] = useState(() => ymdHoyBa());
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setGdtDestinoId("");
    setFechaEfectiva(ymdHoyBa());
    setMotivo("");
    setError("");
    setOkMsg("");
    setEnviando(false);
  }, [abierto, agente?.hlg_id]);

  if (!abierto || !agente?.persona_id || !agente?.hlg_id) return null;

  const sesionId = String(personaSesionId || "").trim();
  const esAutoPase =
    /^per_/i.test(sesionId) && String(agente.persona_id || "").trim() === sesionId;

  const nombreAgente = [agente.apellido, agente.nombre].filter(Boolean).join(", ") || agente.persona_id;
  const origenLabel = gdtOrigenNombre || gdtOrigenId;

  const puedeEnviar =
    !esAutoPase &&
    /^gdt_/i.test(gdtDestinoId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fechaEfectiva) &&
    motivo.trim().length >= 3 &&
    !enviando;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (esAutoPase) {
      setError("No podés ejecutarte un pase a vos mismo.");
      return;
    }
    if (!puedeEnviar) return;
    setEnviando(true);
    setError("");
    setOkMsg("");
    try {
      const res = await callEjecutarPaseInternoGdt({
        agente_persona_id: agente.persona_id,
        hlg_origen_id: agente.hlg_id,
        gdt_destino_id: gdtDestinoId,
        fecha_efectiva: fechaEfectiva,
        motivo: motivo.trim(),
      });
      const data = res?.data || {};
      setOkMsg(
        `Pase ejecutado. Nuevo HLg desde ${data.fecha_inicio_destino || "el día siguiente"} (${data.pase_id || "ok"}).`,
      );
      onExito?.(data);
    } catch (err) {
      const msg = err?.message || "No se pudo ejecutar el pase interno.";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pase-interno-titulo"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !enviando) onCerrar();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h2 id="pase-interno-titulo" className="text-base font-semibold text-slate-900">
              Pase interno de GDT
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cierra el HLg en el grupo origen y abre uno nuevo en el destino (herencia de régimen y nivel).
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            disabled={enviando}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-900">{nombreAgente}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                DNI {agente.dni || "—"}
                {agente.nivel_jerarquico != null ? ` · Nivel ${agente.nivel_jerarquico}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Origen: <span className="font-medium text-slate-700">{origenLabel}</span>
              </p>
            </div>

            {esAutoPase ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No podés ejecutarte un pase a vos mismo.
              </p>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                GDT destino
              </span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                value={gdtDestinoId}
                onChange={(ev) => setGdtDestinoId(ev.target.value)}
                disabled={enviando || destinos.length === 0}
                required
              >
                <option value="">
                  {destinos.length === 0
                    ? "No hay otros grupos en tu jurisdicción"
                    : "Seleccioná el grupo destino…"}
                </option>
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fecha efectiva
              </span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                value={fechaEfectiva}
                onChange={(ev) => setFechaEfectiva(ev.target.value)}
                disabled={enviando}
                required
              />
              <span className="mt-1.5 block text-xs font-medium text-slate-700">
                * Indicar último día de trabajo en este grupo
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                El HLg destino inicia al día siguiente.
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Motivo
              </span>
              <textarea
                className="min-h-[5rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                value={motivo}
                onChange={(ev) => setMotivo(ev.target.value)}
                disabled={enviando}
                maxLength={500}
                placeholder="Motivo del traslado interno…"
                required
              />
            </label>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            ) : null}
            {okMsg ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {okMsg}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row-reverse sm:px-5">
            <PrimaryButton type="submit" disabled={!puedeEnviar} className="sm:w-auto sm:min-w-[10rem]">
              {enviando ? "Ejecutando…" : "Ejecutar pase"}
            </PrimaryButton>
            <button
              type="button"
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:min-w-[8rem]"
              disabled={enviando}
              onClick={onCerrar}
            >
              {okMsg ? "Cerrar" : "Cancelar"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
