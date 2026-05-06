import Card from "../../../components/ui/Card.jsx";

import { formatDdMmAaaa } from "./dateIso.js";

export function AntiguedadExternaCard({
  aExt,
  setAExt,
  mExt,
  setMExt,
  dExt,
  setDExt,
  normativa,
  setNormativa,
  desde,
  setDesde,
  personaId,
  reconocimientosGuardados,
  personaActivaDescripcionReconocimientos,
  personaActivaId,
  busyGuardarExterna,
  busyEliminarExterna,
  onGuardarExterna,
  onEliminarExterna,
}) {
  return (
    <Card className="print:hidden px-4 py-4 md:px-5">
      <h2 className="text-base font-semibold text-slate-900">Antigüedad externa / reconocida</h2>
      <p className="mt-1 text-xs text-slate-500">
        Se guarda por persona y se usa automáticamente en el cálculo si la fecha de impacto aplica al corte.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Años</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={aExt}
            onChange={(e) => setAExt(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Meses</span>
          <input
            type="number"
            min="0"
            max="11"
            inputMode="numeric"
            value={mExt}
            onChange={(e) => setMExt(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Días</span>
          <input
            type="number"
            min="0"
            max="31"
            inputMode="numeric"
            value={dExt}
            onChange={(e) => setDExt(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm text-slate-700 md:col-span-2">
          <span className="mb-1 block font-medium">Normativa</span>
          <input
            type="text"
            value={normativa}
            onChange={(e) => setNormativa(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            placeholder="Ej. Resolución 123/2026"
          />
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
        </label>
        <div className="md:col-span-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGuardarExterna}
              disabled={busyGuardarExterna || !personaId || reconocimientosGuardados.length > 0}
              className="min-h-11 touch-manipulation rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white active:bg-slate-900 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {busyGuardarExterna ? "Guardando..." : "Guardar antigüedad externa"}
            </button>
            <button
              type="button"
              onClick={onEliminarExterna}
              disabled={busyEliminarExterna || !personaId || reconocimientosGuardados.length === 0}
              className="min-h-11 touch-manipulation rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-700 active:bg-red-100 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              {busyEliminarExterna ? "Eliminando..." : "Eliminar antigüedad externa"}
            </button>
          </div>
          {reconocimientosGuardados.length > 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              Solo se permite una antigüedad externa por persona. Eliminá la actual para cargar otra.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-sm font-medium text-slate-700">
          Reconocimientos guardados para{" "}
          <span>
            {personaActivaDescripcionReconocimientos}
            {personaActivaId ? (
              <>
                {" "}
                <span className="italic">({personaActivaId})</span>
              </>
            ) : null}
          </span>
        </p>
        {reconocimientosGuardados.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No hay antigüedad reconocida cargada.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {reconocimientosGuardados.map((rec, idx) => (
              <li key={String(rec?.reconocimiento_id || idx)}>
                {`${Number(rec?.anios || 0)}a ${Number(rec?.meses || 0)}m ${Number(rec?.dias || 0)}d · ${
                  rec?.normativa || "Sin normativa"
                } · Desde ${formatDdMmAaaa(rec?.fecha_impacto || "")} · Estado ${String(rec?.estado || "vigente")}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
