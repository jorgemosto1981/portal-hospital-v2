import { useEffect, useMemo, useState } from "react";

import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import { callAprobarPaseGdt, callListarArbolGdtPlantel } from "../../services/callables.js";
import { aplanarOpcionesGdtDestino, construirArbolGdt } from "./buildArbolGdt.js";

/**
 * Modal RRHH — aprobar pase externo (elige GDT destino + fecha + overrides opcionales).
 *
 * @param {{
 *   abierto: boolean;
 *   onCerrar: () => void;
 *   onExito?: (result: Record<string, unknown>) => void;
 *   pase: {
 *     pase_id: string;
 *     agente_apellido?: string;
 *     agente_nombre?: string;
 *     agente_dni?: string;
 *     gdt_origen_id: string;
 *     gdt_origen_nombre?: string;
 *     destino_sugerido_texto?: string | null;
 *     motivo?: string;
 *     fecha_efectiva?: string | null;
 *   } | null;
 * }} props
 */
export default function AprobarPaseGdtModal({ abierto, onCerrar, onExito, pase }) {
  const [arbol, setArbol] = useState(/** @type {unknown[]} */ ([]));
  const [cargandoArbol, setCargandoArbol] = useState(false);
  const [gdtDestinoId, setGdtDestinoId] = useState("");
  const [fechaEfectiva, setFechaEfectiva] = useState("");
  const [nivelOverride, setNivelOverride] = useState("");
  const [regimenOverride, setRegimenOverride] = useState("");
  const [motivoRrhh, setMotivoRrhh] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const destinos = useMemo(
    () => aplanarOpcionesGdtDestino(/** @type {any} */ (arbol), pase?.gdt_origen_id || ""),
    [arbol, pase?.gdt_origen_id],
  );

  useEffect(() => {
    if (!abierto || !pase?.pase_id) return;
    setGdtDestinoId("");
    setFechaEfectiva(pase.fecha_efectiva || "");
    setNivelOverride("");
    setRegimenOverride("");
    setMotivoRrhh("");
    setError("");
    setEnviando(false);

    let cancel = false;
    (async () => {
      setCargandoArbol(true);
      try {
        const res = await callListarArbolGdtPlantel({ alcance: "rrhh" });
        if (cancel) return;
        const data = res?.data || {};
        const arbolSrv = Array.isArray(data.arbol) ? data.arbol : null;
        if (arbolSrv && arbolSrv.length) {
          setArbol(arbolSrv);
        } else {
          const nodos = Array.isArray(data.nodos) ? data.nodos : [];
          setArbol(construirArbolGdt(nodos));
        }
      } catch (err) {
        if (!cancel) setError(err?.message || "No se pudo cargar el árbol de GDT.");
      } finally {
        if (!cancel) setCargandoArbol(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [abierto, pase?.pase_id, pase?.fecha_efectiva]);

  if (!abierto || !pase?.pase_id) return null;

  const nombreAgente =
    [pase.agente_apellido, pase.agente_nombre].filter(Boolean).join(", ") || "Agente";

  const puedeEnviar =
    /^gdt_/i.test(gdtDestinoId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fechaEfectiva) &&
    !enviando &&
    !cargandoArbol;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError("");
    try {
      /** @type {Record<string, unknown>} */
      const overrides_hlg = {};
      if (nivelOverride.trim() !== "") {
        overrides_hlg.nivel_jerarquico = Number(nivelOverride);
      }
      if (regimenOverride.trim() !== "") {
        overrides_hlg.regimen_horario_id = regimenOverride.trim();
      }
      const res = await callAprobarPaseGdt({
        pase_id: pase.pase_id,
        gdt_destino_id: gdtDestinoId,
        fecha_efectiva: fechaEfectiva,
        overrides_hlg: Object.keys(overrides_hlg).length ? overrides_hlg : undefined,
        motivo_rrhh: motivoRrhh.trim() || undefined,
      });
      onExito?.(res?.data || {});
      onCerrar();
    } catch (err) {
      setError(err?.message || "No se pudo aprobar el pase.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aprobar-pase-titulo"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !enviando) onCerrar();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h2 id="aprobar-pase-titulo" className="text-base font-semibold text-slate-900">
              Aprobar pase externo
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Cierra el HLg origen y abre destino. Fecha = último día en el grupo origen.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
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
              <p className="mt-0.5 text-xs text-slate-600">DNI {pase.agente_dni || "—"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Origen:{" "}
                <span className="font-medium text-slate-700">
                  {pase.gdt_origen_nombre || pase.gdt_origen_id}
                </span>
              </p>
              {pase.destino_sugerido_texto ? (
                <p className="mt-1 text-xs text-slate-600">
                  Destino sugerido:{" "}
                  <span className="font-medium text-slate-800">{pase.destino_sugerido_texto}</span>
                </p>
              ) : null}
              {pase.motivo ? (
                <p className="mt-1 text-xs text-slate-500">Motivo jefe: {pase.motivo}</p>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                GDT destino
              </span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                value={gdtDestinoId}
                onChange={(ev) => setGdtDestinoId(ev.target.value)}
                disabled={enviando || cargandoArbol}
                required
              >
                <option value="">
                  {cargandoArbol ? "Cargando grupos…" : "Seleccioná el GDT destino…"}
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                value={fechaEfectiva}
                onChange={(ev) => setFechaEfectiva(ev.target.value)}
                disabled={enviando}
                required
              />
              <span className="mt-1.5 block text-xs font-medium text-slate-700">
                * Indicar último día de trabajo en este grupo
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nivel (opcional)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  value={nivelOverride}
                  onChange={(ev) => setNivelOverride(ev.target.value)}
                  disabled={enviando}
                  placeholder="Heredar"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Régimen id (opcional)
                </span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  value={regimenOverride}
                  onChange={(ev) => setRegimenOverride(ev.target.value)}
                  disabled={enviando}
                  placeholder="Heredar"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nota RRHH (opcional)
              </span>
              <textarea
                className="min-h-[3.5rem] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                value={motivoRrhh}
                onChange={(ev) => setMotivoRrhh(ev.target.value)}
                disabled={enviando}
                maxLength={400}
              />
            </label>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row-reverse sm:px-5">
            <PrimaryButton type="submit" disabled={!puedeEnviar} className="sm:w-auto sm:min-w-[10rem]">
              {enviando ? "Aprobando…" : "Aprobar y ejecutar"}
            </PrimaryButton>
            <button
              type="button"
              className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={enviando}
              onClick={onCerrar}
            >
              Cancelar
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
