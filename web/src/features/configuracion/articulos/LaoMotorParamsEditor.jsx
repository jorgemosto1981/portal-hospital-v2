import { FieldCheck, FieldNumber, FieldText } from "./fieldWidgets.jsx";
import { LABELS } from "./articuloLabels.js";
import {
  DEFAULT_MES_DIA_APERTURA_LAO,
  DEFAULT_TSE_MINIMO_DIAS_LAO,
  isMesDiaAperturaLaoValido,
} from "./laoMotorConfigFields.js";

/**
 * Parámetros del motor LAO (RFC §11): apertura temporada, umbral TSE y cupo proporcional.
 * Solo visible cuando `es_lao_anual === true`.
 */
export default function LaoMotorParamsEditor({ form, setBlock, disabled }) {
  const topes = form.bloque_topes_plazos_computo;
  const mesDiaRaw = String(topes.mes_dia_apertura_solicitudes ?? "").trim();
  const mesDiaInvalido = mesDiaRaw !== "" && !isMesDiaAperturaLaoValido(mesDiaRaw);

  return (
    <div className="space-y-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-sky-900">Parámetros del motor LAO</h3>
      <p className="text-xs text-sky-900/80">
        Reglas de apertura de temporada, tiempo de servicio efectivo (TSE) y cálculo proporcional.
        Valores por defecto del motor: apertura {DEFAULT_MES_DIA_APERTURA_LAO}, TSE {DEFAULT_TSE_MINIMO_DIAS_LAO} días.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldText
          label={LABELS.mes_dia_apertura_solicitudes}
          value={topes.mes_dia_apertura_solicitudes ?? ""}
          onChange={(v) => setBlock("bloque_topes_plazos_computo", "mes_dia_apertura_solicitudes", v)}
          placeholder={DEFAULT_MES_DIA_APERTURA_LAO}
          helpText="Formato MM-DD. A partir de esta fecha (mismo año calendario) aplica el camino proporcional."
          required={false}
        />
        {mesDiaInvalido ? (
          <p className="md:col-span-2 text-[11px] text-red-700">
            Formato inválido. Usá MM-DD (ej. {DEFAULT_MES_DIA_APERTURA_LAO}).
          </p>
        ) : null}

        <FieldNumber
          label={LABELS.tse_minimo_dias_base}
          value={topes.tse_minimo_dias_base ?? ""}
          onChange={(v) => setBlock("bloque_topes_plazos_computo", "tse_minimo_dias_base", v)}
          min={1}
          max={366}
          helpText={`Días mínimos de servicio efectivo hasta la fecha hasta de la solicitud (default ${DEFAULT_TSE_MINIMO_DIAS_LAO}).`}
          required={false}
        />

        <div className="md:col-span-2">
          <FieldCheck
            label={LABELS.permite_calculo_proporcional_tse}
            checked={topes.permite_calculo_proporcional_tse !== false}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "permite_calculo_proporcional_tse", v)}
            helpText="Si el TSE es insuficiente y la solicitud es del año en curso, permite otorgar cupo proporcional."
          />
        </div>
      </div>
    </div>
  );
}
