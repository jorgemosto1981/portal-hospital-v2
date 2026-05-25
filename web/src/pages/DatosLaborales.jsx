import Card from "../components/ui/Card.jsx";
import {
  deshabilitarAsignacionHlg,
  deshabilitarCicloHlc,
  guardarRegistroLaboral,
} from "../services/datosLaboralesService.js";
import { callSyncSessionClaims } from "../services/callables.js";
import { useAuthSession } from "../features/auth/useAuthSession.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { INITIAL_FORM_DATA_LABORAL } from "./datos-laborales/constants.js";
import IntegridadReferencialCard from "./datos-laborales/sections/IntegridadReferencialCard.jsx";
import PersonaSearchSelect from "./datos-laborales/components/PersonaSearchSelect.jsx";
import LaboralCargosActivosCard from "./datos-laborales/sections/LaboralCargosActivosCard.jsx";
import LaboralFormularioModal from "./datos-laborales/sections/LaboralFormularioModal.jsx";
import LaboralCargosHistoricosCard from "./datos-laborales/sections/LaboralCargosHistoricosCard.jsx";
import LaboralModalesOperativos from "./datos-laborales/sections/LaboralModalesOperativos.jsx";
import { formatDateTime, formatFechaVisible } from "./datos-laborales/laboralDisplayFormat.js";
import { useLaboralSnapshots } from "./datos-laborales/useLaboralSnapshots.js";
import { useLaboralAnalisisOperativa } from "./datos-laborales/useLaboralAnalisisOperativa.js";
import TimelineLaboralPersonaCard from "./datos-laborales/sections/TimelineLaboralPersonaCard.jsx";
import VistaOperativaGrupoCard from "./datos-laborales/sections/VistaOperativaGrupoCard.jsx";
import { useDatosLaboralesCollections } from "./datos-laborales/useDatosLaboralesCollections.js";
import { buildFormDataFromRecord, validateLaboralForm } from "./datos-laborales/formLogic.js";
import { laboralCallableErrorMessage } from "./datos-laborales/callableErrorMessage.js";
import { buildHlcPayload, buildHldPayload, buildHlgPayload } from "./datos-laborales/payloadBuilders.js";
import LabeledSelect from "./datos-laborales/components/LabeledSelect.jsx";
import {
  crearIndicePorId,
  emptyCargaDia,
  labelDesdeIndice,
  normalizarWarnings,
  updateFormDataField,
  updateCargaPorDiaRow,
  addCargaPorDiaRow,
  removeCargaPorDiaRow,
  buildRegistrosEdicionDetallados,
  buildPlanillaCargaSemanal,
  obtenerYmdHoyInstitucional,
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  hlgVisibleEnPantalla,
} from "./datos-laborales/utils.js";

const EMPTY_ROWS = [];

const STORAGE_KEY_MODO_AVANZADO = "rrhh_datos_laborales_modo_avanzado_v1";

