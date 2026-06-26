import { useMemo } from "react";

import { FieldSelect } from "./fieldWidgets.jsx";
import { LABELS } from "./articuloLabels.js";
import { newOpcionConsumoSolicitudRow } from "./opcionesConsumoSolicitudEditorHelpers.js";
import { getOpcionConsumoRowFieldIssues, opcionesConsumoTienenErroresUi } from "./opcionesConsumoSolicitudRowValidation.js";

const inputBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function inputClass(error, disabled) {
  const border = error ? "border-red-400 ring-1 ring-red-100" : "border-slate-200";
  return `${inputBase} ${border}`.trim();
}

function MicroError({ children }) {
  if (!children) return null;
  return <p className="mt-1 text-[10px] font-medium text-red-700">{children}</p>;
}

/**
 * Tabla de opciones de consumo (63.j duelo y similares) — embebido en versión publicada.
 * @param {boolean} disabled — `formBloqueadoPorCatalogos` u otra inmutabilidad de edición.
 */
export default function OpcionesConsumoSolicitudEditor({ form, setForm, getOptions, disabled }) {
  const rows = Array.isArray(form.opciones_consumo_solicitud) ? form.opciones_consumo_solicitud : [];
  const topeEvento = Number(form.bloque_topes_plazos_computo?.tope_dias_por_evento);
  const tope =
    Number.isFinite(topeEvento) && topeEvento > 0 ? Math.floor(topeEvento) : null;
  const reglaOptions = getOptions("cfg_regla_computo_dias");

  const tablaConErrores = useMemo(
    () => opcionesConsumoTienenErroresUi(rows, tope),
    [rows, tope],
  );

  function updateRow(idx, patch) {
    if (disabled) return;
    setForm((prev) => {
      const list = [...(prev.opciones_consumo_solicitud || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, opciones_consumo_solicitud: list };
    });
  }

  function removeRow(idx) {
    if (disabled) return;
    setForm((prev) => ({
      ...prev,
      opciones_consumo_solicitud: (prev.opciones_consumo_solicitud || []).filter((_, i) => i !== idx),
    }));
  }

  return (
    <div
      className={`space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4 shadow-sm ${disabled ? "opacity-95" : ""}`.trim()}
      aria-disabled={disabled || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-violet-950">{LABELS.opciones_consumo_solicitud}</h3>
          <p className="mt-1 text-xs text-violet-900/85">{LABELS.opciones_consumo_solicitud_help}</p>
          {disabled ? (
            <p className="mt-2 text-[11px] font-medium text-slate-600">
              Edición bloqueada: cargá catálogos o abrí una versión editable antes de modificar las causales.
            </p>
          ) : null}
        </div>
        {!disabled ? (
          <button
            type="button"
            className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-950"
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
        ) : null}
      </div>

      {tope != null ? (
        <p className="text-[11px] text-violet-900/90">
          Tope por evento del artículo: <strong>{tope}</strong> día(s). Cada fila no puede superar ese tope al guardar.
        </p>
      ) : null}

      {tablaConErrores ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
          Revisá las filas marcadas en rojo antes de guardar: la descripción y los días deben ser válidos y respetar el
          tope del artículo.
        </div>
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
                {!disabled ? <th className="w-14 px-2 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const issues = getOpcionConsumoRowFieldIssues(row, tope);
                const diasErr = issues.diasInvalido || issues.superaTope;
                return (
                  <tr key={row.id || `opcion-${idx}`} className="border-b border-slate-50 align-top">
                    <td className="px-2 py-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">ID</span>
                        <input
                          type="text"
                          disabled={disabled}
                          value={row.id || ""}
                          onChange={(e) => updateRow(idx, { id: e.target.value.trim() })}
                          className={inputClass(false, disabled)}
                          aria-label="ID estable"
                        />
                      </label>
                    </td>
                    <td className="px-2 py-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">Etiqueta</span>
                        <input
                          type="text"
                          disabled={disabled}
                          value={row.etiqueta_ui || ""}
                          onChange={(e) => updateRow(idx, { etiqueta_ui: e.target.value })}
                          className={inputClass(issues.etiquetaVacia, disabled)}
                          aria-invalid={issues.etiquetaVacia || undefined}
                          aria-label="Etiqueta en ticketera"
                        />
                        <MicroError>
                          {issues.etiquetaVacia ? "La descripción es obligatoria" : null}
                        </MicroError>
                      </label>
                    </td>
                    <td className="px-2 py-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">Días</span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          disabled={disabled}
                          value={row.dias_por_evento === "" ? "" : row.dias_por_evento ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              updateRow(idx, { dias_por_evento: "" });
                              return;
                            }
                            const n = Number(raw);
                            updateRow(idx, { dias_por_evento: Number.isFinite(n) ? n : "" });
                          }}
                          className={inputClass(diasErr, disabled)}
                          aria-invalid={diasErr || undefined}
                          aria-label="Días por evento"
                        />
                        <MicroError>
                          {issues.diasInvalido ? "Debe ser al menos 1 día" : null}
                          {!issues.diasInvalido && issues.superaTope
                            ? "No puede superar el tope global del artículo"
                            : null}
                        </MicroError>
                      </label>
                    </td>
                    <td className="px-2 py-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">SARH</span>
                        <input
                          type="text"
                          disabled={disabled}
                          value={row.codigo_sarh || ""}
                          onChange={(e) => updateRow(idx, { codigo_sarh: e.target.value })}
                          className={inputClass(false, disabled)}
                          aria-label="Código SARH"
                        />
                      </label>
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
                          className="h-4 w-4 rounded border-slate-300 text-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
                          checked={row.activo !== false}
                          disabled={disabled}
                          onChange={(e) => updateRow(idx, { activo: e.target.checked })}
                          aria-label="Opción activa"
                        />
                      </label>
                    </td>
                    {!disabled ? (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-red-700 underline"
                          onClick={() => removeRow(idx)}
                        >
                          Quitar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
