import Card from "../components/ui/Card.jsx";
import { guardarRegistroLaboral } from "../services/datosLaboralesService.js";
import { useEffect, useMemo, useState } from "react";
import { AYUDA_CAMPOS, COLECCIONES_FORM, INITIAL_FORM_DATA_LABORAL } from "./datos-laborales/constants.js";
import ColeccionesLaboralesCards from "./datos-laborales/sections/ColeccionesLaboralesCards.jsx";
import FasesLaboralesTables from "./datos-laborales/sections/FasesLaboralesTables.jsx";
import IntegridadReferencialCard from "./datos-laborales/sections/IntegridadReferencialCard.jsx";
import TimelineLaboralPersonaCard from "./datos-laborales/sections/TimelineLaboralPersonaCard.jsx";
import VistaOperativaGrupoCard from "./datos-laborales/sections/VistaOperativaGrupoCard.jsx";
import { useDatosLaboralesCollections } from "./datos-laborales/useDatosLaboralesCollections.js";
import { buildFormDataFromRecord, validateLaboralForm } from "./datos-laborales/formLogic.js";
import { buildHlcPayload, buildHldPayload, buildHlgPayload } from "./datos-laborales/payloadBuilders.js";
import {
  buildVistaGrupoItems,
  buildTimelineItemsByPersona,
  crearIndicePorId,
  emptyCargaDia,
  filterTimelineItemsAdvanced,
  filterTimelineItems,
  labelDesdeIndice,
  normalizarWarnings,
  updateFormDataField,
  updateCargaPorDiaRow,
  addCargaPorDiaRow,
  removeCargaPorDiaRow,
  buildRegistrosEdicionDetallados,
  buildTimelineResumen,
  buildIntegridadLaboral,
} from "./datos-laborales/utils.js";

