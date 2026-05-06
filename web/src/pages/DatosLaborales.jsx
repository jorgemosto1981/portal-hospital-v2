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

function sumarHorasSemana(cargaPorDiaSemana) {
  if (!Array.isArray(cargaPorDiaSemana)) return 0;
  return cargaPorDiaSemana.reduce((acc, row) => {
    const horas = Number(row && typeof row === "object" ? row.horas : row);
    return Number.isFinite(horas) ? acc + horas : acc;
  }, 0);
}

function scrollToForm() {
  if (typeof document === "undefined") return;
  const tryScroll = (retries = 6) => {
    const el = document.getElementById("form-laboral");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (retries <= 0) return;
    window.setTimeout(() => tryScroll(retries - 1), 80);
  };
  // Espera a que React pinte el formulario visible antes de desplazar.
  window.requestAnimationFrame(() => tryScroll());
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
  const [resultadoModalAbierto, setResultadoModalAbierto] = useState(false);
  const [resultadoModalMsg, setResultadoModalMsg] = useState("");
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
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
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
  const idxEscalafon = crearIndicePorId(rowsByCollection.cfg_escalafon || []);
  const idxAgrupamiento = crearIndicePorId(rowsByCollection.cfg_agrupamiento || []);
  const idxCategorias = crearIndicePorId(rowsByCollection.cfg_categorias || []);
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
  const personaSeleccionada = String(formData.persona_id || "").trim().length > 0;
  const personaActiva = useMemo(() => {
    const personaId = String(formData.persona_id || "").trim();
    if (!personaId) return null;
    return idxPersonas.get(personaId) || null;
  }, [formData.persona_id, idxPersonas]);
  const personaActivaLabel = useMemo(() => {
    if (!personaActiva) return String(formData.persona_id || "").trim();
    const nombre = `${String(personaActiva.apellido || "").trim()} ${String(personaActiva.nombre || "").trim()}`.trim();
    const dni = String(personaActiva.dni || "").trim() || "—";
    return `${nombre || "Persona"} · DNI ${dni} · ${String(personaActiva.id || formData.persona_id || "")}`;
  }, [personaActiva, formData.persona_id]);
  const cargoContexto = useMemo(() => {
    let cargoId = "";
    if (tipoAlta === "historial_laboral_grupos") {
      cargoId = String(formData.cargo_id || "").trim();
    } else if (tipoAlta === "historial_laboral_cargos" && modoEdicion) {
      cargoId = String(registroEditId || "").trim();
    }
    if (!cargoId) return null;
    const cargo = idxHlc.get(cargoId);
    if (!cargo) return null;
    return {
      titulo: `${labelDesdeIndice(idxFunciones, cargo.cargo_funcional_id)} · ${labelDesdeIndice(
        idxEfectores,
        cargo.efector_cumplimiento_id,
      )}`,
      rol: labelDesdeIndice(idxRoles, cargo.rol_id),
      escalafon: labelDesdeIndice(idxEscalafon, cargo.escalafon_id),
      agrupamiento: labelDesdeIndice(idxAgrupamiento, cargo.agrupamiento_id),
      categoria: labelDesdeIndice(idxCategorias, cargo.categoria_id),
      funcion: labelDesdeIndice(idxFunciones, cargo.cargo_funcional_id),
      cargaHoraria: String(cargo.carga_horaria_total || "—"),
      vigencia: `Desde ${String(cargo.fecha_desde || "—")} · ${String(cargo.fecha_hasta || "Vigente")}`,
    };
  }, [
    tipoAlta,
    modoEdicion,
    registroEditId,
    formData.cargo_id,
    idxHlc,
    idxFunciones,
    idxEfectores,
    idxRoles,
    idxEscalafon,
    idxAgrupamiento,
    idxCategorias,
  ]);
  const accionFormularioLabel = useMemo(() => {
    if (tipoAlta === "historial_laboral_cargos") {
      return modoEdicion ? "Editar período de cargo" : "Nuevo período de cargo";
    }
    return modoEdicion ? "Editar este grupo" : "Crear nuevo grupo";
  }, [tipoAlta, modoEdicion]);
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
        bloquesVigentes: [],
        totalHlcPersona: 0,
        tieneHistorico: false,
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
    const hlcCerrados = hlcPersona.filter((r) => !isVigenteByFecha(r));
    const merged = [...hlcPersona, ...hlgPersona, ...hldPersona];
    const lastUpdate = merged
      .map((r) => r.actualizado_en || r.creado_en || null)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0] || null;
    const alertas = [];
    if (hlcVigentes.length > 1) alertas.push("Más de un HLC vigente");
    if (hlcVigentes.length === 0 && hlgVigentes.length > 0) alertas.push("HLG vigente sin HLC vigente");
    if (hldVigentes.length === 0 && hlgVigentes.length > 0) alertas.push("HLG vigente sin HLD vigente");

    const hldByCargo = hldPersona.reduce((acc, hld) => {
      const cargoId = String(hld.cargo_id || "").trim();
      if (!cargoId) return acc;
      if (!acc.has(cargoId)) acc.set(cargoId, []);
      acc.get(cargoId).push(hld);
      return acc;
    }, new Map());

    const bloquesVigentes = hlcVigentes
      .slice()
      .sort((a, b) => String(b.fecha_desde || "").localeCompare(String(a.fecha_desde || "")))
      .map((hlc) => {
        const hldAsociados = hldByCargo.get(String(hlc.id || "")) || [];
        const hldAsociadosIds = new Set(hldAsociados.map((row) => String(row.id || "")));
        const hlgAsociados = hlgPersona.filter((r) => hldAsociadosIds.has(String(r.dato_laboral_id || "")));
        const hlgVigDelHlc = hlgAsociados.filter(isVigenteByFecha);
        const hlgHistDelHlc = hlgAsociados.filter((r) => !isVigenteByFecha(r));
        const hldRelacionado =
          hlgVigDelHlc
            .map((r) => idxHld.get(String(r.dato_laboral_id || "")))
            .find(Boolean) || null;
        const tituloHlc = `${labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id)} · ${labelDesdeIndice(
          idxEfectores,
          hlc.efector_cumplimiento_id,
        )}`;
        const mapHlg = (r) => {
          const hldRef = idxHld.get(String(r.dato_laboral_id || "")) || null;
          const cargaHorariaGrupo = sumarHorasSemana(r.carga_por_dia_semana);
          const warningHlg = [];
          if (cargaHorariaGrupo <= 0) warningHlg.push("Sin carga horaria asignada al grupo.");
          if (!hldRef || !hldRef.funcion_real_id) warningHlg.push("Sin función real asociada.");
          return {
            id: String(r.id || ""),
            grupo: labelDesdeIndice(idxGrupos, r.grupo_de_trabajo_id),
            funcion: labelDesdeIndice(idxFunciones, hldRef && hldRef.funcion_real_id),
            periodo: `Desde ${String(r.fecha_inicio || "—")} · ${String(r.fecha_fin || "Vigente")}`,
            cargaHorariaGrupo: cargaHorariaGrupo > 0 ? cargaHorariaGrupo : 0,
            warningHlg,
          };
        };
        const vigenciaHlc = `Desde ${String(hlc.fecha_desde || "—")} · ${String(hlc.fecha_hasta || "Vigente")}`;
        const hldLabel = hldRelacionado
          ? `Vigente desde ${String(hldRelacionado.fecha_desde || hldRelacionado.fecha_inicio || "—")}`
          : "Sin vínculo HLD vigente";
        const totalCargaHlg = hlgVigDelHlc.reduce((acc, row) => acc + sumarHorasSemana(row.carga_por_dia_semana), 0);
        const warningsHlc = [];
        const cargaHlcNum = Number(hlc.carga_horaria_total);
        if (hlgVigDelHlc.length === 0) warningsHlc.push("Cargo vigente sin asignación vigente a grupo de trabajo.");
        if (Number.isFinite(cargaHlcNum) && hlgVigDelHlc.length > 0 && Math.abs(totalCargaHlg - cargaHlcNum) > 0.01) {
          warningsHlc.push(`Carga horaria inconsistente: HLC ${cargaHlcNum} hs vs HLG ${totalCargaHlg} hs.`);
        }
        return {
          id: String(hlc.id || ""),
          hlcId: String(hlc.id || ""),
          rolHlc: labelDesdeIndice(idxRoles, hlc.rol_id),
          escalafon: labelDesdeIndice(idxEscalafon, hlc.escalafon_id),
          agrupamiento: labelDesdeIndice(idxAgrupamiento, hlc.agrupamiento_id),
          categoria: labelDesdeIndice(idxCategorias, hlc.categoria_id),
          funcion: labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id),
          cargaHoraria: String(hlc.carga_horaria_total || "—"),
          tituloHlc,
          vigenciaHlc,
          hlgVigentes: hlgVigDelHlc.map(mapHlg),
          hlgHistoricos: hlgHistDelHlc.map(mapHlg),
          hldLabel,
          warningsHlc,
        };
      });

    return {
      bloquesVigentes,
      totalHlcPersona: hlcPersona.length,
      tieneHistorico: hlcCerrados.length > 0,
      lastUpdate,
      alertas,
    };
  }, [
    formData.persona_id,
    hlcRows,
    hlgRows,
    hldRows,
    idxHld,
    idxFunciones,
    idxEfectores,
    idxGrupos,
    idxRoles,
    idxEscalafon,
    idxAgrupamiento,
    idxCategorias,
  ]);
  const snapshotHistorico = useMemo(() => {
    const personaId = String(formData.persona_id || "").trim();
    if (!personaId) return [];
    const hlcCerrados = hlcRows
      .filter((r) => String(r.persona_id || "") === personaId)
      .filter((r) => !isVigenteByFecha(r))
      .slice()
      .sort((a, b) => String(b.fecha_hasta || "").localeCompare(String(a.fecha_hasta || "")));
    return hlcCerrados.map((hlc, idx) => {
      const hldDelPeriodo = hldRows.filter(
        (r) =>
          String(r.persona_id || "") === personaId && String(r.cargo_id || "") === String(hlc.id || ""),
      );
      const hldDelPeriodoIds = new Set(hldDelPeriodo.map((row) => String(row.id || "")));
      const hlgDelPeriodo = hlgRows.filter(
        (r) =>
          String(r.persona_id || "") === personaId &&
          hldDelPeriodoIds.has(String(r.dato_laboral_id || "")),
      );
      const hlgVigDelHlc = hlgDelPeriodo.filter(isVigenteByFecha);
      const hlgHistDelHlc = hlgDelPeriodo.filter((r) => !isVigenteByFecha(r));
      const mapHlg = (r) => {
        const hldRef = idxHld.get(String(r.dato_laboral_id || "")) || null;
        const cargaHorariaGrupo = sumarHorasSemana(r.carga_por_dia_semana);
        return {
          id: String(r.id || ""),
          grupo: labelDesdeIndice(idxGrupos, r.grupo_de_trabajo_id),
          funcion: labelDesdeIndice(idxFunciones, hldRef && hldRef.funcion_real_id),
          periodo: `Desde ${String(r.fecha_inicio || "—")} · ${String(r.fecha_fin || "Vigente")}`,
          cargaHorariaGrupo: cargaHorariaGrupo > 0 ? cargaHorariaGrupo : 0,
        };
      };
      const titulo = `${labelDesdeIndice(idxFunciones, hlc.cargo_funcional_id)} · ${labelDesdeIndice(
        idxEfectores,
        hlc.efector_cumplimiento_id,
      )}`;
      const periodo = `Desde ${String(hlc.fecha_desde || "—")} · Hasta ${String(hlc.fecha_hasta || "—")}`;
      return {
        id: String(hlc.id || `hlc-cerrado-${idx}`),
        hlcId: String(hlc.id || ""),
        rolHlc: labelDesdeIndice(idxRoles, hlc.rol_id),
        orden: idx + 1,
        titulo,
        periodo,
        asignaciones: hlgDelPeriodo.length,
        hlgVigentes: hlgVigDelHlc.map(mapHlg),
        hlgHistoricos: hlgHistDelHlc.map(mapHlg),
      };
    });
  }, [formData.persona_id, hlcRows, hldRows, hlgRows, idxHld, idxFunciones, idxEfectores, idxGrupos, idxRoles]);
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

  function cerrarFlujoFormularioManteniendoPersona() {
    const personaId = String(formData.persona_id || "").trim();
    setModoEdicion(false);
    setRegistroEditId("");
    setTipoAlta("historial_laboral_cargos");
    setCargaPorDiaRows([emptyCargaDia()]);
    setFormData({
      ...INITIAL_FORM_DATA_LABORAL,
      persona_id: personaId,
    });
    setMostrarFormulario(false);
    setVistaTab("actual");
    setSaveMsg("");
  }

  function abrirFormularioEdicionHlc(hlcId) {
    const target = hlcRows.find((r) => String(r.id || "") === String(hlcId || ""));
    if (!target) return;
    setTipoAlta("historial_laboral_cargos");
    setModoEdicion(true);
    setModoAvanzado(false);
    setRegistroEditId(String(target.id));
    cargarRegistroEnFormulario(target);
    setVistaTab("actual");
    setMostrarFormulario(true);
    scrollToForm();
  }

  function abrirFormularioEdicionHlg(hlgId) {
    const target = hlgRows.find((r) => String(r.id || "") === String(hlgId || ""));
    if (!target) return;
    setTipoAlta("historial_laboral_grupos");
    setModoEdicion(true);
    setModoAvanzado(false);
    setRegistroEditId(String(target.id));
    cargarRegistroEnFormulario(target);
    setVistaTab("actual");
    setMostrarFormulario(true);
    scrollToForm();
  }

  function abrirFormularioNuevoHlgEnHlc(hlcId) {
    const targetHlc = hlcRows.find((r) => String(r.id || "") === String(hlcId || ""));
    if (!targetHlc) return;
    setTipoAlta("historial_laboral_grupos");
    setModoEdicion(false);
    setModoAvanzado(false);
    setRegistroEditId("");
    setSaveMsg("");
    setFormData((prev) => ({
      ...prev,
      persona_id: String(targetHlc.persona_id || prev.persona_id || ""),
      cargo_id: String(targetHlc.id || ""),
      grupo_de_trabajo_id: "",
      regimen_horario_id: "",
      centro_costo_id: "",
      funcion_real_id: "",
      nivel_jerarquico: "",
    }));
    setCargaPorDiaRows([emptyCargaDia()]);
    setVistaTab("actual");
    setMostrarFormulario(true);
    scrollToForm();
  }

  function abrirEdicionDesdeTimeline(item) {
    if (!item || !item.id) return;
    if (item.tipo === "HLc") {
      const target = hlcRows.find((x) => String(x.id) === String(item.id));
      if (!target) return;
      setTipoAlta("historial_laboral_cargos");
      setModoEdicion(true);
      setModoAvanzado(false);
      setRegistroEditId(String(target.id));
      cargarRegistroEnFormulario(target);
      return;
    }
    if (item.tipo === "HLg") {
      const target = hlgRows.find((x) => String(x.id) === String(item.id));
      if (!target) return;
      setTipoAlta("historial_laboral_grupos");
      setModoEdicion(true);
      setModoAvanzado(false);
      setRegistroEditId(String(target.id));
      cargarRegistroEnFormulario(target);
      return;
    }
    const hlgVinculado = hlgRows.find((x) => String(x.dato_laboral_id || "") === String(item.id));
    if (!hlgVinculado) return;
    setTipoAlta("historial_laboral_grupos");
    setModoEdicion(true);
    setModoAvanzado(false);
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
      idxHlc,
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
        setResultadoModalMsg(baseOk);
      } else {
        const detalleWarnings = warnings
          .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
          .join(" | ");
        const advertenciaMsg = `Guardado con advertencias: ${detalleWarnings}`;
        setSaveMsg(advertenciaMsg);
        setResultadoModalMsg(advertenciaMsg);
      }
      await cargarTodo();
      setResultadoModalAbierto(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido.";
      const errorMsg = `No se pudo guardar: ${msg}`;
      setSaveMsg(errorMsg);
      setResultadoModalMsg(errorMsg);
      setResultadoModalAbierto(true);
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

        <Card className="px-4 py-4 md:px-5" id="form-laboral">
          <PersonaSearchSelect
            personaId={formData.persona_id}
            setPersonaId={(value) => onChangeField("persona_id", value)}
            personaOptions={opcionesPersonasSearch}
            modoAvanzado={modoAvanzado}
          />
        </Card>

        {personaSeleccionada ? (
        <>
        <Card className="px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Persona activa</p>
              <p className="text-sm font-semibold text-slate-900">{personaActivaLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setTipoAlta("historial_laboral_cargos");
                setModoEdicion(false);
                setModoAvanzado(false);
                setRegistroEditId("");
                setMostrarFormulario(true);
                setVistaTab("actual");
                scrollToForm();
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Nuevo ciclo HLC
            </button>
          </div>
        </Card>

        <Card className="px-4 py-4 md:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-slate-900">Resumen actual</p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              {[
                ["actual", "Actual"],
                ["historico", "Histórico"],
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
          <div className="grid gap-3 md:grid-cols-2">
            {snapshotActual.bloquesVigentes.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {snapshotActual.totalHlcPersona === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">Esta persona no tiene cargos registrados</p>
                    <p className="mt-1 text-sm text-slate-600">
                      No existen períodos de cargo vigentes ni históricos para la persona seleccionada.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-900">No hay período de cargo vigente</p>
                    <p className="mt-1 text-sm text-slate-600">
                      La persona tiene cargos registrados, pero ninguno vigente en este momento.
                    </p>
                  </>
                )}
              </div>
            ) : (
              snapshotActual.bloquesVigentes.map((bloque, idx) => (
                <div key={bloque.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Ciclo {idx + 1}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Período de cargo vigente
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{bloque.tituloHlc}</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    <li>- Rol asignado: {bloque.rolHlc || "—"}</li>
                    <li>- Escalafón: {bloque.escalafon || "—"}</li>
                    <li>- Agrupamiento: {bloque.agrupamiento || "—"}</li>
                    <li>- Categoría: {bloque.categoria || "—"}</li>
                    <li>- Función: {bloque.funcion || "—"}</li>
                    <li>- Carga horaria: {bloque.cargaHoraria || "—"}</li>
                    <li>- {bloque.vigenciaHlc}</li>
                  </ul>
                  {bloque.warningsHlc.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {bloque.warningsHlc.map((warning) => (
                        <span
                          key={`${bloque.id}-${warning}`}
                          className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                        >
                          Advertencia · {warning}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Períodos de asignación a grupos de trabajo vigentes ({bloque.hlgVigentes.length})
                    </p>
                    {bloque.hlgVigentes.length === 0 ? (
                      <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Inconsistencia: cargo sin asignación a grupo de trabajo
                      </span>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {bloque.hlgVigentes.map((hlg) => (
                          <div key={hlg.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                            <p className="text-sm font-semibold text-slate-900">{hlg.grupo} · {hlg.funcion}</p>
                            <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                              <li>- {hlg.periodo}</li>
                              <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                            </ul>
                            {hlg.warningHlg.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {hlg.warningHlg.map((warning) => (
                                  <span
                                    key={`${hlg.id}-${warning}`}
                                    className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                                  >
                                    {warning}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => abrirFormularioEdicionHlg(hlg.id)}
                              className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                              Editar este grupo
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => abrirFormularioNuevoHlgEnHlc(bloque.hlcId)}
                        className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                      >
                        Crear nuevo grupo
                      </button>
                    </div>
                  </div>
                  {bloque.hlgHistoricos.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Períodos de asignación a grupos de trabajo históricos ({bloque.hlgHistoricos.length})
                      </p>
                      <div className="mt-2 space-y-2">
                        {bloque.hlgHistoricos.map((hlg) => (
                          <div key={hlg.id} className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2">
                            <p className="text-sm font-semibold text-slate-900">{hlg.grupo} · {hlg.funcion}</p>
                            <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                              <li>- {hlg.periodo}</li>
                              <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                            </ul>
                            <button
                              type="button"
                              onClick={() => abrirFormularioEdicionHlg(hlg.id)}
                              className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                              Editar este grupo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-600">{bloque.hldLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => abrirFormularioEdicionHlc(bloque.hlcId)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                    >
                      Editar período de cargo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-1 text-xs text-slate-500">Última actualización: {formatDateTime(snapshotActual.lastUpdate)}</p>
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
        </Card>

        {vistaTab === "historico" && (
        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Períodos de cargo cerrados</p>
          {snapshotHistorico.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Sin períodos cerrados para la persona seleccionada.</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {snapshotHistorico.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-300 bg-slate-50 p-3">
                  <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Ciclo {item.orden}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Período de cargo cerrado</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{item.titulo}</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    <li>- Rol asignado: {item.rolHlc || "—"}</li>
                    <li>- {item.periodo}</li>
                    <li>- Períodos de asignación a grupos de trabajo: {item.asignaciones}</li>
                  </ul>
                  {item.hlgVigentes.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Períodos de asignación a grupos de trabajo vigentes ({item.hlgVigentes.length})
                      </p>
                      <div className="mt-2 space-y-2">
                        {item.hlgVigentes.map((hlg) => (
                          <div key={hlg.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                            <p className="text-sm font-semibold text-slate-900">{hlg.grupo} · {hlg.funcion}</p>
                            <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                              <li>- {hlg.periodo}</li>
                              <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                            </ul>
                            <button
                              type="button"
                              onClick={() => abrirFormularioEdicionHlg(hlg.id)}
                              className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                              Editar este grupo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {item.hlgHistoricos.length > 0 ? (
                    <div className="mt-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Períodos de asignación a grupos de trabajo históricos ({item.hlgHistoricos.length})
                      </p>
                      <div className="mt-2 space-y-2">
                        {item.hlgHistoricos.map((hlg) => (
                          <div key={hlg.id} className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2">
                            <p className="text-sm font-semibold text-slate-900">{hlg.grupo} · {hlg.funcion}</p>
                            <ul className="mt-0.5 space-y-1 text-xs text-slate-600">
                              <li>- {hlg.periodo}</li>
                              <li>- Carga horaria: {hlg.cargaHorariaGrupo} hs/semana</li>
                            </ul>
                            <button
                              type="button"
                              onClick={() => abrirFormularioEdicionHlg(hlg.id)}
                              className="mt-2 h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                              Editar este grupo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => abrirFormularioEdicionHlc(item.hlcId)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                    >
                      Editar período de cargo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}

        {vistaTab === "actual" && mostrarFormulario && (
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
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto de la acción</p>
            <p className="mt-1 text-sm font-semibold text-blue-700">{accionFormularioLabel}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{personaActivaLabel}</p>
            {cargoContexto ? (
              <div className="mt-1 text-xs text-slate-700">
                <p className="font-semibold">Período de cargo seleccionado</p>
                <p>{cargoContexto.titulo}</p>
                <p>Rol asignado: {cargoContexto.rol || "—"}</p>
                <p>Escalafón: {cargoContexto.escalafon || "—"} · Agrupamiento: {cargoContexto.agrupamiento || "—"}</p>
                <p>
                  Categoría: {cargoContexto.categoria || "—"} · Función: {cargoContexto.funcion || "—"} · Carga horaria:{" "}
                  {cargoContexto.cargaHoraria}
                </p>
                <p>{cargoContexto.vigencia}</p>
              </div>
            ) : null}
          </div>
          <form className="mt-4 space-y-4" onSubmit={onGuardarRegistro}>
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

        {vistaTab === "actual" && !mostrarFormulario && (
        <Card className="px-4 py-4 md:px-5" id="form-laboral">
          <p className="text-base font-semibold text-slate-900">Acción laboral</p>
          <p className="mt-1 text-sm text-slate-600">
            Seleccioná una acción desde las tarjetas: crear período de cargo, crear nuevo grupo o editar el grupo/cargo seleccionado.
          </p>
        </Card>
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


        {resultadoModalAbierto ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:p-5">
              <p className="text-base font-semibold text-slate-900">Resultado de la operación</p>
              <p
                className={`mt-3 max-h-[40vh] overflow-y-auto rounded-lg px-3 py-2 text-sm ${
                  resultadoModalMsg.startsWith("Guardado correctamente")
                    ? "bg-emerald-50 text-emerald-700"
                    : resultadoModalMsg.startsWith("Guardado con advertencias:")
                      ? "bg-amber-50 text-amber-800"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {resultadoModalMsg}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const fueGuardado =
                      resultadoModalMsg.startsWith("Guardado correctamente") ||
                      resultadoModalMsg.startsWith("Guardado con advertencias:");
                    setResultadoModalAbierto(false);
                    if (fueGuardado) cerrarFlujoFormularioManteniendoPersona();
                  }}
                  className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </>
        ) : null}
      </div>
    </div>
  );
}