function planillaCargaInicial(opcionesDiaSemana) {
  const planilla = buildPlanillaCargaSemanal(opcionesDiaSemana, []);
  return planilla.length > 0 ? planilla : [emptyCargaDia()];
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
  const [searchParams] = useSearchParams();
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
  const [deshabilitarModalAbierto, setDeshabilitarModalAbierto] = useState(false);
  const [deshabilitando, setDeshabilitando] = useState(false);
  const [hlcDeshabilitarId, setHlcDeshabilitarId] = useState("");
  const [deshabilitarError, setDeshabilitarError] = useState("");
  const [deshabilitarForm, setDeshabilitarForm] = useState({
    motivo_id: "",
    fecha_corte: "",
    comentario: "",
    confirmar_impacto: false,
  });
  const [deshabilitarHlgModalAbierto, setDeshabilitarHlgModalAbierto] = useState(false);
  const [hlgDeshabilitarId, setHlgDeshabilitarId] = useState("");
  const [deshabilitarHlgError, setDeshabilitarHlgError] = useState("");
  const [deshabilitarHlgForm, setDeshabilitarHlgForm] = useState({
    motivo: "",
    fecha_corte: "",
    confirmar: false,
  });
  const { user: authUser } = useAuthSession();
  const planillaHlgCargadaRef = useRef("");
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

  useEffect(() => {
    const fromUrl = String(searchParams.get("persona_id") || "").trim();
    if (!/^per_/i.test(fromUrl)) return;
    setFormData((prev) => {
      if (String(prev.persona_id || "").trim() === fromUrl) return prev;
      return { ...prev, persona_id: fromUrl };
    });
  }, [searchParams]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoAvanzado, setModoAvanzado] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY_MODO_AVANZADO) === "1";
  });

  const hlcRows = rowsByCollection.historial_laboral_cargos ?? EMPTY_ROWS;
  const hldRows = rowsByCollection.historial_laboral_datos ?? EMPTY_ROWS;
  const hlgRows = rowsByCollection.historial_laboral_grupos ?? EMPTY_ROWS;
  /** Asignaciones dadas de baja (`activo: false`) no se listan en la UI operativa. */
  const hlgRowsVisibles = useMemo(
    () => hlgRows.filter((r) => hlgVisibleEnPantalla(r)),
    [hlgRows],
  );
  const idxEfectores = crearIndicePorId(rowsByCollection.cfg_efectores || []);
  const idxGrupos = crearIndicePorId(rowsByCollection.grupos_de_trabajo || []);
  const idxPersonas = crearIndicePorId(rowsByCollection.personas || []);
  const idxRoles = crearIndicePorId(rowsByCollection.cfg_rol || []);
  const idxFunciones = crearIndicePorId(rowsByCollection.cfg_cargo_funcional || []);
  const idxTipoVinculo = crearIndicePorId(rowsByCollection.cfg_tipo_vinculo_laboral || []);
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
  const opcionesMotivoDeshabilitacionHlc = rowsByCollection.cfg_motivo_deshabilitacion_hlc || [];
  const opcionesTipoActo = rowsByCollection.cfg_tipo_acto_designacion || [];
  const opcionesRegimenHorario = rowsByCollection.cfg_regimen_horario || [];
  const opcionesCentroCosto = rowsByCollection.cfg_centro_costo || [];
  const opcionesDiaSemana = rowsByCollection.cfg_dia_semana || [];

  async function refrescarClaimsSesion() {
    if (!authUser) return;
    try {
      await callSyncSessionClaims();
      await authUser.getIdToken(true);
    } catch {
      // No bloquear flujo laboral si falla la actualización del token.
    }
  }
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
      vigencia: `Desde ${formatFechaVisible(hlcFechaDesdeYmd(cargo))} · ${
        hlcFechaHastaYmd(cargo) ? formatFechaVisible(hlcFechaHastaYmd(cargo)) : "Vigente"
      }`,
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
  const registrosPorTipo = useMemo(() => {
    const raw = rowsByCollection[tipoAlta] ?? EMPTY_ROWS;
    if (tipoAlta === "historial_laboral_grupos") {
      return raw.filter((r) => hlgVisibleEnPantalla(r));
    }
    return raw;
  }, [rowsByCollection, tipoAlta]);
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
  const { snapshotActual, snapshotHistorico } = useLaboralSnapshots({
    personaId: formData.persona_id,
    hlcRows,
    hldRows,
    hlgRowsVisibles,
    idxHld,
    idxFunciones,
    idxEfectores,
    idxGrupos,
    idxRoles,
    idxTipoVinculo,
    idxEscalafon,
    idxAgrupamiento,
    idxCategorias,
  });
  const {
    timelineItemsBase,
    timelineItems,
    timelineResumen,
    vistaGrupoItems,
    hldSinCargo,
    hlgSinDato,
    hlcConGrupoInvalido,
    hlcConEfectorDesignacionInvalido,
    hlcConEfectorCumplimientoInvalido,
    totalAlertasIntegridad,
    hlcActivosSinGrupo,
  } = useLaboralAnalisisOperativa({
    hlcRows,
    hldRows,
    hlgRowsVisibles,
    idxHlc,
    idxHld,
    idxGrupos,
    idxEfectores,
    idxPersonas,
    idxRoles,
    idxFunciones,
    timelinePersonaId,
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
    grupoVistaId,
    grupoVistaFecha,
  });

  const errorValidacionFormulario = useMemo(
    () =>
      validateLaboralForm({
        tipoAlta,
        formData,
        cargaPorDiaRows,
        idxHlc,
      }),
    [tipoAlta, formData, cargaPorDiaRows, idxHlc],
  );
  const puedeGuardarFormulario = !errorValidacionFormulario;

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

  function abrirModalDeshabilitarHlc(hlcId) {
    const target = hlcRows.find((r) => String(r.id || "") === String(hlcId || ""));
    if (!target) return;
    setHlcDeshabilitarId(String(target.id));
    setDeshabilitarError("");
    setDeshabilitarForm({
      motivo_id: "",
      fecha_corte: obtenerYmdHoyInstitucional(),
      comentario: "",
      confirmar_impacto: false,
    });
    setDeshabilitarModalAbierto(true);
  }

  function cerrarModalDeshabilitarHlc() {
    if (deshabilitando) return;
    setDeshabilitarModalAbierto(false);
    setHlcDeshabilitarId("");
    setDeshabilitarError("");
  }

  async function confirmarDeshabilitacionHlc() {
    const motivoId = String(deshabilitarForm.motivo_id || "").trim();
    const fechaCorte = String(deshabilitarForm.fecha_corte || "").trim();
    const comentario = String(deshabilitarForm.comentario || "").trim();
    if (!hlcDeshabilitarId) {
      setDeshabilitarError("No se encontró el ciclo HLC a deshabilitar.");
      return;
    }
    if (!motivoId) {
      setDeshabilitarError("Debés seleccionar un motivo de deshabilitación.");
      return;
    }
    if (!deshabilitarForm.confirmar_impacto) {
      setDeshabilitarError("Debés confirmar el impacto para continuar.");
      return;
    }
    if (fechaCorte && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) {
      setDeshabilitarError("La fecha de corte es inválida. Usá el formato AAAA-MM-DD.");
      return;
    }
    setDeshabilitarError("");
    setDeshabilitando(true);
    try {
      const payload = {
        hlc_id: hlcDeshabilitarId,
        motivo_deshabilitacion_id: motivoId,
      };
      if (fechaCorte) payload.fecha_corte = fechaCorte;
      if (comentario) payload.comentario = comentario;
      const r = await deshabilitarCicloHlc(payload);
      const warnings = normalizarWarnings(r && r.warnings);
      const resumen = r && r.resumen && typeof r.resumen === "object" ? r.resumen : {};
      const hldAfectados = Number.isFinite(Number(resumen.hld_afectados)) ? Number(resumen.hld_afectados) : 0;
      const hlgAfectados = Number.isFinite(Number(resumen.hlg_afectados)) ? Number(resumen.hlg_afectados) : 0;
      const fechaAplicadaRaw = String((r && r.fecha_corte_aplicada) || fechaCorte || "hoy");
      const fechaAplicada =
        fechaAplicadaRaw === "hoy" ? "hoy" : formatFechaVisible(fechaAplicadaRaw, fechaAplicadaRaw);
      const baseMsg =
        `Ciclo deshabilitado correctamente. HLd afectados: ${hldAfectados}. ` +
        `HLg afectados: ${hlgAfectados}. Fecha de corte: ${fechaAplicada}.`;
      const finalMsg =
        warnings.length === 0
          ? baseMsg
          : `${baseMsg} Observaciones: ${warnings
              .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
              .join(" | ")}`;
      await refrescarClaimsSesion();
      await cargarTodo();
      setDeshabilitarModalAbierto(false);
      setHlcDeshabilitarId("");
      setResultadoModalMsg(finalMsg);
      setResultadoModalAbierto(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo deshabilitar el ciclo.";
      setDeshabilitarError(msg);
    } finally {
      setDeshabilitando(false);
    }
  }

  function abrirModalDeshabilitarHlg(hlgId) {
    const target = hlgRows.find((r) => String(r.id || "") === String(hlgId || ""));
    if (!target) return;
    setHlgDeshabilitarId(String(target.id));
    setDeshabilitarHlgError("");
    setDeshabilitarHlgForm({
      motivo: "",
      fecha_corte: obtenerYmdHoyInstitucional(),
      confirmar: false,
    });
    setDeshabilitarHlgModalAbierto(true);
  }

  function cerrarModalDeshabilitarHlg() {
    if (deshabilitando) return;
    setDeshabilitarHlgModalAbierto(false);
    setHlgDeshabilitarId("");
    setDeshabilitarHlgError("");
  }

  async function confirmarDeshabilitacionHlg() {
    const motivo = String(deshabilitarHlgForm.motivo || "").trim();
    const fechaCorte = String(deshabilitarHlgForm.fecha_corte || "").trim();
    if (!hlgDeshabilitarId) {
      setDeshabilitarHlgError("No se encontró la asignación HLg a deshabilitar.");
      return;
    }
    if (!deshabilitarHlgForm.confirmar) {
      setDeshabilitarHlgError("Debés confirmar la deshabilitación para continuar.");
      return;
    }
    if (motivo.length > 100) {
      setDeshabilitarHlgError("El motivo no puede superar los 100 caracteres.");
      return;
    }
    if (fechaCorte && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) {
      setDeshabilitarHlgError("La fecha de corte es inválida. Usá el formato AAAA-MM-DD.");
      return;
    }
    setDeshabilitarHlgError("");
    setDeshabilitando(true);
    try {
      const payload = { hlg_id: hlgDeshabilitarId };
      if (fechaCorte) payload.fecha_corte = fechaCorte;
      if (motivo) payload.motivo = motivo;
      const r = await deshabilitarAsignacionHlg(payload);
      const warnings = normalizarWarnings(r && r.warnings);
      const fechaAplicadaRaw = String((r && r.fecha_corte_aplicada) || fechaCorte || "hoy");
      const fechaAplicada =
        fechaAplicadaRaw === "hoy" ? "hoy" : formatFechaVisible(fechaAplicadaRaw, fechaAplicadaRaw);
      const baseMsg = `Asignación deshabilitada correctamente. Fecha de corte: ${fechaAplicada}.`;
      const finalMsg =
        warnings.length === 0
          ? baseMsg
          : `${baseMsg} Observaciones: ${warnings
              .map((w) => (w.code ? `${w.code}: ${w.message}` : w.message))
              .join(" | ")}`;
      await refrescarClaimsSesion();
      await cargarTodo();
      setDeshabilitarHlgModalAbierto(false);
      setHlgDeshabilitarId("");
      setResultadoModalMsg(finalMsg);
      setResultadoModalAbierto(true);
    } catch (err) {
      setDeshabilitarHlgError(
        laboralCallableErrorMessage(err, "No se pudo deshabilitar la asignación."),
      );
    } finally {
      setDeshabilitando(false);
    }
  }

  function cerrarFlujoFormularioManteniendoPersona() {
    const personaId = String(formData.persona_id || "").trim();
    setModoEdicion(false);
    setRegistroEditId("");
    setTipoAlta("historial_laboral_cargos");
    setCargaPorDiaRows(planillaCargaInicial(opcionesDiaSemana));
    setFormData({
      ...INITIAL_FORM_DATA_LABORAL,
      persona_id: personaId,
    });
    setMostrarFormulario(false);
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
    setMostrarFormulario(true);
  }

  function abrirFormularioEdicionHlg(hlgId) {
    const target = hlgRows.find((r) => String(r.id || "") === String(hlgId || ""));
    if (!target) return;
    planillaHlgCargadaRef.current = "";
    setTipoAlta("historial_laboral_grupos");
    setModoEdicion(true);
    setModoAvanzado(false);
    setRegistroEditId(String(target.id));
    cargarRegistroEnFormulario(target);
    setMostrarFormulario(true);
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
      regimen_fecha_ancla: "",
      centro_costo_id: "",
      funcion_real_id: "",
      nivel_jerarquico: "",
    }));
    setCargaPorDiaRows(planillaCargaInicial(opcionesDiaSemana));
    setMostrarFormulario(true);
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

  /** Solo al cambiar tipo de alta (selector); no resetear mientras se edita un registro. */
  useEffect(() => {
    if (modoEdicion) return;
    setRegistroEditId("");
    if (tipoAlta === "historial_laboral_grupos") {
      setCargaPorDiaRows(planillaCargaInicial(opcionesDiaSemana));
    } else {
      setCargaPorDiaRows([emptyCargaDia()]);
    }
  }, [tipoAlta, opcionesDiaSemana, modoEdicion]);

  /** Si el catálogo de días llega después de abrir edición HLg, rehidratar planilla desde Firestore. */
  useEffect(() => {
    if (!modoEdicion || tipoAlta !== "historial_laboral_grupos" || !registroEditId) return;
    if (!opcionesDiaSemana.length) return;
    const key = `${registroEditId}:${opcionesDiaSemana.length}`;
    if (planillaHlgCargadaRef.current === key) return;
    const full = hlgRows.find((r) => String(r.id) === String(registroEditId));
    if (!full) return;
    planillaHlgCargadaRef.current = key;
    setCargaPorDiaRows(buildPlanillaCargaSemanal(opcionesDiaSemana, full.carga_por_dia_semana));
  }, [modoEdicion, tipoAlta, registroEditId, opcionesDiaSemana, hlgRows]);

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
    if (tipoAlta === "historial_laboral_grupos") {
      const exists = hlgRows.some((r) => String(r.id) === String(registroEditId));
      if (!exists) setRegistroEditId("");
      return;
    }
    const exists = registrosPorTipoFiltrados.some((r) => String(r.id) === String(registroEditId));
    if (!exists) {
      setRegistroEditId("");
    }
  }, [modoEdicion, registroEditId, registrosPorTipoFiltrados, tipoAlta, hlgRows]);

  function cargarRegistroEnFormulario(record) {
    const next = buildFormDataFromRecord({
      record,
      idxHld,
      prevFormData: formData,
      opcionesDiaSemana,
    });
    if (!next) return;
    setFormData(next.formData);
    setCargaPorDiaRows(next.cargaPorDiaRows);
  }

  async function onGuardarRegistro(e) {
    e.preventDefault();
    setSaveMsg("");
    if (errorValidacionFormulario) {
      setSaveMsg(errorValidacionFormulario);
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
        const hldIdExistente = String(formData.dato_laboral_id || "").trim();
        const payloadHld = buildHldPayload({ formData, modoEdicion, registroEditId });
        const hld = await guardarRegistroLaboral("historial_laboral_datos", payloadHld);
        warnings = warnings.concat(normalizarWarnings(hld && hld.warnings));
        const hldIdParaHlg =
          hldIdExistente || (hld && typeof hld.id === "string" ? hld.id : "") || "";
        const payloadHlg = buildHlgPayload({
          formData,
          hldId: hldIdParaHlg,
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
      await refrescarClaimsSesion();
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
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Nuevo ciclo HLC
            </button>
          </div>
        </Card>

        <LaboralCargosActivosCard
          snapshotActual={snapshotActual}
          modoAvanzado={modoAvanzado}
          ultimaActualizacionTexto={formatDateTime(snapshotActual.lastUpdate)}
          onEditarHlg={abrirFormularioEdicionHlg}
          onDeshabilitarHlg={abrirModalDeshabilitarHlg}
          onNuevoHlgEnHlc={abrirFormularioNuevoHlgEnHlc}
          onEditarHlc={abrirFormularioEdicionHlc}
          onDeshabilitarHlc={abrirModalDeshabilitarHlc}
        />

        <LaboralCargosHistoricosCard
          snapshotHistorico={snapshotHistorico}
          onEditarHlg={abrirFormularioEdicionHlg}
          onEditarHlc={abrirFormularioEdicionHlc}
          onDeshabilitarHlc={abrirModalDeshabilitarHlc}
        />

        {mostrarFormulario ? (
          <LaboralFormularioModal
            tipoAlta={tipoAlta}
            setTipoAlta={setTipoAlta}
            modoAvanzado={modoAvanzado}
            setModoAvanzado={setModoAvanzado}
            modoEdicion={modoEdicion}
            formData={formData}
            onChangeField={onChangeField}
            cargaPorDiaRows={cargaPorDiaRows}
            onChangeCargaRow={onChangeCargaRow}
            accionFormularioLabel={accionFormularioLabel}
            personaActivaLabel={personaActivaLabel}
            cargoContexto={cargoContexto}
            opcionesGrupos={opcionesGrupos}
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
            opcionesRegimenHorario={opcionesRegimenHorario}
            opcionesCentroCosto={opcionesCentroCosto}
            opcionesDiaSemana={opcionesDiaSemana}
            opcionesCausalFinAsignacion={opcionesCausalFinAsignacion}
            errorValidacionFormulario={errorValidacionFormulario}
            saveMsg={saveMsg}
            saving={saving}
            puedeGuardarFormulario={puedeGuardarFormulario}
            onSubmit={onGuardarRegistro}
            onCancelar={cerrarFlujoFormularioManteniendoPersona}
          />
        ) : null}

        {!mostrarFormulario && (
        <Card className="px-4 py-4 md:px-5">
          <p className="text-base font-semibold text-slate-900">Acción laboral</p>
          <p className="mt-1 text-sm text-slate-600">
            Seleccioná una acción desde las tarjetas: crear período de cargo, crear nuevo grupo o editar el grupo/cargo seleccionado.
          </p>
        </Card>
        )}

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

        <LaboralModalesOperativos
          deshabilitarModalAbierto={deshabilitarModalAbierto}
          deshabilitarForm={deshabilitarForm}
          setDeshabilitarForm={setDeshabilitarForm}
          opcionesMotivoDeshabilitacionHlc={opcionesMotivoDeshabilitacionHlc}
          deshabilitarError={deshabilitarError}
          deshabilitando={deshabilitando}
          cerrarModalDeshabilitarHlc={cerrarModalDeshabilitarHlc}
          confirmarDeshabilitacionHlc={confirmarDeshabilitacionHlc}
          deshabilitarHlgModalAbierto={deshabilitarHlgModalAbierto}
          deshabilitarHlgForm={deshabilitarHlgForm}
          setDeshabilitarHlgForm={setDeshabilitarHlgForm}
          deshabilitarHlgError={deshabilitarHlgError}
          cerrarModalDeshabilitarHlg={cerrarModalDeshabilitarHlg}
          confirmarDeshabilitacionHlg={confirmarDeshabilitacionHlg}
          resultadoModalAbierto={resultadoModalAbierto}
          resultadoModalMsg={resultadoModalMsg}
          setResultadoModalAbierto={setResultadoModalAbierto}
          cerrarFlujoFormularioManteniendoPersona={cerrarFlujoFormularioManteniendoPersona}
        />
        </>
        ) : null}
      </div>
    </div>
  );
}