export default function DatosLaborales() {
  const {
    rowsByCollection,
    loadingByCollection,
    progressByCollection,
    durationByCollection,
    errorByCollection,
    cargarTodo,
  } = useDatosLaboralesCollections();
  const [tipoAlta, setTipoAlta] = useState("historial_laboral_cargos");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [registroEditId, setRegistroEditId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [cargaPorDiaRows, setCargaPorDiaRows] = useState([emptyCargaDia()]);
  const [timelinePersonaId, setTimelinePersonaId] = useState("");
  const [timelineFiltro, setTimelineFiltro] = useState("todos");
  const [timelineFecha, setTimelineFecha] = useState("");
  const [timelineTipoTramo, setTimelineTipoTramo] = useState("todos");
  const [timelineGrupoId, setTimelineGrupoId] = useState("");
  const [timelineEstadoAsignacionId, setTimelineEstadoAsignacionId] = useState("");
  const [timelineNivelMin, setTimelineNivelMin] = useState("");
  const [timelineNivelMax, setTimelineNivelMax] = useState("");
  const [timelineOnlySinReferencias, setTimelineOnlySinReferencias] = useState(false);
  const [timelineOnlySolape, setTimelineOnlySolape] = useState(false);
  const [timelineWarningTipo, setTimelineWarningTipo] = useState("todos");
  const [grupoVistaId, setGrupoVistaId] = useState("");
  const [grupoVistaFecha, setGrupoVistaFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [formData, setFormData] = useState(() => ({ ...INITIAL_FORM_DATA_LABORAL }));

  const hlcRows = rowsByCollection.historial_laboral_cargos || [];
  const hldRows = rowsByCollection.historial_laboral_datos || [];
  const hlgRows = rowsByCollection.historial_laboral_grupos || [];
  const idxEfectores = crearIndicePorId(rowsByCollection.cfg_efectores || []);
  const idxGrupos = crearIndicePorId(rowsByCollection.grupos_de_trabajo || []);
  const idxPersonas = crearIndicePorId(rowsByCollection.personas || []);
  const idxRoles = crearIndicePorId(rowsByCollection.cfg_rol || []);
  const idxFunciones = crearIndicePorId(rowsByCollection.cfg_cargo_funcional || []);
  const idxHlc = crearIndicePorId(hlcRows);
  const idxHld = crearIndicePorId(hldRows);
  const opcionesGrupos = rowsByCollection.grupos_de_trabajo || [];
  const opcionesPersonas = rowsByCollection.personas || [];
  const opcionesEfectores = rowsByCollection.cfg_efectores || [];
  const opcionesEstadoAsignacion = rowsByCollection.cfg_estado_asignacion_laboral || [];
  const opcionesEscalafon = rowsByCollection.cfg_escalafon || [];
  const opcionesAgrupamiento = rowsByCollection.cfg_agrupamiento || [];
  const opcionesRol = rowsByCollection.cfg_rol || [];
  const opcionesCategorias = rowsByCollection.cfg_categorias || [];
  const opcionesFuncion = rowsByCollection.cfg_cargo_funcional || [];
  const opcionesTipoVinculo = rowsByCollection.cfg_tipo_vinculo_laboral || [];
  const opcionesModalidadJornada = rowsByCollection.cfg_modalidad_jornada || [];
  const opcionesCausalFinAsignacion = rowsByCollection.cfg_causal_fin_asignacion_laboral || [];
  const opcionesTipoActo = rowsByCollection.cfg_tipo_acto_designacion || [];
  const opcionesRegimenHorario = rowsByCollection.cfg_regimen_horario || [];
  const opcionesCentroCosto = rowsByCollection.cfg_centro_costo || [];
  const opcionesDiaSemana = rowsByCollection.cfg_dia_semana || [];
  const registrosPorTipo = rowsByCollection[tipoAlta] || [];
  const registrosPorTipoFiltrados = useMemo(() => {
    const pid = String(formData.persona_id || "").trim();
    if (!pid) return [];
    return registrosPorTipo.filter((r) => String(r.persona_id || "") === pid);
  }, [registrosPorTipo, formData.persona_id]);
  const opcionesCargoHlcFiltradas = useMemo(() => {
    if (!formData.persona_id) return hlcRows;
    const personaId = String(formData.persona_id);
    return hlcRows.filter((row) => String(row.persona_id || "") === personaId);
  }, [hlcRows, formData.persona_id]);
  const opcionesCargoHlcDetalladas = useMemo(
    () =>
      opcionesCargoHlcFiltradas.map((cargo) => {
        const cargoFuncional = labelDesdeIndice(idxFunciones, cargo.cargo_funcional_id);
        const grupo = labelDesdeIndice(idxGrupos, cargo.grupo_de_trabajo_id);
        const efectorDes = labelDesdeIndice(idxEfectores, cargo.efector_designacion_id);
        const efectorCum = labelDesdeIndice(idxEfectores, cargo.efector_cumplimiento_id);
        const desde = cargo.fecha_desde || "—";
        const hasta = cargo.fecha_hasta || "abierto";
        const estado = cargo.estado_asignacion_id || "—";
        return {
          id: cargo.id,
          label:
            `${cargo.id} | ${cargoFuncional} | ${grupo} | ` +
            `ED:${efectorDes} EC:${efectorCum} | ${desde} -> ${hasta} | estado:${estado}`,
        };
      }),
    [opcionesCargoHlcFiltradas, idxFunciones, idxGrupos, idxEfectores],
  );
  const registrosEdicionDetallados = useMemo(() => {
    return buildRegistrosEdicionDetallados({
      registrosPorTipo: registrosPorTipoFiltrados,
      tipoAlta,
      idxPersonas,
      idxFunciones,
      idxGrupos,
      idxHld,
      idxHlc,
    });
  }, [registrosPorTipoFiltrados, tipoAlta, idxPersonas, idxFunciones, idxGrupos, idxHld, idxHlc]);
  const timelineItemsBase = useMemo(
    () =>
      buildTimelineItemsByPersona({
        personaId: timelinePersonaId,
        hlcRows,
        hldRows,
        hlgRows,
        idxHlc,
        idxHld,
        idxGrupos,
        idxEfectores,
        idxPersonas,
        idxRoles,
        idxFunciones,
      }),
    [
      timelinePersonaId,
      hlcRows,
      hldRows,
      hlgRows,
      idxHlc,
      idxHld,
      idxGrupos,
      idxEfectores,
      idxPersonas,
      idxRoles,
      idxFunciones,
    ],
  );
  const timelineItems = useMemo(() => {
    const base = filterTimelineItems(timelineItemsBase, {
      filtro: timelineFiltro,
      fecha: timelineFecha,
    });
    return filterTimelineItemsAdvanced(base, {
      tipo: timelineTipoTramo,
      grupoId: timelineGrupoId,
      estadoAsignacionId: timelineEstadoAsignacionId,
      nivelMin: timelineNivelMin,
      nivelMax: timelineNivelMax,
      onlySinReferencias: timelineOnlySinReferencias,
      onlySolape: timelineOnlySolape,
      warningTipo: timelineWarningTipo,
    });
  }, [
    timelineItemsBase,
    timelineFiltro,
    timelineFecha,
    timelineTipoTramo,
    timelineGrupoId,
    timelineEstadoAsignacionId,
    timelineNivelMin,
    timelineNivelMax,
    timelineOnlySinReferencias,
    timelineOnlySolape,
    timelineWarningTipo,
  ]);
  const timelineResumen = useMemo(() => {
    return buildTimelineResumen(timelineItemsBase);
  }, [timelineItemsBase]);
  const vistaGrupoItems = useMemo(
    () =>
      buildVistaGrupoItems({
        grupoId: grupoVistaId,
        fechaCorte: grupoVistaFecha,
        hlgRows,
        idxPersonas,
        idxHld,
        idxHlc,
      }),
    [grupoVistaId, grupoVistaFecha, hlgRows, idxPersonas, idxHld, idxHlc],
  );
  const {
    hldSinCargo,
    hlgSinDato,
    hlcConGrupoInvalido,
    hlcConEfectorDesignacionInvalido,
    hlcConEfectorCumplimientoInvalido,
    totalAlertasIntegridad,
    hlcActivosSinGrupo,
  } = useMemo(
    () =>
      buildIntegridadLaboral({
        hlcRows,
        hldRows,
        hlgRows,
        idxHlc,
        idxHld,
        idxGrupos,
        idxEfectores,
      }),
    [hlcRows, hldRows, hlgRows, idxHlc, idxHld, idxGrupos, idxEfectores],
  );

  useEffect(() => {
    if (timelinePersonaId) return;
    const first = opcionesPersonas[0];
    if (first && first.id) setTimelinePersonaId(String(first.id));
  }, [timelinePersonaId, opcionesPersonas]);

  useEffect(() => {
    if (grupoVistaId) return;
    const first = opcionesGrupos[0];
    if (first && first.id) setGrupoVistaId(String(first.id));
  }, [grupoVistaId, opcionesGrupos]);

  function onChangeField(key, value) {
    setFormData((prev) => updateFormDataField(prev, key, value));
  }

  function onChangeCargaRow(idx, key, value) {
    setCargaPorDiaRows((prev) => updateCargaPorDiaRow(prev, idx, key, value));
  }

  function onAddCargaRow() {
    setCargaPorDiaRows((prev) => addCargaPorDiaRow(prev));
  }

  function onRemoveCargaRow(idx) {
    setCargaPorDiaRows((prev) => removeCargaPorDiaRow(prev, idx));
  }

  function abrirEdicionDesdeTimeline(item) {
    if (!item || !item.id) return;
    if (item.tipo === "HLc") {
      const target = hlcRows.find((x) => String(x.id) === String(item.id));
      if (!target) return;
      setTipoAlta("historial_laboral_cargos");
      setModoEdicion(true);
      setRegistroEditId(String(target.id));
      cargarRegistroEnFormulario(target);
      return;
    }
    if (item.tipo === "HLg") {
      const target = hlgRows.find((x) => String(x.id) === String(item.id));
      if (!target) return;
      setTipoAlta("historial_laboral_grupos");
      setModoEdicion(true);
      setRegistroEditId(String(target.id));
      cargarRegistroEnFormulario(target);
      return;
    }
    const hlgVinculado = hlgRows.find((x) => String(x.dato_laboral_id || "") === String(item.id));
    if (!hlgVinculado) return;
    setTipoAlta("historial_laboral_grupos");
    setModoEdicion(true);
    setRegistroEditId(String(hlgVinculado.id));
    cargarRegistroEnFormulario(hlgVinculado);
  }

  function limpiarFiltrosTimeline() {
    setTimelineFiltro("todos");
    setTimelineFecha("");
    setTimelineTipoTramo("todos");
    setTimelineGrupoId("");
    setTimelineEstadoAsignacionId("");
    setTimelineNivelMin("");
    setTimelineNivelMax("");
    setTimelineOnlySinReferencias(false);
    setTimelineOnlySolape(false);
    setTimelineWarningTipo("todos");
  }

  useEffect(() => {
    setModoEdicion(false);
    setRegistroEditId("");
    setCargaPorDiaRows([emptyCargaDia()]);
  }, [tipoAlta]);

  useEffect(() => {
    if (tipoAlta !== "historial_laboral_grupos") return;
    if (!formData.cargo_id) return;
    const cargo = idxHlc.get(String(formData.cargo_id));
    if (!cargo) {
      setFormData((prev) => ({ ...prev, cargo_id: "" }));
      return;
    }
    if (formData.persona_id && String(cargo.persona_id || "") !== String(formData.persona_id)) {
      setFormData((prev) => ({ ...prev, cargo_id: "" }));
    }
  }, [tipoAlta, formData.cargo_id, formData.persona_id, idxHlc]);

  useEffect(() => {
    if (!modoEdicion) return;
    if (!registroEditId) return;
    const exists = registrosPorTipoFiltrados.some((r) => String(r.id) === String(registroEditId));
    if (!exists) {
      setRegistroEditId("");
    }
  }, [modoEdicion, registroEditId, registrosPorTipoFiltrados]);

  function cargarRegistroEnFormulario(record) {
    const next = buildFormDataFromRecord({ record, idxHld, prevFormData: formData });
    if (!next) return;
    setFormData(next.formData);
    setCargaPorDiaRows(next.cargaPorDiaRows);
  }

  function validarFormulario() {
    return validateLaboralForm({
      tipoAlta,
      formData,
      cargaPorDiaRows,
    });
  }

  async function onGuardarRegistro(e) {
    e.preventDefault();
    setSaveMsg("");
    const errorValidacion = validarFormulario();
    if (errorValidacion) {
      setSaveMsg(errorValidacion);
      return;
    }
    setSaving(true);
    try {
      let r;
      let warnings = [];
      if (tipoAlta === "historial_laboral_cargos") {
        const payload = buildHlcPayload({ formData, modoEdicion, registroEditId });
        r = await guardarRegistroLaboral("historial_laboral_cargos", payload);
        warnings = normalizarWarnings(r && r.warnings);
      } else {
        const payloadHld = buildHldPayload({ formData, modoEdicion, registroEditId });
        const hld = await guardarRegistroLaboral("historial_laboral_datos", payloadHld);
        warnings = warnings.concat(normalizarWarnings(hld && hld.warnings));
        const payloadHlg = buildHlgPayload({
          formData,
          hldId: hld.id,
          cargaPorDiaRows,
          modoEdicion,
          registroEditId,
        });
        r = await guardarRegistroLaboral("historial_laboral_grupos", payloadHlg);
        warnings = warnings.concat(normalizarWarnings(r && r.warnings));
      }
      const baseOk = `Registro guardado correctamente: ${r.id || "(sin id)"}`;
      if (warnings.length === 0) {
        setSaveMsg(baseOk);
      } else {
        const detalleWarnings = warnings
          .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
          .join(" | ");
        setSaveMsg(`${baseOk} | Advertencias: ${detalleWarnings}`);
      }
      await cargarTodo();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="px-4 py-5 md:px-6">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Datos laborales</h1>
          <p className="mt-2 text-sm text-slate-600">
            Vista de referencia del contrato vigente en V2 para las colecciones y campos del modulo
            laboral. Esta pantalla consulta Firestore en vivo.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            <p><strong>Objetivo:</strong> registrar y auditar historial laboral por persona_id.</p>
            <p><strong>Resultado:</strong> HLc/HLd/HLg consistentes para operación y trazabilidad.</p>
            <p><strong>Cuándo usar:</strong> gestión RRHH de altas, cambios, cierres y controles laborales.</p>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Guía rápida de niveles (uso recomendado)</p>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Nivel 1 · Cargo (HLc):</span> define el cargo principal del usuario
              (efectores, estado, escalafón, agrupamiento, cargo funcional y carga total).
            </p>
            <p>
              <span className="font-semibold">Nivel 2 · Grupo de trabajo (HLg):</span> define la asignación
              operativa por grupo/burbuja (cargo base, rol, función real, nivel jerárquico y vigencia).
            </p>
            <p>
              <span className="font-semibold">Detalle técnico (HLd):</span> se gestiona en segundo plano para
              sostener trazabilidad técnica entre cargo y asignaciones por grupo.
            </p>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Orden sugerido de carga: HLc {"->"} HLg. La app crea/actualiza HLd cuando corresponde, sin
              perder trazabilidad.
            </p>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">
            Alta de Datos Laborales (BD real, sin datos ficticios)
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Completá la información por nivel (`HLc` o `HLg`). Los campos seleccionables se cargan
            desde colecciones reales de Firestore.
          </p>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Criterio operativo: <span className="font-semibold">cargo_funcional_id</span> representa la
              función por normativa/designación formal, mientras que{" "}
              <span className="font-semibold">funcion_real_id</span> representa la función efectivamente
              ejercida. Pueden diferir temporalmente sin que eso implique error.
            </p>
          <form className="mt-4 space-y-4" onSubmit={onGuardarRegistro}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nivel de registro
              </label>
              <select
                value={tipoAlta}
                onChange={(e) => setTipoAlta(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
              >
                <option value="historial_laboral_cargos">HLc · historial_laboral_cargos</option>
                <option value="historial_laboral_grupos">HLg · historial_laboral_grupos (con vínculo a cargo)</option>
              </select>
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={modoEdicion}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setModoEdicion(checked);
                    setRegistroEditId("");
                    if (!checked) return;
                    const first = registrosPorTipoFiltrados[0];
                    if (first && first.id) {
                      setRegistroEditId(String(first.id));
                      cargarRegistroEnFormulario(first);
                    }
                  }}
                />
                Editar registro existente
              </label>
              {modoEdicion && !formData.persona_id && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Seleccioná primero un <span className="font-semibold">persona_id</span> para listar registros.
                </p>
              )}
              {modoEdicion && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Registro a editar</label>
                  <select
                    value={registroEditId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setRegistroEditId(id);
                      const target = registrosPorTipo.find((x) => String(x.id) === String(id));
                      if (target) cargarRegistroEnFormulario(target);
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar registro...</option>
                    {registrosEdicionDetallados.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">persona_id *</label>
                <select
                  value={formData.persona_id}
                  onChange={(e) => onChangeField("persona_id", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                >
                  <option value="">Seleccionar persona...</option>
                  {opcionesPersonas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.apellido ? `${p.apellido || ""} ${p.nombre || ""} (${p.id})` : p.id}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.persona_id}</p>
              </div>

              {tipoAlta === "historial_laboral_grupos" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">grupo_de_trabajo_id *</label>
                  <select
                    value={formData.grupo_de_trabajo_id}
                    onChange={(e) => onChangeField("grupo_de_trabajo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar grupo...</option>
                    {opcionesGrupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre || g.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.grupo_de_trabajo_id}</p>
                </div>
              )}
            </div>

            {tipoAlta === "historial_laboral_cargos" && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">efector_designacion_id *</label>
                  <select
                    value={formData.efector_designacion_id}
                    onChange={(e) => onChangeField("efector_designacion_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar efector...</option>
                    {opcionesEfectores.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.efector_designacion_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">efector_cumplimiento_id *</label>
                  <select
                    value={formData.efector_cumplimiento_id}
                    onChange={(e) => onChangeField("efector_cumplimiento_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar efector...</option>
                    {opcionesEfectores.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.efector_cumplimiento_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">rol_id</label>
                  <select
                    value={formData.rol_id}
                    onChange={(e) => onChangeField("rol_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar rol...</option>
                    {opcionesRol.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.rol_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">estado_asignacion_id</label>
                  <select
                    value={formData.estado_asignacion_id}
                    onChange={(e) => onChangeField("estado_asignacion_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar estado...</option>
                    {opcionesEstadoAsignacion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.estado_asignacion_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">escalafon_id</label>
                  <select
                    value={formData.escalafon_id}
                    onChange={(e) => onChangeField("escalafon_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar escalafón...</option>
                    {opcionesEscalafon.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.escalafon_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">agrupamiento_id</label>
                  <select
                    value={formData.agrupamiento_id}
                    onChange={(e) => onChangeField("agrupamiento_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar agrupamiento...</option>
                    {opcionesAgrupamiento.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.agrupamiento_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">tipo_vinculo_id</label>
                  <select
                    value={formData.tipo_vinculo_id}
                    onChange={(e) => onChangeField("tipo_vinculo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar tipo de vínculo...</option>
                    {opcionesTipoVinculo.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.tipo_vinculo_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">categoria_id</label>
                  <select
                    value={formData.categoria_id}
                    onChange={(e) => onChangeField("categoria_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar categoría...</option>
                    {opcionesCategorias.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.categoria_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">cargo_funcional_id</label>
                  <select
                    value={formData.cargo_funcional_id}
                    onChange={(e) => onChangeField("cargo_funcional_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar cargo funcional...</option>
                    {opcionesFuncion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.cargo_funcional_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">modalidad_jornada_id</label>
                  <select
                    value={formData.modalidad_jornada_id}
                    onChange={(e) => onChangeField("modalidad_jornada_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar modalidad...</option>
                    {opcionesModalidadJornada.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.modalidad_jornada_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · tipo_acto_id *
                  </label>
                  <select
                    value={formData.referencia_tipo_acto_id}
                    onChange={(e) => onChangeField("referencia_tipo_acto_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar tipo de acto...</option>
                    {opcionesTipoActo.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.referencias_normativa_designacion}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · número *
                  </label>
                  <input
                    value={formData.referencia_numero}
                    onChange={(e) => onChangeField("referencia_numero", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · fecha *
                  </label>
                  <input
                    type="date"
                    value={formData.referencia_fecha}
                    onChange={(e) => onChangeField("referencia_fecha", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    referencia normativa · detalle
                  </label>
                  <input
                    value={formData.referencia_detalle}
                    onChange={(e) => onChangeField("referencia_detalle", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">carga_horaria_total</label>
                  <input
                    value={formData.carga_horaria_total}
                    onChange={(e) => onChangeField("carga_horaria_total", e.target.value)}
                    placeholder="36"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.carga_horaria_total}</p>
                </div>
              </div>
            )}

            {tipoAlta === "historial_laboral_grupos" && (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">cargo_id *</label>
                  <select
                    value={formData.cargo_id}
                    onChange={(e) => onChangeField("cargo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar cargo HLc...</option>
                    {opcionesCargoHlcDetalladas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.cargo_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">regimen_horario_id</label>
                  <select
                    value={formData.regimen_horario_id}
                    onChange={(e) => onChangeField("regimen_horario_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar régimen...</option>
                    {opcionesRegimenHorario.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.regimen_horario_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">centro_costo_id</label>
                  <select
                    value={formData.centro_costo_id}
                    onChange={(e) => onChangeField("centro_costo_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar centro de costo...</option>
                    {opcionesCentroCosto.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.centro_costo_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">funcion_real_id</label>
                  <select
                    value={formData.funcion_real_id}
                    onChange={(e) => onChangeField("funcion_real_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar función...</option>
                    {opcionesFuncion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.funcion_real_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">nivel_jerarquico</label>
                  <input
                    value={formData.nivel_jerarquico}
                    onChange={(e) => onChangeField("nivel_jerarquico", e.target.value)}
                    placeholder="1..99"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.nivel_jerarquico}</p>
                </div>
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">carga_por_dia_semana</label>
                    <button
                      type="button"
                      onClick={onAddCargaRow}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      Agregar día
                    </button>
                  </div>
                  <p className="mb-2 text-xs text-slate-500">{AYUDA_CAMPOS.carga_por_dia_semana}</p>
                  <div className="space-y-2">
                    {cargaPorDiaRows.map((row, idx) => (
                      <div key={`carga-dia-${idx}`} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
                        <select
                          value={row.dia_semana_id}
                          onChange={(e) => onChangeCargaRow(idx, "dia_semana_id", e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                        >
                          <option value="">Seleccionar día...</option>
                          {opcionesDiaSemana.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nombre || x.id}
                            </option>
                          ))}
                        </select>
                        <input
                          value={row.horas}
                          onChange={(e) => onChangeCargaRow(idx, "horas", e.target.value)}
                          placeholder="Horas (0..24)"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveCargaRow(idx)}
                          className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {tipoAlta === "historial_laboral_cargos"
                    ? "fecha_desde (cargo)"
                    : "fecha_desde (asignación en grupo)"}
                </label>
                <input
                  type="date"
                  value={formData.fecha_desde}
                  onChange={(e) => onChangeField("fecha_desde", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.fecha_desde}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  {tipoAlta === "historial_laboral_cargos"
                    ? "fecha_hasta (cargo)"
                    : "fecha_hasta (asignación en grupo)"}
                </label>
                <input
                  type="date"
                  value={formData.fecha_hasta}
                  onChange={(e) => onChangeField("fecha_hasta", e.target.value)}
                  min={formData.fecha_desde || undefined}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.fecha_hasta}</p>
              </div>
              {tipoAlta === "historial_laboral_cargos" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">causal_fin_asignacion_id</label>
                  <select
                    value={formData.causal_fin_asignacion_id}
                    onChange={(e) => onChangeField("causal_fin_asignacion_id", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar causal...</option>
                    {opcionesCausalFinAsignacion.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nombre || x.id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">{AYUDA_CAMPOS.causal_fin_asignacion_id}</p>
                </div>
              )}
            </div>

            {saveMsg && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  saveMsg.startsWith("Registro guardado")
                    ? saveMsg.includes("Advertencias:")
                      ? "bg-amber-50 text-amber-800"
                      : "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {saveMsg}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : modoEdicion ? "Guardar cambios en BD" : "Guardar en BD"}
              </button>
            </div>
          </form>
        </Card>

        <IntegridadReferencialCard
          totalAlertasIntegridad={totalAlertasIntegridad}
          hldSinCargo={hldSinCargo}
          hlcActivosSinGrupo={hlcActivosSinGrupo}
          hlgSinDato={hlgSinDato}
          hlcConGrupoInvalido={hlcConGrupoInvalido}
          hlcConEfectorDesignacionInvalido={hlcConEfectorDesignacionInvalido}
          hlcConEfectorCumplimientoInvalido={hlcConEfectorCumplimientoInvalido}
        />

        <TimelineLaboralPersonaCard
          opcionesPersonas={opcionesPersonas}
          personaId={timelinePersonaId}
          onPersonaChange={setTimelinePersonaId}
          filtro={timelineFiltro}
          onFiltroChange={setTimelineFiltro}
          fechaCorte={timelineFecha}
          onFechaCorteChange={setTimelineFecha}
          items={timelineItems}
          resumen={timelineResumen}
          onAbrirEdicion={abrirEdicionDesdeTimeline}
          tipoTramo={timelineTipoTramo}
          onTipoTramoChange={setTimelineTipoTramo}
          grupoId={timelineGrupoId}
          onGrupoIdChange={setTimelineGrupoId}
          grupos={opcionesGrupos}
          estadoAsignacionId={timelineEstadoAsignacionId}
          onEstadoAsignacionIdChange={setTimelineEstadoAsignacionId}
          estadosAsignacion={opcionesEstadoAsignacion}
          nivelMin={timelineNivelMin}
          nivelMax={timelineNivelMax}
          onNivelMinChange={setTimelineNivelMin}
          onNivelMaxChange={setTimelineNivelMax}
          onlySinReferencias={timelineOnlySinReferencias}
          onOnlySinReferenciasChange={setTimelineOnlySinReferencias}
          onlySolape={timelineOnlySolape}
          onOnlySolapeChange={setTimelineOnlySolape}
          warningTipo={timelineWarningTipo}
          onWarningTipoChange={setTimelineWarningTipo}
          totalBase={timelineItemsBase.length}
          onLimpiarFiltros={limpiarFiltrosTimeline}
        />

        <VistaOperativaGrupoCard
          grupos={opcionesGrupos}
          grupoId={grupoVistaId}
          onGrupoIdChange={setGrupoVistaId}
          fechaCorte={grupoVistaFecha}
          onFechaCorteChange={setGrupoVistaFecha}
          items={vistaGrupoItems}
        />

        <ColeccionesLaboralesCards
          loadingByCollection={loadingByCollection}
          progressByCollection={progressByCollection}
          durationByCollection={durationByCollection}
          errorByCollection={errorByCollection}
          rowsByCollection={rowsByCollection}
        />

        <FasesLaboralesTables
          loadingByCollection={loadingByCollection}
          errorByCollection={errorByCollection}
          hlcRows={hlcRows}
          hldRows={hldRows}
          hlgRows={hlgRows}
          idxGrupos={idxGrupos}
          idxEfectores={idxEfectores}
          idxHlc={idxHlc}
          idxHld={idxHld}
          labelDesdeIndice={labelDesdeIndice}
        />
      </div>
    </div>
  );
}
