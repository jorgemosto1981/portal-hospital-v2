import Card from "../components/ui/Card.jsx";
import { guardarRegistroLaboral } from "../services/datosLaboralesService.js";
import { useEffect, useMemo, useState } from "react";
import { AYUDA_CAMPOS, INITIAL_FORM_DATA_LABORAL } from "./datos-laborales/constants.js";
import ColeccionesLaboralesCards from "./datos-laborales/sections/ColeccionesLaboralesCards.jsx";
import FasesLaboralesTables from "./datos-laborales/sections/FasesLaboralesTables.jsx";
import IntegridadReferencialCard from "./datos-laborales/sections/IntegridadReferencialCard.jsx";
import LaboralFormCabeceraFields from "./datos-laborales/sections/LaboralFormCabeceraFields.jsx";
import PersonaSearchSelect from "./datos-laborales/components/PersonaSearchSelect.jsx";
import LaboralFormHlcFields from "./datos-laborales/sections/LaboralFormHlcFields.jsx";
import LaboralFormHlgFields from "./datos-laborales/sections/LaboralFormHlgFields.jsx";
import LaboralFormModoEdicionFields from "./datos-laborales/sections/LaboralFormModoEdicionFields.jsx";
import LaboralFormVigenciaFields from "./datos-laborales/sections/LaboralFormVigenciaFields.jsx";
import TimelineLaboralPersonaCard from "./datos-laborales/sections/TimelineLaboralPersonaCard.jsx";
import VistaOperativaGrupoCard from "./datos-laborales/sections/VistaOperativaGrupoCard.jsx";
import { useDatosLaboralesCollections } from "./datos-laborales/useDatosLaboralesCollections.js";
import { buildFormDataFromRecord, validateLaboralForm } from "./datos-laborales/formLogic.js";
import { buildHlcPayload, buildHldPayload, buildHlgPayload } from "./datos-laborales/payloadBuilders.js";
import LabeledSelect from "./datos-laborales/components/LabeledSelect.jsx";
import LabeledTextField from "./datos-laborales/components/LabeledTextField.jsx";
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

const EMPTY_ROWS = [];

const OPCIONES_TIPO_ALTA = [
  { id: "historial_laboral_cargos", nombre: "HLc · historial_laboral_cargos" },
  {
    id: "historial_laboral_grupos",
    nombre: "HLg · historial_laboral_grupos (con vínculo a cargo)",
  },
];
const STORAGE_KEY_MODO_AVANZADO = "rrhh_datos_laborales_modo_avanzado_v1";

