import { useMemo, useState } from "react";
import {
  CFG_RCD_CORRIDOS,
  CFG_RCD_HABILES_COMPUESTO,
  CFG_RCD_HABILES_SIMPLE,
  MODO_COMPUTO_CORRIDOS,
  readModoCalculo,
} from "../../../../../shared/utils/modoComputoCalendario.js";
import Card from "../../../components/ui/Card.jsx";
import { CFG_UMA_DIAS, CFG_UMA_HORAS, filterUnidadMedidaOptions, filterUnidadMinimaPorMedida } from "./articuloComputoConstants.js";
import { EXPLICACIONES_OPCIONES, LABELS } from "./articuloLabels.js";
import AyudaPatronesBolsaModal from "./AyudaPatronesBolsaModal.jsx";
import { FieldCheck, FieldNumber, FieldSelect } from "./fieldWidgets.jsx";

/**
 * Pestaña Impacto y Saldo — bloque 4 del configurador.
 * @param {object} props
 * @param {import("./ArticuloConfigTabs.jsx").createEmptyArticuloVersionForm extends Function} props.form
 * @param {(block: string, key: string, value: unknown) => void} props.setBlock
 * @param {(v: string) => void} props.onUnidadMedidaChange
 * @param {(name: string) => { value: string, label: string }[]} props.getOptions
 * @param {boolean} props.formBloqueadoPorCatalogos
 * @param {boolean} props.esLaoAnual
 */
