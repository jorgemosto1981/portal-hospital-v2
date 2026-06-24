import { useId } from "react";

import {
  COPY_BYPASS_TOPE_AYUDA,
  COPY_BYPASS_TOPE_TITULO,
  TOPE_MOVIMIENTOS_MAX,
} from "./grillaBypassTopeMovimientos.js";

/**
 * Solo shell RRHH (`puedeBypassTopeMovimientos`).
 * @param {{
 *   habilitado: boolean;
 *   activo: boolean;
 *   onActivoChange: (v: boolean) => void;
 *   motivo: string;
 *   onMotivoChange: (v: string) => void;
 *   className?: string;
 * }} props
 */
export default function GrillaBypassTopeMovimientosSection({
  habilitado,
  activo,
  onActivoChange,
  motivo,
  onMotivoChange,
  className = "",
}) {
  const idCheck = useId();
  const idMotivo = useId();

  if (!habilitado) return null;

  return (
    <section
      className={`rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 ${className}`}
    >
      <label htmlFor={idCheck} className="flex cursor-pointer items-start gap-2">
        <input
          id={idCheck}
          type="checkbox"
          checked={activo}
          onChange={(e) => onActivoChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-700 focus-visible:ring-amber-500/40"
        />
        <span>
          <span className="text-sm font-semibold text-amber-950">{COPY_BYPASS_TOPE_TITULO}</span>
          <span className="mt-0.5 block text-xs text-amber-900/90">
            {COPY_BYPASS_TOPE_AYUDA}
            {" "}
            (máx.
            {" "}
            {TOPE_MOVIMIENTOS_MAX}
            {" "}
            sin excepción).
          </span>
        </span>
      </label>
      {activo ? (
        <div className="mt-3">
          <label htmlFor={idMotivo} className="text-xs font-medium text-amber-950">
            Motivo de excepción
            <span className="text-rose-700"> *</span>
          </label>
          <textarea
            id={idMotivo}
            rows={2}
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            placeholder="Ej.: corrección acordada con supervisión"
            className="mt-1 w-full rounded-lg border border-amber-300/80 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          />
        </div>
      ) : null}
    </section>
  );
}