function toDateSafe(value) {
  const d = new Date(String(value || ""));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value) {
  const d = toDateSafe(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function isVigenteByFecha(row) {
  const hasta = String(row?.fecha_hasta || row?.fecha_fin || "").trim();
  return !hasta;
}

function labelPersonaOpcion(p) {
  if (!p || !p.id) return "";
  if (p.nombre || p.apellido) {
    return `${String(p.apellido || "").trim()} ${String(p.nombre || "").trim()} (${p.id})`.trim();
  }
  return String(p.id);
}

function labelPersonaOpcionAvanzada(p) {
  if (!p || !p.id) return "";
  const apellido = String(p.apellido || "").trim();
  const nombre = String(p.nombre || "").trim();
  const base = [apellido, nombre].filter(Boolean).join(" ").trim();
  return base ? `${base} | ${p.id}` : String(p.id);
}

function buildPersonaSearchOption(p) {
  const id = String(p?.id || "").trim();
  if (!id) return null;
  const nombre = String(p?.nombre || "").trim();
  const apellido = String(p?.apellido || "").trim();
  const dni = String(p?.dni || "").trim();
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ").trim();
  const label = nombreCompleto ? `${nombreCompleto} · DNI: ${dni || "—"}` : id;
  return {
    value: id,
    label,
    selectedLabel: label,
    secondary: id,
  };
}

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
  const [vistaTab, setVistaTab] = useState("actual");
  const [modoAvanzado, setModoAvanzado] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY_MODO_AVANZADO) === "1";
  });

  const hlcRows = rowsByCollection.historial_laboral_cargos ?? EMPTY_ROWS;
  const hldRows = rowsByCollection.historial_laboral_datos ?? EMPTY_ROWS;
  const hlgRows = rowsByCollection.historial_laboral_grupos ?? EMPTY_ROWS;
  const idxEfectores = crearIndicePorId(rowsByCollection.cfg_efectores || []);
  const idxGrupos = crearIndicePorId(rowsByCollection.grupos_de_trabajo || []);
  const idxPersonas = crearIndicePorId(rowsByCollection.personas || []);
  const idxRoles = crearIndicePorId(rowsByCollection.cfg_rol || []);
  const idxFunciones = crearIndicePorId(rowsByCollection.cfg_cargo_funcional || []);
  const idxHlc = crearIndicePorId(hlcRows);
  const idxHld = crearIndicePorId(hldRows);
  const opcionesGrupos = rowsByCollection.grupos_de_trabajo ?? EMPTY_ROWS;
  const opcionesPersonas = rowsByCollection.personas ?? EMPTY_ROWS;
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
  const opcionesPersonasSearch = useMemo(
    () => (opcionesPersonas || []).map(buildPersonaSearchOption).filter(Boolean),
    [opcionesPersonas],
  );
  const registrosPorTipo = rowsByCollection[tipoAlta] ?? EMPTY_ROWS;
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
  const snapshotActual = useMemo(() => {
    const personaId = String(formData.persona_id || "").trim();
    if (!personaId) {
      return {
        hlcVigente: null,
        hlgVigentes: [],
        hldVigente: null,
        lastUpdate: null,
        alertas: [],
      };
    }
    const hlcPersona = hlcRows.filter((r) => String(r.persona_id || "") === personaId);
    const hlgPersona = hlgRows.filter((r) => String(r.persona_id || "") === personaId);
    const hldPersona = hldRows.filter((r) => String(r.persona_id || "") === personaId);
    const hlcVigentes = hlcPersona.filter(isVigenteByFecha);
    const hlgVigentes = hlgPersona.filter(isVigenteByFecha);
    const hldVigentes = hldPersona.filter(isVigenteByFecha);
    const hlcVigente = hlcVigentes[0] || null;
    const hldVigente = hldVigentes[0] || null;
    const merged = [...hlcPersona, ...hlgPersona, ...hldPersona];
    const lastUpdate = merged
      .map((r) => r.actualizado_en || r.creado_en || null)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0] || null;
    const alertas = [];
    if (hlcVigentes.length > 1) alertas.push("Más de un HLC vigente");
    if (!hlcVigente && hlgVigentes.length > 0) alertas.push("HLG vigente sin HLC vigente");
    if (!hldVigente && hlgVigentes.length > 0) alertas.push("HLG vigente sin HLD vigente");
    const hlcLabel = hlcVigente
      ? `${labelDesdeIndice(idxFunciones, hlcVigente.cargo_funcional_id)} · ${labelDesdeIndice(
          idxEfectores,
          hlcVigente.efector_cumplimiento_id,
        )}`
      : "Sin vigencia";
    const hlgLabel =
      hlgVigentes.length === 0
        ? "Sin vigencia"
        : hlgVigentes
            .slice(0, 2)
            .map((r) => {
              const grupo = labelDesdeIndice(idxGrupos, r.grupo_de_trabajo_id);
              const funcion = labelDesdeIndice(idxFunciones, r.funcion_real_id);
              return `${grupo} · ${funcion}`;
            })
            .join(" | ");
    const hldLabel = hldVigente
      ? `Vigente desde ${String(hldVigente.fecha_desde || hldVigente.fecha_inicio || "—")}`
      : "Sin vigencia";
    return { hlcVigente, hlgVigentes, hldVigente, lastUpdate, alertas, hlcLabel, hlgLabel, hldLabel };
  }, [formData.persona_id, hlcRows, hlgRows, hldRows, idxFunciones, idxEfectores, idxGrupos]);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_MODO_AVANZADO, modoAvanzado ? "1" : "0");
  }, [modoAvanzado]);

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
      const baseOk = `Guardado correctamente: ${r.id || "(sin id)"}`;
      if (warnings.length === 0) {
        setSaveMsg(baseOk);
      } else {
        const detalleWarnings = warnings
          .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
          .join(" | ");
        setSaveMsg(`Guardado con advertencias: ${detalleWarnings}`);
      }
      await cargarTodo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido.";
      setSaveMsg(`No se pudo guardar: ${msg}`);
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
            Pantalla operativa RRHH para gestionar vigencias laborales por persona con datos en vivo.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            <p><strong>Objetivo:</strong> registrar y revisar historial laboral por persona.</p>
            <p><strong>Resultado:</strong> cargos y asignaciones vigentes e históricos con trazabilidad.</p>
            <p><strong>Cuándo usar:</strong> altas, cambios, cierres y control de consistencia laboral.</p>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <PersonaSearchSelect
            personaId={formData.persona_id}
            setPersonaId={(value) => onChangeField("persona_id", value)}
            personaOptions={opcionesPersonasSearch}
            modoAvanzado={modoAvanzado}
          />
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-slate-900">Resumen actual</p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              {[
                ["actual", "Actual"],
                ["historico", "Histórico"],
                ["auditoria", "Auditoría"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVistaTab(id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    vistaTab === id
                      ? "bg-blue-600 text-white focus-visible:ring-2 focus-visible:ring-blue-300"
                      : "text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-blue-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cargo vigente</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {snapshotActual.hlcLabel}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Asignaciones vigentes
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">{snapshotActual.hlgLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vínculo técnico</p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {snapshotActual.hldLabel}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última actualización</p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {formatDateTime(snapshotActual.lastUpdate)}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">Consistencia</p>
            {snapshotActual.alertas.length === 0 ? (
              <div className="mt-2">
                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  OK · Sin alertas críticas
                </span>
              </div>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm text-amber-800">
                {snapshotActual.alertas.map((a) => (
                  <li
                    key={a}
                    className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                  >
                    Advertencia · {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTipoAlta("historial_laboral_cargos");
                setVistaTab("actual");
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Nuevo ciclo HLC
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoAlta("historial_laboral_grupos");
                setVistaTab("actual");
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Nuevo ciclo HLG
            </button>
            <button
              type="button"
              onClick={() => setVistaTab("historico")}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Ver histórico completo
            </button>
          </div>
        </Card>

        {vistaTab === "actual" && (
        <>
        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">
            Carga y edición laboral
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Completá la información por nivel de registro. Los campos seleccionables se cargan desde
            catálogos y colecciones operativas.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Criterio operativo: <span className="font-semibold">Cargo funcional</span> representa la
              función por normativa/designación formal, mientras que{" "}
              <span className="font-semibold">Función real</span> representa la función efectivamente
              ejercida.
              {modoAvanzado ? (
                <span>
                  {" "}Campos técnicos: <span className="font-semibold">cargo_funcional_id</span> y{" "}
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
          <form className="mt-4 space-y-4" onSubmit={onGuardarRegistro}>
            <LaboralFormCabeceraFields
              tipoAlta={tipoAlta}
              setTipoAlta={setTipoAlta}
              opcionesTipoAlta={OPCIONES_TIPO_ALTA}
              modoAvanzado={modoAvanzado}
              formData={formData}
              onChangeField={onChangeField}
              opcionesGrupos={opcionesGrupos}
              ayudaCampos={AYUDA_CAMPOS}
            />

            <LaboralFormModoEdicionFields
              modoEdicion={modoEdicion}
              modoAvanzado={modoAvanzado}
              formData={formData}
              registroEditId={registroEditId}
              setModoEdicion={setModoEdicion}
              setRegistroEditId={setRegistroEditId}
              registrosPorTipoFiltrados={registrosPorTipoFiltrados}
              registrosEdicionDetallados={registrosEdicionDetallados}
              cargarRegistroEnFormulario={cargarRegistroEnFormulario}
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
                opcionesCargoHlcDetalladas={opcionesCargoHlcDetalladas}
                opcionesRegimenHorario={opcionesRegimenHorario}
                opcionesCentroCosto={opcionesCentroCosto}
                opcionesFuncion={opcionesFuncion}
                cargaPorDiaRows={cargaPorDiaRows}
                onAddCargaRow={onAddCargaRow}
                onChangeCargaRow={onChangeCargaRow}
                onRemoveCargaRow={onRemoveCargaRow}
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

            {saveMsg && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  saveMsg.startsWith("Guardado correctamente")
                    ? "bg-emerald-50 text-emerald-700"
                    : saveMsg.startsWith("Guardado con advertencias:")
                      ? "bg-amber-50 text-amber-800"
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
                {saving ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Guardar registro"}
              </button>
            </div>
          </form>
        </Card>
        </>
        )}

        {(vistaTab === "actual" || vistaTab === "historico") && (
        <IntegridadReferencialCard
          totalAlertasIntegridad={totalAlertasIntegridad}
          hldSinCargo={hldSinCargo}
          hlcActivosSinGrupo={hlcActivosSinGrupo}
          hlgSinDato={hlgSinDato}
          hlcConGrupoInvalido={hlcConGrupoInvalido}
          hlcConEfectorDesignacionInvalido={hlcConEfectorDesignacionInvalido}
          hlcConEfectorCumplimientoInvalido={hlcConEfectorCumplimientoInvalido}
        />
        )}

        {vistaTab === "historico" && (
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
        )}

        {vistaTab === "historico" && (
        <VistaOperativaGrupoCard
          grupos={opcionesGrupos}
          grupoId={grupoVistaId}
          onGrupoIdChange={setGrupoVistaId}
          fechaCorte={grupoVistaFecha}
          onFechaCorteChange={setGrupoVistaFecha}
          items={vistaGrupoItems}
        />
        )}

        {vistaTab === "auditoria" && (
        <ColeccionesLaboralesCards
          loadingByCollection={loadingByCollection}
          progressByCollection={progressByCollection}
          durationByCollection={durationByCollection}
          errorByCollection={errorByCollection}
          rowsByCollection={rowsByCollection}
        />
        )}

        {vistaTab === "auditoria" && (
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
        )}
      </div>
    </div>
  );
}
