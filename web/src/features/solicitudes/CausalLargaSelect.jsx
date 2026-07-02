import { TICKETERA } from "./ticketeraUi.js";

/**
 * @param {{
 *   opciones: Array<{ id: string, titulo_ui?: string, descripcion_ui?: string }>,
 *   value: string,
 *   onChange: (id: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function CausalLargaSelect({
  opciones = [],
  value = "",
  onChange,
  disabled = false,
}) {
  const lista = Array.isArray(opciones) ? opciones : [];

  return (
    <label className="block space-y-1" htmlFor="causal-larga-duracion">
      <span className={TICKETERA.label}>Causal — Art. 19</span>
      <select
        id="causal-larga-duracion"
        className={TICKETERA.select}
        value={value}
        disabled={disabled || lista.length === 0}
        required
        aria-required="true"
        onChange={(e) => onChange(String(e.target.value || "").trim())}
      >
        <option value="">Elegí la causal de larga duración</option>
        {lista.map((row) => {
          const id = String(row?.id || "").trim();
          if (!id) return null;
          const titulo = String(row?.titulo_ui || id).trim();
          return (
            <option key={id} value={id}>
              {titulo}
            </option>
          );
        })}
      </select>
      <span className="text-xs text-slate-500">
        Obligatoria para licencia médica larga (Arts. 16/19).
      </span>
    </label>
  );
}
