import { useCallback, useEffect, useState } from "react";

import {
  callRegistrarCambioTurno,
  callEliminarCambioTurno,
  callListarOverridesTurno,
} from "../../services/callables.js";

const TIPO_COLOR = {
  reemplazo: "bg-amber-100 text-amber-800",
  adicional: "bg-blue-100 text-blue-800",
};

export default function ModalCambioTurno({ personaId, fecha, personaNombre, onCerrar, onRegistrado }) {
  const [overrides, setOverrides] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [operando, setOperando] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [form, setForm] = useState({
    tipo: "reemplazo",
    turno_id: "",
    ingreso: "",
    egreso: "",
    horas_efectivas: "",
    motivo: "",
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await callListarOverridesTurno({ persona_id: personaId, fecha });
      setOverrides(res.data?.items || []);
    } catch (e) {
      setError(e?.message || "Error al cargar overrides.");
    } finally {
      setCargando(false);
    }
  }, [personaId, fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3500);
  };

  const handleRegistrar = useCallback(async () => {
    if (form.motivo.trim().length < 3) {
      setError("El motivo es obligatorio (mín. 3 caracteres).");
      return;
    }
    setOperando(true);
    setError("");
    try {
      const override = {
        tipo: form.tipo,
        turno_id: form.turno_id.trim() || null,
        ingreso: form.ingreso || null,
        egreso: form.egreso || null,
        horas_efectivas: form.horas_efectivas !== "" ? Number(form.horas_efectivas) : null,
        motivo: form.motivo.trim(),
        es_override_manual: true,
      };
      await callRegistrarCambioTurno({ persona_id: personaId, fecha, override });
      showFeedback("Override registrado.");
      setForm({ tipo: "reemplazo", turno_id: "", ingreso: "", egreso: "", horas_efectivas: "", motivo: "" });
      await cargar();
      if (onRegistrado) onRegistrado();
    } catch (e) {
      setError(e?.message || "Error al registrar override.");
    } finally {
      setOperando(false);
    }
  }, [form, personaId, fecha, cargar, onRegistrado]);

  const handleEliminar = useCallback(async (idx) => {
    const motivo = window.prompt("Motivo de eliminación (obligatorio):");
    if (!motivo || motivo.trim().length < 3) return;
    setOperando(true);
    setError("");
    try {
      await callEliminarCambioTurno({
        persona_id: personaId,
        fecha,
        override_index: idx,
        motivo_eliminacion: motivo.trim(),
      });
      showFeedback("Override eliminado.");
      await cargar();
      if (onRegistrado) onRegistrado();
    } catch (e) {
      setError(e?.message || "Error al eliminar override.");
    } finally {
      setOperando(false);
    }
  }, [personaId, fecha, cargar, onRegistrado]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cambio de turno</h2>
            <p className="text-sm text-slate-500">
              {personaNombre || personaId} — <span className="font-mono">{fecha}</span>
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Overrides existentes */}
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Overrides registrados</h3>
          {cargando && <p className="text-xs text-slate-400">Cargando…</p>}
          {!cargando && overrides.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Sin overrides para esta fecha.
            </p>
          )}
          {overrides.length > 0 && (
            <div className="space-y-2">
              {overrides.map((ov, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${TIPO_COLOR[ov.tipo] || "bg-slate-100"}`}>
                        {ov.tipo}
                      </span>
                      {ov.turno_id && <span className="font-mono text-slate-600">Turno: {ov.turno_id}</span>}
                    </div>
                    {(ov.ingreso || ov.egreso) && (
                      <p className="text-slate-600">
                        {ov.ingreso || "—"} → {ov.egreso || "—"}
                        {ov.horas_efectivas != null && ` (${ov.horas_efectivas}hs)`}
                      </p>
                    )}
                    <p className="text-slate-500">{ov.motivo}</p>
                    <p className="text-[10px] text-slate-400">
                      por {ov.creado_por_uid?.slice(0, 12)}… — {ov.creado_en?.slice(0, 16)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={operando}
                    onClick={() => handleEliminar(i)}
                    className="ml-2 flex-shrink-0 rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Eliminar override"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="my-4 border-slate-200" />

        {/* Formulario nuevo override */}
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Registrar nuevo override</h3>
        <div className="space-y-3">
          {/* Tipo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de override</label>
            <div className="flex gap-2">
              {["reemplazo", "adicional"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                  className={`rounded-lg px-4 py-1.5 text-xs font-medium capitalize transition ${
                    form.tipo === t
                      ? t === "reemplazo"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {form.tipo === "reemplazo"
                ? "Sustituye el turno teórico (ej. cambio de franco, cambio de guardia)."
                : "Se suma al turno teórico (ej. doble guardia de urgencia, horas extras)."}
            </p>
          </div>

          {/* Turno ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Turno (opcional)</label>
            <input
              type="text"
              value={form.turno_id}
              onChange={(e) => setForm((p) => ({ ...p, turno_id: e.target.value }))}
              placeholder="M / T / N / G …"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Horarios */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Ingreso</label>
              <input
                type="time"
                value={form.ingreso}
                onChange={(e) => setForm((p) => ({ ...p, ingreso: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Egreso</label>
              <input
                type="time"
                value={form.egreso}
                onChange={(e) => setForm((p) => ({ ...p, egreso: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Hs efectivas</label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={form.horas_efectivas}
                onChange={(e) => setForm((p) => ({ ...p, horas_efectivas: e.target.value }))}
                placeholder="8"
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Motivo (obligatorio)</label>
            <textarea
              rows={2}
              maxLength={500}
              value={form.motivo}
              onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
              placeholder="Describir el motivo del cambio…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-0.5 text-right text-[10px] text-slate-400">{form.motivo.length}/500</p>
          </div>
        </div>

        {/* Feedback/Error */}
        {feedback && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            {feedback}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={operando || form.motivo.trim().length < 3}
            onClick={handleRegistrar}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {operando ? "Guardando…" : "Registrar override"}
          </button>
        </div>
      </div>
    </div>
  );
}