export default function ImpactoSaldoTabSections({
  form,
  setBlock,
  onUnidadMedidaChange,
  getOptions,
  formBloqueadoPorCatalogos,
  esLaoAnual,
}) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [ayudaTab, setAyudaTab] = useState("guia");
  const topes = form.bloque_topes_plazos_computo;
  const umId = topes.unidad_medida_id;
  const hasUm = !!umId;
  const isDias = umId === CFG_UMA_DIAS;
  const isHoras = umId === CFG_UMA_HORAS;

  const modoComputo = useMemo(
    () => readModoCalculo({ bloque_topes_plazos_computo: topes }),
    [topes.regla_computo_dias_id, topes.usa_calendario_institucional],
  );

  const reglaComputoAyuda = useMemo(() => {
    const id = String(topes.regla_computo_dias_id || "").trim();
    if (id === CFG_RCD_CORRIDOS) {
      return "Motor de solicitudes: días corridos (calendario civil). No aplica validación C4 contra feriados del calendario RRHH.";
    }
    if (id === CFG_RCD_HABILES_SIMPLE) {
      return "Motor: días hábiles simples (lun–vie). Valida C4 por fin de semana; feriados institucionales no restan salvo que cambies a hábiles compuesto.";
    }
    if (id === CFG_RCD_HABILES_COMPUESTO) {
      return "Motor: hábiles + feriados/asuetos del calendario institucional (config/calendario_institucional). Validación C4 estricta.";
    }
    if (modoComputo.modo === MODO_COMPUTO_CORRIDOS) {
      return "Elegí un criterio de descuento. Sin regla, el motor asume días corridos.";
    }
    return "Elegí un criterio de descuento para definir cómo el portal valida fechas y saldos.";
  }, [topes.regla_computo_dias_id, modoComputo.modo]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4 shadow-sm md:p-6">
        <h3 className="text-sm font-semibold text-slate-700">Cómputo y unidad de medida</h3>
        <p className="mt-1 mb-4 text-xs italic text-slate-500">
          Primero definí la <strong>unidad del saldo</strong>; el formulario muestra solo los campos que aplican (días u
          horas).
        </p>
        <FieldSelect
          label={LABELS.unidad_medida_id}
          value={umId}
          onChange={onUnidadMedidaChange}
          options={filterUnidadMedidaOptions(getOptions("cfg_unidad_medida_articulo"))}
          disabled={formBloqueadoPorCatalogos}
          required
          helpText="[¡IMPORTANTE!] Define si el saldo se cuenta en días u horas. Afecta todas las solicitudes de este artículo."
        />
        {hasUm ? (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-600">Parámetros comunes (cualquier unidad)</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldSelect
                label={LABELS.ambito_consumo_id}
                value={topes.ambito_consumo_id}
                onChange={(v) => setBlock("bloque_topes_plazos_computo", "ambito_consumo_id", v)}
                options={getOptions("cfg_ambito_consumo")}
                disabled={formBloqueadoPorCatalogos}
                required
                explicaciones={EXPLICACIONES_OPCIONES}
                helpText="Ventana temporal para sumar consumo y aplicar topes (año civil, ciclo laboral o mes)."
              />
              <FieldCheck
                label={LABELS.depende_rda}
                checked={topes.depende_rda}
                onChange={(v) => setBlock("bloque_topes_plazos_computo", "depende_rda", v)}
                helpText="Verifica disponibilidad del servicio (RDA) antes de aprobar."
                className="self-end"
              />
            </div>
            {isDias ? (
              <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-700">Configuración en días</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-2">
                    <FieldSelect
                      label={LABELS.regla_computo_dias_id}
                      value={topes.regla_computo_dias_id}
                      onChange={(v) => setBlock("bloque_topes_plazos_computo", "regla_computo_dias_id", v)}
                      options={getOptions("cfg_regla_computo_dias")}
                      disabled={formBloqueadoPorCatalogos}
                      required
                      explicaciones={EXPLICACIONES_OPCIONES}
                    />
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      {reglaComputoAyuda}
                    </p>
                  </div>
                  <FieldSelect
                    label={LABELS.unidad_minima_consumo_id}
                    value={topes.unidad_minima_consumo_id}
                    onChange={(v) => setBlock("bloque_topes_plazos_computo", "unidad_minima_consumo_id", v)}
                    options={filterUnidadMinimaPorMedida(umId, getOptions("cfg_unidad_minima_consumo"))}
                    disabled={formBloqueadoPorCatalogos}
                    helpText="Fracción mínima por solicitud (día completo o medio día)."
                  />
                  <FieldNumber
                    label={LABELS.intervalo_gracia_dias}
                    value={topes.intervalo_gracia_dias}
                    onChange={(v) => setBlock("bloque_topes_plazos_computo", "intervalo_gracia_dias", v)}
                    min={0}
                    helpText="Días de tolerancia antes de consumir saldo."
                    required={false}
                  />
                  <FieldCheck
                    label={LABELS.fraccionamiento_habilitado}
                    checked={topes.fraccionamiento_habilitado}
                    onChange={(v) => setBlock("bloque_topes_plazos_computo", "fraccionamiento_habilitado", v)}
                    helpText="Permite usar los días en partes (ej. 3 ahora, 2 después)."
                    className="self-end"
                  />
                </div>
              </div>
            ) : null}
            {isHoras ? (
              <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-700">Configuración en horas</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldSelect
                    label={LABELS.regla_computo_horas_id}
                    value={topes.regla_computo_horas_id}
                    onChange={(v) => setBlock("bloque_topes_plazos_computo", "regla_computo_horas_id", v)}
                    options={getOptions("cfg_regla_computo_horas")}
                    disabled={formBloqueadoPorCatalogos}
                    required
                    helpText="Cómo se computan las horas (jornada teórica vs reloj)."
                  />
                  <FieldNumber
                    label={LABELS.modulo_fraccionamiento_minutos}
                    value={topes.modulo_fraccionamiento_minutos}
                    onChange={(v) => {
                      const n = typeof v === "number" ? v : parseInt(v, 10);
                      setBlock(
                        "bloque_topes_plazos_computo",
                        "modulo_fraccionamiento_minutos",
                        Number.isFinite(n) && n >= 0 ? n : 15,
                      );
                    }}
                    min={0}
                    helpText="Redondeo en minutos (ej. 15)."
                    required={false}
                  />
                  <FieldSelect
                    label={LABELS.unidad_minima_consumo_id}
                    value={topes.unidad_minima_consumo_id}
                    onChange={(v) => setBlock("bloque_topes_plazos_computo", "unidad_minima_consumo_id", v)}
                    options={filterUnidadMinimaPorMedida(umId, getOptions("cfg_unidad_minima_consumo"))}
                    disabled={formBloqueadoPorCatalogos}
                    className="md:col-span-2"
                    helpText="Fracción mínima por solicitud (horas o minutos)."
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Elegí la unidad de medida del saldo para ver el resto de opciones de cómputo.
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-4 shadow-sm md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Configuración de la bolsa de días / horas</h3>
            <p className="mt-1 text-xs italic text-slate-500">
              De dónde sale el cupo, cuándo se renueva y cómo se alimenta la bolsa en el portal o desde RRHH.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAyudaAbierta(true)}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-600 touch-manipulation active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Abrir guía de configuración de saldos"
            title="Guía de patrones A/B/C"
          >
            ℹ️
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldSelect
            label={LABELS.reinicio_ciclo_id}
            value={topes.reinicio_ciclo_id}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "reinicio_ciclo_id", v)}
            options={getOptions("cfg_reinicio_ciclo_cuota")}
            disabled={formBloqueadoPorCatalogos || !hasUm}
            required={hasUm}
            explicaciones={EXPLICACIONES_OPCIONES}
          />
          <FieldSelect
            label={LABELS.origen_saldo_id}
            value={topes.origen_saldo_id}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "origen_saldo_id", v)}
            options={getOptions("cfg_origen_saldo")}
            disabled={formBloqueadoPorCatalogos || !hasUm}
            required={hasUm}
            explicaciones={EXPLICACIONES_OPCIONES}
          />
        </div>
      </Card>

      <AyudaPatronesBolsaModal
        open={ayudaAbierta}
        onClose={() => setAyudaAbierta(false)}
        tabActiva={ayudaTab}
        onTabChange={setAyudaTab}
      />

      <Card className="space-y-4 p-4 shadow-sm md:p-6">
        <h3 className="text-sm font-semibold text-slate-700">Motor aritmético del saldo</h3>
        <p className="mt-1 mb-4 text-xs italic text-slate-500">
          Define si cada solicitud suma, resta o solo registra movimiento, y el factor para horas extra.
        </p>
        {!hasUm ? (
          <p className="text-xs text-slate-500">Elegí primero la unidad de medida en la tarjeta de cómputo.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldSelect
              label={LABELS.accion_saldo_id}
              value={topes.accion_saldo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "accion_saldo_id", v)}
              options={getOptions("cfg_accion_saldo")}
              disabled={formBloqueadoPorCatalogos}
              required
              explicaciones={EXPLICACIONES_OPCIONES}
              helpText="Suma crédito (horas extra), descuenta (permiso) o registro informativo (neutro)."
            />
            {isHoras && topes.accion_saldo_id && topes.accion_saldo_id !== "cfg_as_neutro" ? (
              <FieldNumber
                label={LABELS.multiplicador_valor}
                value={topes.multiplicador_valor}
                onChange={(v) => {
                  const n = typeof v === "number" ? v : parseFloat(v);
                  setBlock(
                    "bloque_topes_plazos_computo",
                    "multiplicador_valor",
                    Number.isFinite(n) && n >= 0.1 ? n : 1,
                  );
                }}
                min={0.1}
                max={10}
                step={0.1}
                required={false}
                helpText="[¡IMPORTANTE!] El sistema multiplicará el tiempo ingresado por este factor antes de impactar el saldo (ej: 1.5 para horas al 50%)."
              />
            ) : isDias ? (
              <p className="self-end rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Con unidad en días no hay multiplicador; solo Suma, Resta o Neutro.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-4 shadow-sm md:p-6">
        <h3 className="text-sm font-semibold text-slate-700">Límites de consumo y frenos de seguridad</h3>
        <p className="mt-1 mb-4 text-xs italic text-slate-500">
          Topes de cantidad y frecuencia. En artículos por días: mínimo y máximo por solicitud (ej. LAO mínimo 5 días).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {!esLaoAnual && (
            <FieldNumber
              label={LABELS.cupo_dias_por_ciclo}
              value={topes.cupo_dias_por_ciclo}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "cupo_dias_por_ciclo", v)}
              min={0}
              helpText="Días disponibles por ciclo. En LAO el cupo sale de la Matriz de Antigüedad."
              required={false}
            />
          )}
          <FieldNumber
            label={LABELS.tope_frecuencia_mensual}
            value={topes.tope_frecuencia_mensual}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "tope_frecuencia_mensual", v)}
            min={0}
            helpText="Máximo de solicitudes aprobables en un mes."
            required={false}
          />
          {isDias ? (
            <>
              <FieldNumber
                label={LABELS.dias_minimos_por_evento}
                value={topes.dias_minimos_por_evento}
                onChange={(v) => setBlock("bloque_topes_plazos_computo", "dias_minimos_por_evento", v)}
                min={0}
                helpText="Mínimo de días por pedido (corridos/hábiles según regla). Ej: vacaciones mínimo 5 días."
                required={false}
              />
              <FieldNumber
                label={LABELS.tope_dias_por_evento}
                value={topes.tope_dias_por_evento}
                onChange={(v) => setBlock("bloque_topes_plazos_computo", "tope_dias_por_evento", v)}
                min={0}
                helpText="Máximo de días en una sola solicitud."
                required={false}
              />
            </>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-4 p-4 shadow-sm md:p-6">
        <h3 className="text-sm font-semibold text-slate-700">Superposición y convivencia</h3>
        <p className="mt-1 mb-4 text-xs italic text-slate-500">
          Qué pasa si dos solicitudes coinciden en fechas y cómo se ocupa el día en la grilla.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldSelect
            label={LABELS.nivel_ocupacion_dia_id}
            value={topes.nivel_ocupacion_dia_id}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "nivel_ocupacion_dia_id", v)}
            options={getOptions("cfg_nivel_ocupacion_dia")}
            disabled={formBloqueadoPorCatalogos}
            required
            helpText="Espacio del día que bloquea la solicitud (jornada completa, franja horaria, etc.)."
          />
          <FieldSelect
            label={LABELS.politica_superposicion_id}
            value={topes.politica_superposicion_id}
            onChange={(v) => setBlock("bloque_topes_plazos_computo", "politica_superposicion_id", v)}
            options={getOptions("cfg_politica_superposicion")}
            disabled={formBloqueadoPorCatalogos}
            required={false}
            helpText="Comportamiento ante superposición de fechas con otra solicitud."
          />
        </div>
      </Card>
    </div>
  );
}
