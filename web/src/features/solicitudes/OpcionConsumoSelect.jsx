/**
 * Select de vínculo / opción de consumo (63.j duelo y similares).
 * @param {{
 *   opciones: Array<{ id: string, etiqueta_ui?: string, dias_por_evento?: number }>,
 *   value: string,
 *   onChange: (opcionId: string) => void,
 *   disabled?: boolean,
 *   id?: string,
 * }} props
 */
import { TICKETERA } from "./ticketeraUi.js";

function etiquetaOpcion(row) {
  const nom = String(row?.etiqueta_ui || row?.id || "").trim();
  const dias = Number(row?.dias_por_evento);
  const diasTxt =
    Number.isFinite(dias) && dias > 0
      ? ` (${dias} ${dias === 1 ? "día laborable" : "días laborables"})`
      : "";
  return `${nom}${diasTxt}`;
}

export default function OpcionConsumoSelect({
  opciones = [],
  value = "",
  onChange,
  disabled = false,
  id = "opcion-consumo-solicitud",
}) {
  const lista = Array.isArray(opciones) ? opciones : [];

  return (
    <label className="block space-y-1" htmlFor={id}>
      <span className={TICKETERA.label}>Vínculo con el fallecido</span>
      <select
        id={id}
        className={TICKETERA.select}
        value={value}
        disabled={disabled || lista.length === 0}
        required
        aria-required="true"
        onChange={(e) => onChange(String(e.target.value || "").trim())}
      >
        <option value="">Elegí el tipo de vínculo</option>
        {lista.map((row) => {
          const oid = String(row?.id || "").trim();
          if (!oid) return null;
          return (
            <option key={oid} value={oid}>
              {etiquetaOpcion(row)}
            </option>
          );
        })}
      </select>
      <span className="text-xs text-slate-500">
        Los días y la fecha de fin se calculan con el calendario institucional al validar la solicitud.
      </span>
    </label>
  );
}
