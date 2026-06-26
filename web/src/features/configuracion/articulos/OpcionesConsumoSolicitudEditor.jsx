import { FieldNumber, FieldSelect, FieldText } from "./fieldWidgets.jsx";
import { LABELS } from "./articuloLabels.js";
import { newOpcionConsumoSolicitudRow } from "./opcionesConsumoSolicitudEditorHelpers.js";

/**
 * Tabla de opciones de consumo (63.j duelo y similares) — embebido en versión publicada.
 */
export default function OpcionesConsumoSolicitudEditor({ form, setForm, getOptions, disabled }) {
  const rows = Array.isArray(form.opciones_consumo_solicitud) ? form.opciones_consumo_solicitud : [];
  const topeEvento = Number(form.bloque_topes_plazos_computo?.tope_dias_por_evento);
  const tope =
    Number.isFinite(topeEvento) && topeEvento > 0 ? Math.floor(topeEvento) : null;
  const reglaOptions = getOptions("cfg_regla_computo_dias");

  function updateRow(idx, patch) {
    setForm((prev) => {
      const list = [...(prev.opciones_consumo_solicitud || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, opciones_consumo_solicitud: list };
    });
  }

  function removeRow(idx) {
    setForm((prev) => ({
      ...prev,
      opciones_consumo_solicitud: (prev.opciones_consumo_solicitud || []).filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-violet-950">{LABELS.opciones_consumo_solicitud}</h3>
          <p className="mt-1 text-xs text-violet-900/85">{LABELS.opciones_consumo_solicitud_help}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-950 disabled:opacity-50"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              opciones_consumo_solicitud: [
                ...(prev.opciones_consumo_solicitud || []),
                newOpcionConsumoSolicitudRow(),
              ],
            }))
          }
        >
          Añadir causal / opción
        </button>
      </div>

      {tope != null ? (
        <p className="text-[11px] text-violet-900/90">
          Tope por evento del artículo: <strong>{tope}</strong> día(s). Cada fila no puede superar ese tope al guardar.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-violet-200 bg-white/80 px-3 py-4 text-xs text-slate-600">
          Sin opciones. El agente usará solo los topes del bloque Impacto y saldo. Para duelo (63.j) agregá las causales
          con días por vínculo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-violet-100 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="min-w-[10rem] px-2 py-2">ID estable</th>
                <th className="min-w-[12rem] px-2 py-2">Etiqueta en ticketera</th>
                <th className="px-2 py-2">Días / evento</th>
                <th className="min-w-[10rem] px-2 py-2">Código SARH</th>
                <th className="min-w-[12rem] px-2 py-2">Regla cómputo</th>
                <th className="px-2 py-2">Activa</th>
                <th className="w-14 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id || `opcion-${idx}`} className="border-b border-slate-50 align-top">
                  <td className="px-2 py-2">
                    <FieldText
                      label="ID"
                      value={row.id || ""}
                      onChange={(v) => updateRow(idx, { id: String(v || "").trim() })}
                      required={false}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <FieldText
                      label="Etiqueta"
                      value={row.etiqueta_ui || ""}
                      onChange={(v) => updateRow(idx, { etiqueta_ui: v })}
                      required={false}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <FieldNumber
                      label="Días"
                      value={row.dias_por_evento}
                      onChange={(v) => updateRow(idx, { dias_por_evento: v })}
                      min={1}
                      max={31}
                      required={false}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <FieldText
                      label="SARH"
                      value={row.codigo_sarh || ""}
                      onChange={(v) => updateRow(idx, { codigo_sarh: v })}
                      disabled={disabled}
                      required={false}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <FieldSelect
                      label="Regla"
                      value={row.regla_computo_id || ""}
                      onChange={(v) => updateRow(idx, { regla_computo_id: v })}
                      options={reglaOptions}
                      disabled={disabled}
                      required={false}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <label className="flex items-center justify-center pt-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-violet-600"
                        checked={row.activo !== false}
                        disabled={disabled}
                        onChange={(e) => updateRow(idx, { activo: e.target.checked })}
                        aria-label="Opción activa"
                      />
                    </label>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      disabled={disabled}
                      className="text-xs font-medium text-red-700 underline disabled:opacity-50"
                      onClick={() => removeRow(idx)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
