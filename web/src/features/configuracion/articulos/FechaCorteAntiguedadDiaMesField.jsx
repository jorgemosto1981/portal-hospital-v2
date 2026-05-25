import { useId } from "react";

import {
  daysInMonthForFechaCorte,
  formatFechaCorteIsoRefYear,
  parseFechaCorteMonthDayFromIso,
} from "./fecCorteAntiguedadHelpers.js";

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const TOOLTIP_TEXTO =
  "Fecha límite para el cálculo de antigüedad en bolsas de años anteriores (Camino de Stock).";

const SELECT_BASE =
  "min-h-[44px] w-full touch-manipulation rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

/**
 * Selector día/mes para `bloque_topes_plazos_computo.fecha_corte_antiguedad` (ISO en padre; año técnico).
 * Al elegir solo el mes, se propone el último día hábil del mes (típico en cortes); el día se puede ajustar.
 * @param {{ value: string, onChange: (iso: string) => void, disabled?: boolean }} props
 */
export default function FechaCorteAntiguedadDiaMesField({ value, onChange, disabled }) {
  const baseId = useId();
  const parsed = parseFechaCorteMonthDayFromIso(value);
  const month = parsed?.month ?? "";
  const day = parsed?.day ?? "";
  const maxDay = month ? daysInMonthForFechaCorte(month) : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  const onMonth = (e) => {
    const v = e.target.value;
    if (v === "") {
      onChange("");
      return;
    }
    const mi = Number(v);
    const cap = daysInMonthForFechaCorte(mi);
    const prevD = parsed?.day;
    const d = prevD == null ? cap : Math.min(prevD, cap);
    onChange(formatFechaCorteIsoRefYear(mi, d));
  };

  const onDay = (e) => {
    const v = e.target.value;
    if (v === "") {
      onChange("");
      return;
    }
    if (!parsed?.month) return;
    onChange(formatFechaCorteIsoRefYear(parsed.month, Number(v)));
  };

  const vacio = !parsed && (!value || String(value).trim() === "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span id={`${baseId}-label`}>Fecha de corte (día y mes)</span>
            <button
              type="button"
              className="inline-flex h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600 outline-none ring-blue-100 focus-visible:ring-2 active:scale-[0.98] disabled:opacity-50"
              title={TOOLTIP_TEXTO}
              aria-label={TOOLTIP_TEXTO}
              disabled={disabled}
            >
              i
            </button>
          </span>
          <p className="text-[11px] text-slate-500">
            Recurrente cada año; el motor usa solo día y mes. Al elegir mes se sugiere el último día del mes (podés cambiar el día). Si dejás vacío, el motor usa el default del §7 (31/12).
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="sr-only" id={`${baseId}-mes`}>
            Mes de corte
          </span>
          <select
            aria-labelledby={`${baseId}-label ${baseId}-mes`}
            className={SELECT_BASE}
            value={month === "" ? "" : String(month)}
            onChange={onMonth}
            disabled={disabled}
          >
            <option value="">Mes…</option>
            {MESES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="sr-only" id={`${baseId}-dia`}>
            Día de corte
          </span>
          <select
            aria-labelledby={`${baseId}-label ${baseId}-dia`}
            className={SELECT_BASE}
            value={day === "" ? "" : String(day)}
            onChange={onDay}
            disabled={disabled || !parsed}
          >
            <option value="">Día…</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      {vacio ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm italic text-slate-600">
          Por defecto: 31 de Diciembre
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("")}
        className="touch-manipulation text-left text-xs font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 outline-none ring-blue-100 focus-visible:ring-2 disabled:opacity-50"
      >
        Usar default (31/12) — limpiar fecha
      </button>
    </div>
  );
}
