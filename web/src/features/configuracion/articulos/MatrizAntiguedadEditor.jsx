import FechaCorteAntiguedadDiaMesField from "./FechaCorteAntiguedadDiaMesField.jsx";
import { FieldNumber, FieldSelect } from "./fieldWidgets.jsx";
import { LABELS } from "./articuloLabels.js";
import { sortMatrizAntiguedadReglas } from "./ArticuloConfigTabs.jsx";

/**
 * Sección LAO condicional: año fiscal, fecha de corte y tabla de escala de antigüedad.
 * Se renderiza solo cuando `es_lao_anual === true`.
 */
export default function MatrizAntiguedadEditor({
  form,
  setForm,
  setBlock,
  matrizLaoFeedback,
  operadorComparacionOptions,
  disabled,
}) {
  return (
    <div className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-emerald-900">{LABELS.matriz_antiguedad_reglas}</h3>
      <p className="text-xs text-emerald-900/80">
        Configurá el año fiscal, la fecha de corte de antigüedad y la escala de días por años de servicio.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldNumber
          label={LABELS.correspondencia_anio}
          value={form.bloque_topes_plazos_computo.correspondencia_anio}
          onChange={(v) => setBlock("bloque_topes_plazos_computo", "correspondencia_anio", v)}
          min={1900}
          helpText="Año fiscal/presupuestario al que pertenece esta parametrización (ej. 2025)."
        />
        <div className="md:col-span-2 rounded-lg border border-emerald-100/80 bg-white/90 p-3">
          <FechaCorteAntiguedadDiaMesField
            value={form.bloque_topes_plazos_computo.fecha_corte_antiguedad}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "fecha_corte_antiguedad", v)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-emerald-900">Tabla de escalones</span>
          <button
            type="button"
            className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-900"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                bloque_topes_plazos_computo: {
                  ...prev.bloque_topes_plazos_computo,
                  matriz_antiguedad_reglas: sortMatrizAntiguedadReglas([
                    ...(prev.bloque_topes_plazos_computo.matriz_antiguedad_reglas || []),
                    { operador_id: "", valor_anos: "", dias_otorgados: "" },
                  ]),
                },
              }))
            }
          >
            Añadir fila
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-emerald-900/90">
          Las filas se reordenan automáticamente por años de antigüedad. El motor otorga los días
          del último escalón cuya condición se cumpla.
        </p>

        {matrizLaoFeedback.errors.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-950">
            <p className="font-semibold">No se puede guardar hasta corregir:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {matrizLaoFeedback.errors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {matrizLaoFeedback.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
            <p className="font-semibold">Revisar coherencia</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {matrizLaoFeedback.warnings.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-emerald-100 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2 min-w-[200px]">Operador</th>
                <th className="px-2 py-2">Umbral (años)</th>
                <th className="px-2 py-2">Días del escalón</th>
                <th className="px-2 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {(form.bloque_topes_plazos_computo.matriz_antiguedad_reglas || []).map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="px-2 py-1 align-top">
                    <FieldSelect
                      label="Operador de comparación"
                      omitLabel
                      value={row.operador_id || ""}
                      onChange={(v) =>
                        setForm((prev) => {
                          const rows = [...(prev.bloque_topes_plazos_computo.matriz_antiguedad_reglas || [])];
                          rows[idx] = { ...rows[idx], operador_id: v };
                          return {
                            ...prev,
                            bloque_topes_plazos_computo: {
                              ...prev.bloque_topes_plazos_computo,
                              matriz_antiguedad_reglas: sortMatrizAntiguedadReglas(rows),
                            },
                          };
                        })
                      }
                      options={operadorComparacionOptions}
                      disabled={disabled}
                      placeholder="Elegí operador…"
                      className="min-w-0"
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="number"
                      min={0}
                      className="w-24 rounded border border-slate-200 px-1 py-1.5"
                      value={row.valor_anos === "" || row.valor_anos === undefined ? "" : row.valor_anos}
                      onChange={(e) =>
                        setForm((prev) => {
                          const rows = [...(prev.bloque_topes_plazos_computo.matriz_antiguedad_reglas || [])];
                          const raw = e.target.value;
                          rows[idx] = { ...rows[idx], valor_anos: raw === "" ? "" : Number(raw) };
                          return {
                            ...prev,
                            bloque_topes_plazos_computo: {
                              ...prev.bloque_topes_plazos_computo,
                              matriz_antiguedad_reglas: sortMatrizAntiguedadReglas(rows),
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="number"
                      min={0}
                      className="w-24 rounded border border-slate-200 px-1 py-1.5"
                      value={row.dias_otorgados === "" || row.dias_otorgados === undefined ? "" : row.dias_otorgados}
                      onChange={(e) =>
                        setForm((prev) => {
                          const rows = [...(prev.bloque_topes_plazos_computo.matriz_antiguedad_reglas || [])];
                          const raw = e.target.value;
                          rows[idx] = { ...rows[idx], dias_otorgados: raw === "" ? "" : Number(raw) };
                          return {
                            ...prev,
                            bloque_topes_plazos_computo: {
                              ...prev.bloque_topes_plazos_computo,
                              matriz_antiguedad_reglas: sortMatrizAntiguedadReglas(rows),
                            },
                          };
                        })
                      }
                    />
                  </td>
                  <td className="px-1 py-1 align-top">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() =>
                        setForm((prev) => {
                          const rows = [...(prev.bloque_topes_plazos_computo.matriz_antiguedad_reglas || [])];
                          rows.splice(idx, 1);
                          return {
                            ...prev,
                            bloque_topes_plazos_computo: {
                              ...prev.bloque_topes_plazos_computo,
                              matriz_antiguedad_reglas: sortMatrizAntiguedadReglas(rows),
                            },
                          };
                        })
                      }
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
