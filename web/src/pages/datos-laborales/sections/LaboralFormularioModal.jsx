import { AYUDA_CAMPOS, OPCIONES_TIPO_ALTA } from "../constants.js";
import LaboralFormCabeceraFields from "./LaboralFormCabeceraFields.jsx";
import LaboralFormHlcFields from "./LaboralFormHlcFields.jsx";
import LaboralFormHlgFields from "./LaboralFormHlgFields.jsx";
import LaboralFormVigenciaFields from "./LaboralFormVigenciaFields.jsx";

export default function LaboralFormularioModal({
  tipoAlta,
  setTipoAlta,
  modoAvanzado,
  setModoAvanzado,
  modoEdicion,
  formData,
  onChangeField,
  cargaPorDiaRows,
  onChangeCargaRow,
  accionFormularioLabel,
  personaActivaLabel,
  cargoContexto,
  opcionesGrupos,
  opcionesEfectores,
  opcionesRol,
  opcionesEstadoAsignacion,
  opcionesEscalafon,
  opcionesAgrupamiento,
  opcionesTipoVinculo,
  opcionesCategorias,
  opcionesFuncion,
  opcionesModalidadJornada,
  opcionesTipoActo,
  opcionesRegimenHorario,
  opcionesCentroCosto,
  opcionesDiaSemana,
  opcionesCausalFinAsignacion,
  errorValidacionFormulario,
  saveMsg,
  saving,
  puedeGuardarFormulario,
  onSubmit,
  onCancelar,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 px-4 py-4 md:py-8">
      <div className="w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:max-h-[90vh] md:p-5">
        <p className="text-base font-semibold text-slate-900">Carga y edición laboral</p>
        <p className="mt-1 text-sm text-slate-600">
          Completá la información por nivel de registro. Los campos seleccionables se cargan desde catálogos y
          colecciones operativas.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Criterio operativo: <span className="font-semibold">Cargo funcional</span> representa la función por
            normativa/designación formal, mientras que{" "}
            <span className="font-semibold">Función real</span> representa la función efectivamente ejercida.
            {modoAvanzado ? (
              <span>
                {" "}
                Campos técnicos: <span className="font-semibold">cargo_funcional_id</span> y{" "}
                <span className="font-semibold">funcion_real_id</span>.
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => setModoAvanzado((prev) => !prev)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 touch-manipulation active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Modo: {modoAvanzado ? "Avanzado" : "Estándar"}
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto de la acción</p>
          <p className="mt-1 text-sm font-semibold text-blue-700">{accionFormularioLabel}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{personaActivaLabel}</p>
          {cargoContexto ? (
            <div className="mt-1 text-xs text-slate-700">
              <p className="font-semibold">Período de cargo seleccionado</p>
              <p>{cargoContexto.titulo}</p>
              <p>Rol asignado: {cargoContexto.rol || "—"}</p>
              <p>
                Escalafón: {cargoContexto.escalafon || "—"} · Agrupamiento: {cargoContexto.agrupamiento || "—"}
              </p>
              <p>
                Categoría: {cargoContexto.categoria || "—"} · Función: {cargoContexto.funcion || "—"} · Carga
                horaria: {cargoContexto.cargaHoraria}
              </p>
              <p>{cargoContexto.vigencia}</p>
            </div>
          ) : null}
        </div>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <LaboralFormCabeceraFields
            tipoAlta={tipoAlta}
            setTipoAlta={setTipoAlta}
            opcionesTipoAlta={OPCIONES_TIPO_ALTA}
            showNivelRegistro={false}
            modoAvanzado={modoAvanzado}
            formData={formData}
            onChangeField={onChangeField}
            opcionesGrupos={opcionesGrupos}
            ayudaCampos={AYUDA_CAMPOS}
          />

          {tipoAlta === "historial_laboral_cargos" && (
            <LaboralFormHlcFields
              modoAvanzado={modoAvanzado}
              formData={formData}
              onChangeField={onChangeField}
              opcionesEfectores={opcionesEfectores}
              opcionesRol={opcionesRol}
              opcionesEstadoAsignacion={opcionesEstadoAsignacion}
              opcionesEscalafon={opcionesEscalafon}
              opcionesAgrupamiento={opcionesAgrupamiento}
              opcionesTipoVinculo={opcionesTipoVinculo}
              opcionesCategorias={opcionesCategorias}
              opcionesFuncion={opcionesFuncion}
              opcionesModalidadJornada={opcionesModalidadJornada}
              opcionesTipoActo={opcionesTipoActo}
              ayudaCampos={AYUDA_CAMPOS}
            />
          )}

          {tipoAlta === "historial_laboral_grupos" && (
            <LaboralFormHlgFields
              modoAvanzado={modoAvanzado}
              formData={formData}
              onChangeField={onChangeField}
              opcionesRegimenHorario={opcionesRegimenHorario}
              opcionesCentroCosto={opcionesCentroCosto}
              opcionesFuncion={opcionesFuncion}
              cargaPorDiaRows={cargaPorDiaRows}
              onChangeCargaRow={onChangeCargaRow}
              opcionesDiaSemana={opcionesDiaSemana}
              ayudaCampos={AYUDA_CAMPOS}
            />
          )}

          <LaboralFormVigenciaFields
            tipoAlta={tipoAlta}
            modoAvanzado={modoAvanzado}
            formData={formData}
            onChangeField={onChangeField}
            opcionesCausalFinAsignacion={opcionesCausalFinAsignacion}
            ayudaCampos={AYUDA_CAMPOS}
          />

          {errorValidacionFormulario || saveMsg ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                !errorValidacionFormulario && saveMsg.startsWith("Guardado")
                  ? saveMsg.includes("advertencias") || saveMsg.includes("Advertencias")
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {errorValidacionFormulario || saveMsg}
            </p>
          ) : null}

          <div className="flex justify-end">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCancelar}
                disabled={saving}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !puedeGuardarFormulario}
                className={`h-11 rounded-xl px-4 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed ${
                  puedeGuardarFormulario
                    ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    : "bg-slate-300 text-slate-600 hover:bg-slate-300 disabled:opacity-100"
                }`}
              >
                {saving ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Guardar registro"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
