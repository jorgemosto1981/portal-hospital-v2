import {
  resumenLineaOutboxOp,
  tipoFlujoOutbox,
} from "./grillaOutboxLabels.js";

/**
 * Banner F4 — cola local con etiquetas legibles (A/B/C v2).
 * @param {{
 *   ops: Array<Record<string, unknown>>;
 *   aplicandoBatch: boolean;
 *   personaLabels?: Record<string, string>;
 *   onAplicar: () => void;
 *   onLimpiar: () => void;
 *   onAbrirAyuda?: () => void;
 * }} props
 */
export default function GrillaOutboxPendientesBanner({
  ops,
  aplicandoBatch,
  personaLabels = {},
  onAplicar,
  onLimpiar,
  onAbrirAyuda,
}) {
  const count = ops.length;

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

      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
        {ops.map((op, idx) => {
          const flujo = tipoFlujoOutbox(op);
          const linea = resumenLineaOutboxOp(op, { personaLabels });
          const key = String(op.id || op.creado_en || idx);
          return (
            <li
              key={key}
              className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-white/80 px-2 py-1.5 text-xs text-indigo-950"
            >
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${flujo.clase}`}
                title={flujo.nombre}
              >
                {flujo.letra}
              </span>
              <span className="min-w-0 flex-1 leading-snug">{linea}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onAplicar}
          disabled={aplicandoBatch}
          className="min-h-11 rounded-lg bg-indigo-700 px-3 text-sm font-semibold text-white active:bg-indigo-800 disabled:opacity-60"
        >
          {aplicandoBatch ? "Aplicando..." : "Aplicar cambios"}
        </button>
        <button
          type="button"
          onClick={onLimpiar}
          className="min-h-11 rounded-lg border border-indigo-300 bg-white px-3 text-sm font-semibold text-indigo-700 active:bg-indigo-100"
        >
          Limpiar cola
        </button>
      </div>
    </div>
  );
}
