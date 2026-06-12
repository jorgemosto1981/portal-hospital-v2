import MascaraAyudaPanel from "./components/MascaraAyudaPanel.jsx";
import {
  MASCARA_RELOJ_DEFAULT,
  POLITICAS_DUPLICADOS_OPCIONES,
} from "./relojBiometricoFormUtils.js";

/**
 * @param {{
 *   form: import("./relojBiometricoFormUtils.js").estadoFormDesdeReloj extends (...args: unknown[]) => infer R ? R : never;
 *   grupos: Array<{ id: string; nombre?: string }>;
 *   guardando?: boolean;
 *   onChange: (patch: Record<string, unknown>) => void;
 *   onSubmit: () => void;
 *   onCancel?: () => void;
 * }} props
 */
export default function RelojBiometricoForm({
  form,
  grupos,
  guardando = false,
  onChange,
  onSubmit,
  onCancel,
}) {
  const esEdicion = Boolean(form.reloj_id);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {esEdicion ? (
        <p className="text-xs text-slate-500">
          ID: <span className="font-mono">{form.reloj_id}</span>
        </p>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        Nombre visible
        <input
          type="text"
          required
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={form.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          disabled={guardando}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Grupo de trabajo (sector, opcional)
        <select
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={form.grupo_trabajo_id}
          onChange={(e) => onChange({ grupo_trabajo_id: e.target.value })}
          disabled={guardando}
        >
          <option value="">— Universal (todo el hospital) —</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre || g.id}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Número de reloj (equipo)
        <input
          type="text"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
          placeholder="001"
          value={form.numero_reloj}
          onChange={(e) => onChange({ numero_reloj: e.target.value })}
          disabled={guardando}
        />
      </label>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Máscara de línea TXT
          <input
            type="text"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
            value={form.mascara_tokens}
            onChange={(e) => onChange({ mascara_tokens: e.target.value })}
            disabled={guardando}
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Por defecto: {MASCARA_RELOJ_DEFAULT}. Abrí el asistente para probar una línea real del archivo.
          </span>
        </label>
        <MascaraAyudaPanel
          mascaraActual={form.mascara_tokens}
          onUsarMascara={(mascara) => onChange({ mascara_tokens: mascara })}
          disabled={guardando}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Umbral duplicado (min)
          <input
            type="number"
            min={1}
            max={120}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.umbral_duplicado_minutos}
            onChange={(e) => onChange({ umbral_duplicado_minutos: e.target.value })}
            disabled={guardando}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Política duplicados
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.politica_duplicados}
            onChange={(e) => onChange({ politica_duplicados: e.target.value })}
            disabled={guardando}
          >
            {POLITICAS_DUPLICADOS_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => onChange({ activo: e.target.checked })}
          disabled={guardando}
        />
        Reloj activo (visible en import y enrolamiento)
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear reloj"}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={guardando}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
            onClick={onCancel}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
