/** Constantes UI compartidas — bandejas TC pases GDT. */

export const PAGE_SIZE_TC = 10;

/** @type {ReadonlyArray<{ value: string, label: string }>} */
export const ORDEN_TC_OPTIONS = Object.freeze([
  { value: "creado_en", label: "Fecha del pase (más reciente)" },
  { value: "tc_en", label: "Fecha de toma de conocimiento" },
  { value: "agente", label: "Agente (apellido / nombre)" },
  { value: "gdt_origen", label: "GDT origen" },
  { value: "gdt_destino", label: "GDT destino" },
  { value: "estado", label: "Estado del pase" },
]);

/**
 * @param {number | null | undefined} ms
 */
export function formatTsMs(ms) {
  if (!ms || !Number.isFinite(Number(ms))) return "—";
  try {
    return new Date(Number(ms)).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

/**
 * Controles de orden + paginación para tablas TC.
 * @param {{
 *   orden: string;
 *   onOrdenChange: (v: string) => void;
 *   page: number;
 *   totalPages: number;
 *   total: number;
 *   hasPrev: boolean;
 *   hasNext: boolean;
 *   onPrev: () => void;
 *   onNext: () => void;
 *   truncated?: boolean;
 *   disabled?: boolean;
 * }} props
 */
export function PasesGdtTcToolbar({
  orden,
  onOrdenChange,
  page,
  totalPages,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  truncated = false,
  disabled = false,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="font-medium text-slate-700">Ordenar por</span>
        <select
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          value={orden}
          disabled={disabled}
          onChange={(ev) => onOrdenChange(ev.target.value)}
        >
          {ORDEN_TC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-3 text-xs text-slate-600 sm:justify-end">
        <span>
          Página {page} de {totalPages} · {total} resultado(s)
          {truncated ? " (ventana limitada)" : ""}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled || !hasPrev}
            onClick={onPrev}
            className="rounded border border-slate-200 px-2 py-1 font-medium disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={disabled || !hasNext}
            onClick={onNext}
            className="rounded border border-slate-200 px-2 py-1 font-medium disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
