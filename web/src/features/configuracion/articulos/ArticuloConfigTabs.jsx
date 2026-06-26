import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import Card from "../../../components/ui/Card.jsx";
import { db } from "../../../config/firebase.js";
import { DEFAULT_CATALOGOS_ARTICULOS_FORM, useCatalogosArticulos } from "../../../hooks/useCatalogosArticulos.js";
import {
  artDocumentIdSchema,
  cfgArticuloVersionSchema,
  verDocumentIdSchema,
} from "../../../schemas/articulo.schema.js";
import {
  newArticuloDocumentId,
  newVersionDocumentId,
  saveArticuloVersionAndPunteroCore,
} from "../../../services/cfgArticuloVersionService.js";
import { CFG_UMA_DIAS, CFG_UMA_HORAS } from "./articuloComputoConstants.js";
import { syncUsaCalendarioInstitucionalEnTopes } from "../../../../../shared/utils/modoComputoCalendario.js";
import ImpactoSaldoTabSections from "./ImpactoSaldoTabSections.jsx";
import { EXPLICACIONES_OPCIONES, HELP_TEXTS, LABELS } from "./articuloLabels.js";
import { normalizeFechaCorteAntiguedadIso } from "./fecCorteAntiguedadHelpers.js";
import {
  DEFAULT_MES_DIA_APERTURA_LAO,
  DEFAULT_TSE_MINIMO_DIAS_LAO,
  normalizeMesDiaAperturaLao,
} from "./laoMotorConfigFields.js";
import { FieldCheck, FieldColor, FieldMultiSelect, FieldNumber, FieldPersonaSearch, FieldSelect, FieldText } from "./fieldWidgets.jsx";
import MatrizAntiguedadEditor from "./MatrizAntiguedadEditor.jsx";
import OpcionesConsumoSolicitudEditor from "./OpcionesConsumoSolicitudEditor.jsx";
import { opcionesConsumoTienenErroresUi } from "./opcionesConsumoSolicitudRowValidation.js";

/**
 * Estado inicial alineado a los campos de {@link cfgArticuloVersionSchema} (borrador UI).
 * Los `*_id` se completan con ids reales de Firestore al integrar catálogos.
 */
export function createEmptyArticuloVersionForm() {
  return {
    version_semantica: "0.1.0",
    estado_version_id: "",
    publicada_en: "",
    publicada_por_persona_id: "",
    bloque_identidad_naturaleza: {
      codigo: "",
      inciso_normativo: "",
      nombre: "",
      normativa_habilitante: { decreto: "", resolucion: "", interno_efector: "" },
      es_lao_anual: false,
      es_sancion: false,
      es_inasistencia: false,
      es_sin_goce: false,
      requiere_dictamen: false,
      es_licencia_medica: false,
      visualizacion: { codigo_grilla: "", color_ui: "" },
      fecha_desde: "",
      fecha_hasta: "",
    },
    bloque_impacto_economico: {
      justifica_sueldo_id: "",
      suma_para_sac: false,
      afecta_presentismo: false,
      acumula_reparto_obra_social: false,
      invalida_reparto_obra_social: false,
      suma_antiguedad_lao: false,
    },
    bloque_elegibilidad_filtros: {
      requiere_declaracion_familiar: false,
      edad_limite_familiar: "",
      escalafon_ids: [],
      agrupamiento_ids: [],
      tipo_vinculo_ids: [],
      cargo_funcional_ids: [],
      grupo_trabajo_ids: [],
      persona_ids: [],
      genero_ids: [],
      antiguedad_minima_meses: 0,
    },
    bloque_topes_plazos_computo: {
      regla_computo_dias_id: "",
      ambito_consumo_id: "",
      unidad_medida_id: "",
      unidad_minima_consumo_id: "",
      modulo_fraccionamiento_minutos: 15,
      fraccionamiento_habilitado: false,
      intervalo_gracia_dias: 0,
      regla_computo_horas_id: "",
      reinicio_ciclo_id: "",
      depende_rda: false,
      accion_saldo_id: "",
      multiplicador_valor: 1,
      origen_saldo_id: "",
      cupo_dias_por_ciclo: "",
      tope_frecuencia_mensual: "",
      tope_dias_por_evento: "",
      dias_minimos_por_evento: "",
      correspondencia_anio: "",
      fecha_corte_antiguedad: "",
      matriz_antiguedad_reglas: [],
      mes_dia_apertura_solicitudes: "",
      tse_minimo_dias_base: "",
      permite_calculo_proporcional_tse: true,
      nivel_ocupacion_dia_id: "",
      politica_superposicion_id: "",
    },
    bloque_acumulacion_sucesion: {
      caducidad_tipo_id: "",
      caducidad_limite_meses: "",
      permite_prorroga: false,
      prorroga_articulo_relacion_id: "",
      meses_arrastre: 0,
    },
    bloque_workflow_sla_cobertura: {
      circuito_ingreso_ids: [],
      plazo_preaviso_normativa_dias: "",
      plazo_preaviso_interno_dias: "",
      logistica_aviso_habilitada: false,
      toma_conocimiento_limitada: false,
      permite_retroactividad: false,
      requiere_toma_conocimiento_superior: false,
      niveles_burbujeo: "",
    },
    bloque_documentacion_convivencia: {
      requiere_adjunto_obligatorio: false,
      requiere_doc_previa: false,
      plazo_doc_previa_dias: "",
      requiere_doc_posterior: false,
      plazo_doc_posterior_dias: "",
      accion_incumplimiento_doc_id: "",
    },
    opciones_consumo_solicitud: [],
  };
}

function trimOrUndef(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? undefined : t;
  }
  return v;
}

function numOrUndef(v) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Ordena filas de matriz LAO por `valor_anos` ascendente (filas sin umbral válido al final).
 * @param {unknown[]} rows
 * @returns {unknown[]}
 */
export function sortMatrizAntiguedadReglas(rows) {
  const arr = Array.isArray(rows) ? [...rows] : [];
  arr.sort((a, b) => {
    const na = Number(a?.valor_anos);
    const nb = Number(b?.valor_anos);
    const va = a?.valor_anos === "" || a?.valor_anos === undefined || !Number.isFinite(na) ? null : na;
    const vb = b?.valor_anos === "" || b?.valor_anos === undefined || !Number.isFinite(nb) ? null : nb;
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return va - vb;
    const oa = String(a?.operador_id ?? "");
    const ob = String(b?.operador_id ?? "");
    return oa.localeCompare(ob);
  });
  return arr;
}

/**
 * Errores (bloquean guardado) y advertencias de coherencia de la matriz LAO.
 * @param {unknown[]} rows
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function analyzeMatrizAntiguedadReglas(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const complete = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || typeof r !== "object") continue;
    const op = trimOrUndef(r.operador_id);
    const rawVa = r.valor_anos;
    const n = Number(rawVa);
    if (!op || rawVa === "" || rawVa === undefined || !Number.isFinite(n) || n < 0) continue;
    complete.push({ fila: i + 1, operador_id: op, valor_anos: n });
  }
  const byPair = new Map();
  for (const x of complete) {
    const k = `${x.valor_anos}|${x.operador_id}`;
    if (!byPair.has(k)) byPair.set(k, []);
    byPair.get(k).push(x.fila);
  }
  const errors = [];
  for (const [, filas] of byPair) {
    if (filas.length > 1) {
      const u = [...new Set(filas)].sort((a, b) => a - b);
      errors.push(
        `Matriz LAO: filas ${u.join(", ")} repiten el mismo umbral (años) y el mismo operador. Unificá en una sola fila o cambiá operador/umbral.`,
      );
    }
  }
  const byVa = new Map();
  for (const x of complete) {
    if (!byVa.has(x.valor_anos)) byVa.set(x.valor_anos, new Set());
    byVa.get(x.valor_anos).add(x.operador_id);
  }
  const warnings = [];
  for (const [va, ops] of byVa) {
    if (ops.size > 1) {
      warnings.push(
        `Mismo umbral (${va} años) con distintos operadores en varias filas. El motor usa el último escalón cuya condición se cumple al recorrer la tabla en orden ascendente de años: revisá que el orden y los operadores reflejen la norma.`,
      );
    }
  }
  return { errors, warnings };
}

/**
 * Merge recursivo: vuelca datos de Firestore sobre la plantilla del form,
 * convirtiendo null/undefined a los defaults de la plantilla (strings vacíos, false, 0…).
 */
function mergeVersionToForm(template, data) {
  if (!data || typeof data !== "object") return { ...template };
  const result = {};
  for (const key of Object.keys(template)) {
    const tVal = template[key];
    const dVal = data[key];
    if (Array.isArray(tVal)) {
      result[key] = Array.isArray(dVal) ? dVal : tVal;
    } else if (tVal !== null && typeof tVal === "object") {
      result[key] = mergeVersionToForm(tVal, dVal);
    } else if (dVal === null || dVal === undefined) {
      result[key] = tVal;
    } else {
      result[key] = dVal;
    }
  }
  return result;
}

/**
 * Normaliza el estado del formulario antes de `cfgArticuloVersionSchema.safeParse`.
 * @param {ReturnType<typeof createEmptyArticuloVersionForm>} raw
 */
export function buildVersionPayloadForZod(raw) {
  const out = structuredClone(raw);
  out.publicada_en = trimOrUndef(out.publicada_en);
  out.publicada_por_persona_id = trimOrUndef(out.publicada_por_persona_id);
  out.bloque_identidad_naturaleza = { ...out.bloque_identidad_naturaleza };
  const nh = out.bloque_identidad_naturaleza.normativa_habilitante;
  const nhClean = {
    decreto: trimOrUndef(nh.decreto),
    resolucion: trimOrUndef(nh.resolucion),
    interno_efector: trimOrUndef(nh.interno_efector),
  };
  if (!nhClean.decreto && !nhClean.resolucion && !nhClean.interno_efector) {
    delete out.bloque_identidad_naturaleza.normativa_habilitante;
  } else {
    out.bloque_identidad_naturaleza.normativa_habilitante = nhClean;
  }
  const vis = out.bloque_identidad_naturaleza.visualizacion;
  const cg = trimOrUndef(vis?.codigo_grilla);
  const co = trimOrUndef(vis?.color_ui);
  if (!cg && !co) {
    delete out.bloque_identidad_naturaleza.visualizacion;
  } else {
    out.bloque_identidad_naturaleza.visualizacion = {
      ...(cg ? { codigo_grilla: cg } : {}),
      ...(co ? { color_ui: co } : {}),
    };
  }

  out.bloque_identidad_naturaleza.fecha_desde = trimOrUndef(out.bloque_identidad_naturaleza.fecha_desde);
  out.bloque_identidad_naturaleza.fecha_hasta = trimOrUndef(out.bloque_identidad_naturaleza.fecha_hasta);

  const edad = numOrUndef(out.bloque_elegibilidad_filtros.edad_limite_familiar);
  out.bloque_elegibilidad_filtros = {
    ...out.bloque_elegibilidad_filtros,
    edad_limite_familiar: edad === undefined ? undefined : edad,
  };

  const umId = trimOrUndef(out.bloque_topes_plazos_computo.unidad_medida_id);
  let reglaDias = trimOrUndef(out.bloque_topes_plazos_computo.regla_computo_dias_id);
  let rch = trimOrUndef(out.bloque_topes_plazos_computo.regla_computo_horas_id);
  const umcId = trimOrUndef(out.bloque_topes_plazos_computo.unidad_minima_consumo_id);
  let modFrac = Number(out.bloque_topes_plazos_computo.modulo_fraccionamiento_minutos);
  let intervaloGracia = Number(out.bloque_topes_plazos_computo.intervalo_gracia_dias) || 0;
  let fraccionamiento = out.bloque_topes_plazos_computo.fraccionamiento_habilitado === true;
  if (umId === CFG_UMA_DIAS) {
    rch = null;
    modFrac = 0;
  } else if (umId === CFG_UMA_HORAS) {
    reglaDias = null;
    intervaloGracia = 0;
    fraccionamiento = false;
  }
  const polSupId = trimOrUndef(out.bloque_topes_plazos_computo.politica_superposicion_id);
  const accionSaldoId = trimOrUndef(out.bloque_topes_plazos_computo.accion_saldo_id);
  let multRaw = Number(out.bloque_topes_plazos_computo.multiplicador_valor);
  if (!Number.isFinite(multRaw) || multRaw < 0.1) multRaw = 1;
  const horasConImpacto =
    umId === CFG_UMA_HORAS && accionSaldoId && accionSaldoId !== "cfg_as_neutro";
  const multiplicador_valor = horasConImpacto ? Math.min(10, Math.max(0.1, multRaw)) : 1;
  const diasMin = numOrUndef(out.bloque_topes_plazos_computo.dias_minimos_por_evento);
  out.bloque_topes_plazos_computo = {
    ...out.bloque_topes_plazos_computo,
    unidad_medida_id: umId,
    regla_computo_dias_id: reglaDias ?? null,
    regla_computo_horas_id: rch ?? null,
    unidad_minima_consumo_id: umcId,
    modulo_fraccionamiento_minutos: Number.isFinite(modFrac) && modFrac >= 0 ? modFrac : umId === CFG_UMA_HORAS ? 15 : 0,
    intervalo_gracia_dias: intervaloGracia,
    fraccionamiento_habilitado: fraccionamiento,
    politica_superposicion_id: polSupId,
    accion_saldo_id: accionSaldoId,
    multiplicador_valor,
    cupo_dias_por_ciclo: numOrUndef(out.bloque_topes_plazos_computo.cupo_dias_por_ciclo),
    tope_frecuencia_mensual: numOrUndef(out.bloque_topes_plazos_computo.tope_frecuencia_mensual),
    tope_dias_por_evento:
      umId === CFG_UMA_DIAS ? numOrUndef(out.bloque_topes_plazos_computo.tope_dias_por_evento) : null,
    dias_minimos_por_evento: umId === CFG_UMA_DIAS ? diasMin : null,
  };
  out.bloque_topes_plazos_computo = syncUsaCalendarioInstitucionalEnTopes(out.bloque_topes_plazos_computo);

  const esLao = out.bloque_identidad_naturaleza?.es_lao_anual === true;
  if (!esLao) {
    out.bloque_topes_plazos_computo.correspondencia_anio = null;
    out.bloque_topes_plazos_computo.fecha_corte_antiguedad = null;
    out.bloque_topes_plazos_computo.matriz_antiguedad_reglas = null;
    out.bloque_topes_plazos_computo.mes_dia_apertura_solicitudes = null;
    out.bloque_topes_plazos_computo.tse_minimo_dias_base = null;
    out.bloque_topes_plazos_computo.permite_calculo_proporcional_tse = null;
  } else {
    const corr = numOrUndef(out.bloque_topes_plazos_computo.correspondencia_anio);
    out.bloque_topes_plazos_computo.correspondencia_anio = corr === undefined ? null : corr;
    const fc = trimOrUndef(out.bloque_topes_plazos_computo.fecha_corte_antiguedad);
    if (fc === undefined) {
      out.bloque_topes_plazos_computo.fecha_corte_antiguedad = null;
    } else {
      const norm = normalizeFechaCorteAntiguedadIso(fc);
      out.bloque_topes_plazos_computo.fecha_corte_antiguedad = norm !== null ? norm : fc;
    }
    const rowsRaw = out.bloque_topes_plazos_computo.matriz_antiguedad_reglas;
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    const cleaned = rows
      .filter((r) => r && typeof r === "object" && trimOrUndef(r.operador_id))
      .map((r) => ({
        operador_id: String(trimOrUndef(r.operador_id)),
        valor_anos: Number(r.valor_anos),
        dias_otorgados: Number(r.dias_otorgados),
      }))
      .filter(
        (r) =>
          Number.isFinite(r.valor_anos) &&
          r.valor_anos >= 0 &&
          Number.isFinite(r.dias_otorgados) &&
          r.dias_otorgados >= 0,
      );
    const sortedClean = sortMatrizAntiguedadReglas(cleaned);
    out.bloque_topes_plazos_computo.matriz_antiguedad_reglas = sortedClean.length ? sortedClean : null;

    const mesDiaNorm = normalizeMesDiaAperturaLao(trimOrUndef(out.bloque_topes_plazos_computo.mes_dia_apertura_solicitudes));
    out.bloque_topes_plazos_computo.mes_dia_apertura_solicitudes =
      mesDiaNorm ?? DEFAULT_MES_DIA_APERTURA_LAO;

    const tseRaw = numOrUndef(out.bloque_topes_plazos_computo.tse_minimo_dias_base);
    out.bloque_topes_plazos_computo.tse_minimo_dias_base =
      tseRaw === undefined ? DEFAULT_TSE_MINIMO_DIAS_LAO : tseRaw;

    out.bloque_topes_plazos_computo.permite_calculo_proporcional_tse =
      out.bloque_topes_plazos_computo.permite_calculo_proporcional_tse !== false;
  }

  const pr = trimOrUndef(out.bloque_acumulacion_sucesion.prorroga_articulo_relacion_id);
  out.bloque_acumulacion_sucesion = {
    ...out.bloque_acumulacion_sucesion,
    prorroga_articulo_relacion_id: pr,
    caducidad_limite_meses: numOrUndef(out.bloque_acumulacion_sucesion.caducidad_limite_meses),
    meses_arrastre: Number(out.bloque_acumulacion_sucesion.meses_arrastre) || 0,
  };

  out.bloque_workflow_sla_cobertura = {
    ...out.bloque_workflow_sla_cobertura,
    plazo_preaviso_normativa_dias: numOrUndef(out.bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias),
    plazo_preaviso_interno_dias: numOrUndef(out.bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias),
  };
  delete out.bloque_workflow_sla_cobertura.niveles_burbujeo;

  out.bloque_documentacion_convivencia = {
    ...out.bloque_documentacion_convivencia,
    plazo_doc_previa_dias: numOrUndef(out.bloque_documentacion_convivencia.plazo_doc_previa_dias),
    plazo_doc_posterior_dias: numOrUndef(out.bloque_documentacion_convivencia.plazo_doc_posterior_dias),
  };

  const opcionesRaw = out.opciones_consumo_solicitud;
  if (!Array.isArray(opcionesRaw) || opcionesRaw.length === 0) {
    delete out.opciones_consumo_solicitud;
  } else {
    const cleaned = opcionesRaw
      .map((r) => {
        if (!r || typeof r !== "object") return null;
        const id = trimOrUndef(r.id);
        if (!id) return null;
        const etiqueta = String(r.etiqueta_ui ?? "").trim();
        const row = {
          id: String(id).toLowerCase(),
          etiqueta_ui: etiqueta || "Opción",
          dias_por_evento: Math.min(31, Math.max(1, Math.floor(Number(r.dias_por_evento)) || 1)),
          activo: r.activo !== false,
        };
        const sarh = trimOrUndef(r.codigo_sarh);
        if (sarh) row.codigo_sarh = sarh;
        const regla = trimOrUndef(r.regla_computo_id);
        if (regla) row.regla_computo_id = regla;
        return row;
      })
      .filter(Boolean);
    if (cleaned.length) out.opciones_consumo_solicitud = cleaned;
    else delete out.opciones_consumo_solicitud;
  }

  return out;
}

const TABS = [
  { id: "principal", label: "Configuración Principal" },
  { id: "saldo", label: "Impacto y Saldo" },
  { id: "avanzado", label: "Avanzado" },
];

/**
 * Panel principal — pestañas por bloque del documento de versión (`cfgArticuloVersionSchema`).
 * Filtros, roles y pasos viven en subcolecciones (§1.7); no se editan aquí.
 */
export default function ArticuloConfigTabs() {
  const { articuloId: routeArticuloId } = useParams();
  const [searchParams] = useSearchParams();
  const { loading: catalogosLoading, error: catalogosError, getOptions, refresh: refreshCatalogos } =
    useCatalogosArticulos(DEFAULT_CATALOGOS_ARTICULOS_FORM);
  const [tab, setTab] = useState("principal");
  const [form, setForm] = useState(createEmptyArticuloVersionForm);
  const [parseResult, setParseResult] = useState(null);
  const [articuloDocumentId, setArticuloDocumentId] = useState("");
  const [versionDocumentId, setVersionDocumentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const formBloqueadoPorCatalogos = catalogosLoading || Boolean(catalogosError);

  const operadorComparacionOptions = useMemo(() => getOptions("cfg_operador_comparacion"), [getOptions]);

  const matrizLaoFeedback = useMemo(() => {
    if (!form.bloque_identidad_naturaleza.es_lao_anual) {
      return { errors: [], warnings: [] };
    }
    return analyzeMatrizAntiguedadReglas(form.bloque_topes_plazos_computo.matriz_antiguedad_reglas || []);
  }, [form.bloque_identidad_naturaleza.es_lao_anual, form.bloque_topes_plazos_computo.matriz_antiguedad_reglas]);

  useEffect(() => {
    const raw = routeArticuloId === "nuevo" ? "" : routeArticuloId;
    const a = raw || searchParams.get("articuloId");
    const v = searchParams.get("versionId");
    if (typeof a === "string" && a.trim()) setArticuloDocumentId(a.trim());
    if (typeof v === "string" && v.trim()) setVersionDocumentId(v.trim());
  }, [routeArticuloId, searchParams]);

  useEffect(() => {
    const artOk = artDocumentIdSchema.safeParse(articuloDocumentId).success;
    const verOk = verDocumentIdSchema.safeParse(versionDocumentId).success;
    if (!artOk || !verOk) return;
    let cancelled = false;
    async function fetchVersion() {
      setLoadingVersion(true);
      try {
        const verRef = doc(db, "cfg_articulos", articuloDocumentId, "versiones", versionDocumentId);
        const snap = await getDoc(verRef);
        if (cancelled) return;
        if (snap.exists()) {
          const template = createEmptyArticuloVersionForm();
          setForm(mergeVersionToForm(template, snap.data()));
          toast.success("Versión cargada desde Firestore.");
        } else {
          toast("No se encontró el documento de versión. Se muestra formulario vacío.", { icon: "⚠️" });
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err?.code === "permission-denied"
            ? "Sin permiso para leer la versión. Verificá claims RRHH/admin."
            : err?.message || "Error al cargar la versión.";
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoadingVersion(false);
      }
    }
    fetchVersion();
    return () => { cancelled = true; };
  }, [articuloDocumentId, versionDocumentId]);

  const setRoot = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setBlock = useCallback((block, key, value) => {
    setForm((prev) => ({
      ...prev,
      [block]: { ...prev[block], [key]: value },
    }));
  }, []);

  const onUnidadMedidaChange = useCallback((v) => {
    setForm((prev) => {
      const prevUm = prev.bloque_topes_plazos_computo.unidad_medida_id;
      const topes = { ...prev.bloque_topes_plazos_computo, unidad_medida_id: v };
      if (v === CFG_UMA_DIAS) {
        topes.regla_computo_horas_id = "";
        topes.modulo_fraccionamiento_minutos = 0;
      } else if (v === CFG_UMA_HORAS) {
        topes.regla_computo_dias_id = "";
        topes.intervalo_gracia_dias = 0;
        topes.fraccionamiento_habilitado = false;
        topes.dias_minimos_por_evento = "";
      }
      if (prevUm && v && prevUm !== v) {
        queueMicrotask(() => {
          toast("Se limpiaron campos incompatibles con la nueva unidad.", { icon: "ℹ️" });
        });
      }
      return { ...prev, bloque_topes_plazos_computo: topes };
    });
  }, []);

  const setNested = useCallback((block, nested, key, value) => {
    setForm((prev) => ({
      ...prev,
      [block]: {
        ...prev[block],
        [nested]: { ...prev[block][nested], [key]: value },
      },
    }));
  }, []);

  const runVersionValidation = useCallback(() => {
    const payload = buildVersionPayloadForZod(form);
    return cfgArticuloVersionSchema.safeParse(payload);
  }, [form]);

  const validar = useCallback(() => {
    if (form.bloque_identidad_naturaleza.es_lao_anual) {
      const { errors: mxErr } = analyzeMatrizAntiguedadReglas(form.bloque_topes_plazos_computo.matriz_antiguedad_reglas || []);
      if (mxErr.length) {
        toast.error("La matriz LAO tiene filas duplicadas (mismo umbral en años y mismo operador).");
        setParseResult({
          success: false,
          error: {
            issues: mxErr.map((message) => ({
              path: ["bloque_topes_plazos_computo", "matriz_antiguedad_reglas"],
              message,
            })),
          },
        });
        return;
      }
    }
    setParseResult(runVersionValidation());
  }, [form, runVersionValidation]);

  const guardarEnFirestore = useCallback(async () => {
    const artTrim = articuloDocumentId.trim();
    const artR = artDocumentIdSchema.safeParse(artTrim);
    if (!artR.success) {
      toast.error("articulo_id inválido: debe ser art_ + ULID (Crockford base32, 26 caracteres).");
      return;
    }
    const verTrim = versionDocumentId.trim();
    const resolvedVersionId = verTrim || newVersionDocumentId();
    const verR = verDocumentIdSchema.safeParse(resolvedVersionId);
    if (!verR.success) {
      toast.error("version_id inválido: debe ser ver_ + ULID.");
      return;
    }
    if (form.bloque_identidad_naturaleza.es_lao_anual) {
      const { errors: mxErr } = analyzeMatrizAntiguedadReglas(form.bloque_topes_plazos_computo.matriz_antiguedad_reglas || []);
      if (mxErr.length) {
        toast.error("No se puede guardar: la matriz LAO tiene filas duplicadas (mismo umbral y operador).");
        setParseResult({
          success: false,
          error: {
            issues: mxErr.map((message) => ({
              path: ["bloque_topes_plazos_computo", "matriz_antiguedad_reglas"],
              message,
            })),
          },
        });
        return;
      }
    }
    const r = runVersionValidation();
    setParseResult(r);
    if (!r.success) {
      toast.error("Corregí los errores de validación antes de guardar.");
      return;
    }
    const t = toast.loading("Guardando versión y puntero en cfg_articulos…");
    try {
      setSaving(true);
      await saveArticuloVersionAndPunteroCore(artR.data, verR.data, r.data);
      if (!verTrim) {
        setVersionDocumentId(verR.data);
      }
      toast.success(
        "Versión guardada y version_actual_id actualizado en el núcleo (mismo lote atómico).",
        { id: t },
      );
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? err.code : "";
      const msg =
        code === "permission-denied"
          ? "Sin permiso en Firestore. Desplegá reglas (cfg_articulos + versiones) y claims RRHH/admin."
          : (err && err.message) || "No se pudo guardar.";
      toast.error(String(msg), { id: t });
    } finally {
      setSaving(false);
    }
  }, [articuloDocumentId, versionDocumentId, form, runVersionValidation]);

  const onSubmitFormulario = useCallback(
    (e) => {
      e.preventDefault();
      void guardarEnFirestore();
    },
    [guardarEnFirestore],
  );

  const issuesText = useMemo(() => {
    if (!parseResult || parseResult.success) return null;
    const issues = parseResult.error?.issues;
    if (!Array.isArray(issues)) return null;
    return issues.map((i) => `${(i.path && i.path.join(".")) || "(raíz)"}: ${i.message}`).join("\n");
  }, [parseResult]);

  const matrizBloqueaGuardar = form.bloque_identidad_naturaleza.es_lao_anual && matrizLaoFeedback.errors.length > 0;

  const opcionesBloqueaGuardar = useMemo(() => {
    const topeEvento = Number(form.bloque_topes_plazos_computo?.tope_dias_por_evento);
    const tope =
      Number.isFinite(topeEvento) && topeEvento > 0 ? Math.floor(topeEvento) : null;
    return opcionesConsumoTienenErroresUi(form.opciones_consumo_solicitud, tope);
  }, [form.opciones_consumo_solicitud, form.bloque_topes_plazos_computo?.tope_dias_por_evento]);

  return (
    <div className="space-y-6">
      {loadingVersion && (
        <Card className="border-blue-100 bg-blue-50/60 p-3 md:p-4">
          <p className="text-sm font-medium text-blue-900">Cargando versión del artículo…</p>
        </Card>
      )}
      {catalogosLoading && (
        <Card className="border-blue-100 bg-blue-50/60 p-3 md:p-4">
          <p className="text-sm font-medium text-blue-900">Cargando catálogos…</p>
        </Card>
      )}
      {catalogosError && (
        <Card className="border-amber-200 bg-amber-50 p-3 md:p-4">
          <p className="text-sm font-semibold text-amber-900">No se pudieron cargar los catálogos</p>
          <p className="mt-1 text-xs text-amber-950">{catalogosError.message}</p>
          <button
            type="button"
            onClick={() => refreshCatalogos()}
            className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950"
          >
            Reintentar carga
          </button>
        </Card>
      )}

      <Card className="p-4 md:p-5">
        <h2 className="text-lg font-semibold text-slate-900">Configuración del artículo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configurá los parámetros del artículo organizados por uso. Los cambios se guardan como una nueva versión.
        </p>
      </Card>

      <form className="contents" onSubmit={onSubmitFormulario} noValidate>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-0.5 md:flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "shrink-0 rounded-t-lg px-3 py-2 text-xs font-medium md:text-sm",
              tab === t.id ? "bg-white text-blue-700 ring-1 ring-slate-200 ring-b-0" : "text-slate-500 hover:bg-slate-100",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ PESTAÑA 1: CONFIGURACIÓN PRINCIPAL ═══════════════ */}
      {tab === "principal" && (
        <div className="space-y-6">
          {/* --- Sección: Versión e IDs --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Versión e identificadores</h3>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <FieldText
                  label={LABELS.articulo_id}
                  value={articuloDocumentId}
                  onChange={setArticuloDocumentId}
                  placeholder="art_01ARZ3NDEKTSV4RRFFQ69G5FAV"
                  helpText="Formato requerido: art_ + ULID (26 chars, mayúsculas)."
                />
                <FieldText
                  label={LABELS.version_id}
                  value={versionDocumentId}
                  onChange={setVersionDocumentId}
                  placeholder="ver_01ARZ3NDEKTSV4RRFFQ69G5FAV"
                  helpText="Opcional: si queda vacío, se genera uno al guardar."
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setArticuloDocumentId(newArticuloDocumentId())}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Generar art_*
                </button>
                <button
                  type="button"
                  onClick={() => setVersionDocumentId(newVersionDocumentId())}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Generar ver_*
                </button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldText label={LABELS.version_semantica} value={form.version_semantica} onChange={(v) => setRoot("version_semantica", v)} placeholder="1.0.0" helpText="Formato x.y.z (ej. 1.0.0)." required />
              <FieldSelect
                label={LABELS.estado_version_id}
                value={form.estado_version_id}
                onChange={(v) => setRoot("estado_version_id", v)}
                options={getOptions("cfg_estado_version_articulo")}
                disabled={formBloqueadoPorCatalogos}
                required
              />
              <FieldText label={LABELS.publicada_en} value={form.publicada_en} onChange={(v) => setRoot("publicada_en", v)} placeholder="2026-05-12T09:00:00Z" helpText="Completar solo cuando pase a publicada." required={false} />
              <FieldText label={LABELS.publicada_por_persona_id} value={form.publicada_por_persona_id} onChange={(v) => setRoot("publicada_por_persona_id", v)} placeholder="per_…" helpText="Persona que publica la versión." required={false} />
            </div>
          </Card>

          {/* --- Sección: Identidad --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Identidad del artículo</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldText label={LABELS.codigo} value={form.bloque_identidad_naturaleza.codigo} onChange={(v) => setBlock("bloque_identidad_naturaleza", "codigo", v)} helpText="Abreviatura visible en operación (ej. LAO, SAN)." required />
              <FieldText label={LABELS.inciso_normativo} value={form.bloque_identidad_naturaleza.inciso_normativo} onChange={(v) => setBlock("bloque_identidad_naturaleza", "inciso_normativo", v)} helpText="Referencia normativa (ej. Art. 14 inc. b)." required />
              <FieldText label={LABELS.nombre} value={form.bloque_identidad_naturaleza.nombre} onChange={(v) => setBlock("bloque_identidad_naturaleza", "nombre", v)} helpText="Nombre formal del artículo." className="md:col-span-2" required />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Normativa habilitante</p>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldText label={LABELS.decreto} value={form.bloque_identidad_naturaleza.normativa_habilitante.decreto} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "decreto", v)} helpText="Número/cita del decreto (si aplica)." required={false} />
                <FieldText label={LABELS.resolucion} value={form.bloque_identidad_naturaleza.normativa_habilitante.resolucion} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "resolucion", v)} helpText="Resolución complementaria." required={false} />
                <FieldText label={LABELS.interno_efector} value={form.bloque_identidad_naturaleza.normativa_habilitante.interno_efector} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "interno_efector", v)} helpText="Referencia interna del efector/hospital." className="md:col-span-2" required={false} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Naturaleza y clasificación</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldCheck
                  label={LABELS.es_lao_anual}
                  checked={form.bloque_identidad_naturaleza.es_lao_anual}
                  onChange={(v) => {
                    setForm((prev) => ({
                      ...prev,
                      bloque_identidad_naturaleza: { ...prev.bloque_identidad_naturaleza, es_lao_anual: v },
                      bloque_topes_plazos_computo: v
                        ? {
                            ...prev.bloque_topes_plazos_computo,
                            mes_dia_apertura_solicitudes:
                              prev.bloque_topes_plazos_computo.mes_dia_apertura_solicitudes || "",
                            tse_minimo_dias_base:
                              prev.bloque_topes_plazos_computo.tse_minimo_dias_base === "" ||
                              prev.bloque_topes_plazos_computo.tse_minimo_dias_base == null
                                ? ""
                                : prev.bloque_topes_plazos_computo.tse_minimo_dias_base,
                            permite_calculo_proporcional_tse:
                              prev.bloque_topes_plazos_computo.permite_calculo_proporcional_tse !== false,
                          }
                        : {
                            ...prev.bloque_topes_plazos_computo,
                            correspondencia_anio: "",
                            fecha_corte_antiguedad: "",
                            matriz_antiguedad_reglas: [],
                            mes_dia_apertura_solicitudes: "",
                            tse_minimo_dias_base: "",
                            permite_calculo_proporcional_tse: true,
                          },
                    }));
                  }}
                  helpText="Marca este artículo como Licencia Anual Ordinaria. Al activar esto, recordá configurar la Matriz de Antigüedad (aparece debajo) para que el sistema sepa cuántos días otorgar según los años de servicio del agente."
                />
                <FieldCheck label={LABELS.es_sancion} checked={form.bloque_identidad_naturaleza.es_sancion} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_sancion", v)} helpText="[¡IMPORTANTE!] Marca este artículo como sanción disciplinaria. Queda asentado en el legajo del agente y puede tener consecuencias gremiales y en la carrera administrativa. Verificá con el área legal antes de activar." />
                <FieldCheck label={LABELS.es_inasistencia} checked={form.bloque_identidad_naturaleza.es_inasistencia} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_inasistencia", v)} helpText="Se registra como inasistencia en los controles operativos. Puede afectar presentismo y otros indicadores." />
                <FieldCheck label={LABELS.es_sin_goce} checked={form.bloque_identidad_naturaleza.es_sin_goce} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_sin_goce", v)} helpText="[¡IMPORTANTE!] El agente no cobra haberes durante el período de esta licencia. Impacta directamente en la liquidación de sueldos y puede generar reclamos si se configura por error. Confirmá con Liquidaciones antes de activar." />
                <FieldCheck label={LABELS.requiere_dictamen} checked={form.bloque_identidad_naturaleza.requiere_dictamen} onChange={(v) => setBlock("bloque_identidad_naturaleza", "requiere_dictamen", v)} helpText="Pausa la solicitud para que un experto emita un dictamen antes de la aprobación final." />
                <FieldCheck
                  label={LABELS.es_licencia_medica}
                  checked={form.bloque_identidad_naturaleza.es_licencia_medica}
                  onChange={(v) => {
                    setBlock("bloque_identidad_naturaleza", "es_licencia_medica", v);
                    if (v && !form.bloque_documentacion_convivencia.requiere_adjunto_obligatorio) {
                      setBlock("bloque_documentacion_convivencia", "requiere_adjunto_obligatorio", true);
                      toast("Se activó 'Adjunto obligatorio' automáticamente por tratarse de una Licencia Médica.", { icon: "ℹ️", duration: 5000 });
                    }
                  }}
                  helpText="[¡IMPORTANTE!] Activa el protocolo de Caja Negra Médica: los datos clínicos de la solicitud serán visibles solo para el rol MÉDICO. RRHH y jefes verán únicamente el período y el estado, sin diagnóstico ni detalle médico. Al activar, se habilita automáticamente 'Adjunto obligatorio' en la pestaña Avanzado > Documentación."
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Visualización en grilla</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldText label={LABELS.codigo_grilla} value={form.bloque_identidad_naturaleza.visualizacion.codigo_grilla} onChange={(v) => setNested("bloque_identidad_naturaleza", "visualizacion", "codigo_grilla", v)} placeholder="14-0" helpText="Código corto en la celda de grilla mensual." required={false} />
                <FieldColor label={LABELS.color_ui} value={form.bloque_identidad_naturaleza.visualizacion.color_ui} onChange={(v) => setNested("bloque_identidad_naturaleza", "visualizacion", "color_ui", v)} required={false} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">Vigencia de la versión</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldText
                  label={LABELS.fecha_desde}
                  value={form.bloque_identidad_naturaleza.fecha_desde}
                  onChange={(v) => setBlock("bloque_identidad_naturaleza", "fecha_desde", v)}
                  placeholder="2026-01-01"
                  helpText="Inicio de vigencia."
                  required
                />
                <FieldText
                  label={LABELS.fecha_hasta}
                  value={form.bloque_identidad_naturaleza.fecha_hasta}
                  onChange={(v) => setBlock("bloque_identidad_naturaleza", "fecha_hasta", v)}
                  placeholder="2026-12-31"
                  helpText="Fin de vigencia. Vacío = sin cierre."
                  required={false}
                />
              </div>
              {form.bloque_identidad_naturaleza.fecha_hasta &&
                form.bloque_identidad_naturaleza.fecha_desde &&
                form.bloque_identidad_naturaleza.fecha_hasta < form.bloque_identidad_naturaleza.fecha_desde && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  La fecha de fin es anterior a la de inicio.
                </p>
              )}
            </div>
          </Card>

          {/* --- Sección: Impacto económico --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Impacto económico</h3>
            <p className="text-xs italic text-slate-500 mt-1 mb-4">
              Define cómo afecta este artículo al sueldo, presentismo y antigüedad para vacaciones durante el período otorgado.
            </p>
            <FieldSelect
              label={LABELS.justifica_sueldo_id}
              value={form.bloque_impacto_economico.justifica_sueldo_id}
              onChange={(v) => setBlock("bloque_impacto_economico", "justifica_sueldo_id", v)}
              options={getOptions("cfg_justifica_sueldo")}
              disabled={formBloqueadoPorCatalogos}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldCheck label={LABELS.suma_para_sac} checked={form.bloque_impacto_economico.suma_para_sac} onChange={(v) => setBlock("bloque_impacto_economico", "suma_para_sac", v)} helpText="Si se activa, los días de esta licencia cuentan para el cálculo del aguinaldo." />
              <FieldCheck label={LABELS.afecta_presentismo} checked={form.bloque_impacto_economico.afecta_presentismo} onChange={(v) => setBlock("bloque_impacto_economico", "afecta_presentismo", v)} helpText="[¡IMPORTANTE!] Si se activa, usar este artículo reduce o anula el premio por presentismo del mes. Es una de las configuraciones más consultadas por los gremios." />
              <FieldCheck
                label={LABELS.suma_antiguedad_lao}
                checked={form.bloque_impacto_economico.suma_antiguedad_lao}
                onChange={(v) => setBlock("bloque_impacto_economico", "suma_antiguedad_lao", v)}
                helpText={HELP_TEXTS.suma_antiguedad_lao}
                className="sm:col-span-2"
              />
            </div>
          </Card>

          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">
              Impacto en liquidación entre agentes por obras sociales (módulo específico)
            </h3>
            <p className="mt-1 mb-4 text-xs italic text-slate-500">
              Parámetros para el reparto y la acumulación de licencias en el módulo de obras sociales (cuando esté operativo).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldCheck
                label={LABELS.acumula_reparto_obra_social}
                checked={form.bloque_impacto_economico.acumula_reparto_obra_social}
                onChange={(v) => setBlock("bloque_impacto_economico", "acumula_reparto_obra_social", v)}
                helpText={HELP_TEXTS.acumula_reparto_obra_social}
              />
              <FieldCheck
                label={LABELS.invalida_reparto_obra_social}
                checked={form.bloque_impacto_economico.invalida_reparto_obra_social}
                onChange={(v) => setBlock("bloque_impacto_economico", "invalida_reparto_obra_social", v)}
                helpText={HELP_TEXTS.invalida_reparto_obra_social}
              />
            </div>
          </Card>

          {/* --- Sección: Elegibilidad --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Elegibilidad y filtros</h3>
            <p className="text-xs italic text-slate-500 mt-1 mb-4">Restringí a qué agentes aplica este artículo. Dejar vacío para que aplique a todos.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldCheck label={LABELS.requiere_declaracion_familiar} checked={form.bloque_elegibilidad_filtros.requiere_declaracion_familiar} onChange={(v) => setBlock("bloque_elegibilidad_filtros", "requiere_declaracion_familiar", v)} helpText="El agente debe declarar un familiar directo para acceder a este artículo." />
              <FieldNumber label={LABELS.edad_limite_familiar} value={form.bloque_elegibilidad_filtros.edad_limite_familiar} onChange={(v) => setBlock("bloque_elegibilidad_filtros", "edad_limite_familiar", v)} min={0} helpText="Edad tope en años; dejar vacío si no aplica." required={false} />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-3 text-xs font-semibold text-slate-500">Filtros por datos laborales</p>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldMultiSelect
                  label={LABELS.escalafon_ids}
                  value={form.bloque_elegibilidad_filtros.escalafon_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "escalafon_ids", v)}
                  options={getOptions("cfg_escalafon")}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los escalafones."
                />
                <FieldMultiSelect
                  label={LABELS.agrupamiento_ids}
                  value={form.bloque_elegibilidad_filtros.agrupamiento_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "agrupamiento_ids", v)}
                  options={getOptions("cfg_agrupamiento")}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los agrupamientos."
                />
                <FieldMultiSelect
                  label={LABELS.tipo_vinculo_ids}
                  value={form.bloque_elegibilidad_filtros.tipo_vinculo_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "tipo_vinculo_ids", v)}
                  options={getOptions("cfg_tipo_vinculo_laboral")}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los tipos de vínculo."
                />
                <FieldMultiSelect
                  label={LABELS.cargo_funcional_ids}
                  value={form.bloque_elegibilidad_filtros.cargo_funcional_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "cargo_funcional_ids", v)}
                  options={getOptions("cfg_cargo_funcional")}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los cargos."
                />
                <FieldMultiSelect
                  label={LABELS.grupo_trabajo_ids}
                  value={form.bloque_elegibilidad_filtros.grupo_trabajo_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "grupo_trabajo_ids", v)}
                  options={getOptions("grupos_de_trabajo")}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los grupos."
                />
                <FieldMultiSelect
                  label={LABELS.genero_ids}
                  value={form.bloque_elegibilidad_filtros.genero_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "genero_ids", v)}
                  options={getOptions("cfg_sexo_genero")}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los géneros."
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-3 text-xs font-semibold text-slate-500">Filtros por agente y antigüedad</p>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldPersonaSearch
                  label={LABELS.persona_ids}
                  value={form.bloque_elegibilidad_filtros.persona_ids}
                  onChange={(v) => setBlock("bloque_elegibilidad_filtros", "persona_ids", v)}
                  disabled={formBloqueadoPorCatalogos}
                  required={false}
                  helpText="Dejar vacío para que aplique a todos los agentes."
                />
                <FieldNumber
                  label={LABELS.antiguedad_minima_meses}
                  value={form.bloque_elegibilidad_filtros.antiguedad_minima_meses}
                  onChange={(v) => {
                    const n = typeof v === "number" ? v : parseInt(v, 10);
                    setBlock("bloque_elegibilidad_filtros", "antiguedad_minima_meses", Number.isFinite(n) && n >= 0 ? n : 0);
                  }}
                  min={0}
                  helpText="Meses de antigüedad necesarios para solicitar. Dejar en 0 para habilitar desde el primer día de ingreso."
                  required={false}
                />
              </div>
            </div>
          </Card>

          {/* --- Sección: Matriz LAO (condicional) --- */}
          {form.bloque_identidad_naturaleza.es_lao_anual ? (
            <MatrizAntiguedadEditor
              form={form}
              setForm={setForm}
              setBlock={setBlock}
              matrizLaoFeedback={matrizLaoFeedback}
              operadorComparacionOptions={operadorComparacionOptions}
              disabled={formBloqueadoPorCatalogos}
            />
          ) : null}
        </div>
      )}

      {/* ═══════════════ PESTAÑA 2: IMPACTO Y SALDO ═══════════════ */}
      {tab === "saldo" && (
        <ImpactoSaldoTabSections
          form={form}
          setBlock={setBlock}
          onUnidadMedidaChange={onUnidadMedidaChange}
          getOptions={getOptions}
          formBloqueadoPorCatalogos={formBloqueadoPorCatalogos}
          esLaoAnual={form.bloque_identidad_naturaleza.es_lao_anual}
        />
      )}

      {/* ═══════════════ PESTAÑA 3: AVANZADO ═══════════════ */}
      {tab === "avanzado" && (
        <div className="space-y-6">
          <OpcionesConsumoSolicitudEditor
            form={form}
            setForm={setForm}
            getOptions={getOptions}
            disabled={formBloqueadoPorCatalogos}
          />

          {/* --- Sección: Caducidad y arrastre --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Vencimiento y arrastre de saldo</h3>
            <p className="text-xs italic text-slate-500 mt-1 mb-4">Configura si los días no usados se pierden al terminar el ciclo, se acumulan indefinidamente o se pueden trasladar al período siguiente.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldSelect
                label={LABELS.caducidad_tipo_id}
                value={form.bloque_acumulacion_sucesion.caducidad_tipo_id}
                onChange={(v) => setBlock("bloque_acumulacion_sucesion", "caducidad_tipo_id", v)}
                options={getOptions("cfg_tipo_caducidad")}
                disabled={formBloqueadoPorCatalogos}
                required
                explicaciones={EXPLICACIONES_OPCIONES}
              />
              <FieldNumber label={LABELS.caducidad_limite_meses} value={form.bloque_acumulacion_sucesion.caducidad_limite_meses} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "caducidad_limite_meses", v)} min={0} helpText="Cantidad de meses antes de que el saldo no usado expire definitivamente." required={false} />
              <FieldNumber label={LABELS.meses_arrastre} value={form.bloque_acumulacion_sucesion.meses_arrastre} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "meses_arrastre", v)} min={0} helpText="Cuántos meses del saldo sobrante pueden trasladarse al ciclo siguiente." required={false} />
              <FieldText label={LABELS.prorroga_articulo_relacion_id} value={form.bloque_acumulacion_sucesion.prorroga_articulo_relacion_id} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "prorroga_articulo_relacion_id", v)} helpText="Identificador de relación (car_*) que vincula con el artículo de prórroga." required={false} />
            </div>
            <FieldCheck label={LABELS.permite_prorroga} checked={form.bloque_acumulacion_sucesion.permite_prorroga} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "permite_prorroga", v)} helpText="Habilita la posibilidad de extender el plazo original si el agente lo solicita." />
          </Card>

          {/* --- Sección: Workflow y preaviso --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Circuito de aprobación y preaviso</h3>
            <p className="text-xs italic text-slate-500 mt-1 mb-4">Define quién puede crear solicitudes, con cuánta anticipación deben pedirse y cómo fluye la aprobación en la cadena jerárquica.</p>
            <FieldMultiSelect
              label={LABELS.circuito_ingreso_ids}
              value={form.bloque_workflow_sla_cobertura.circuito_ingreso_ids}
              onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "circuito_ingreso_ids", v)}
              options={getOptions("cfg_rol")}
              disabled={formBloqueadoPorCatalogos}
              required
              placeholder="Elegí al menos un rol…"
              helpText="Definí qué roles de aplicación pueden crear una solicitud de este artículo. Debe haber al menos uno."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FieldNumber label={LABELS.plazo_preaviso_normativa_dias} value={form.bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "plazo_preaviso_normativa_dias", v)} min={0} helpText="Días mínimos que la norma exige de anticipación antes de tomar la licencia." required={false} />
              <FieldNumber label={LABELS.plazo_preaviso_interno_dias} value={form.bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "plazo_preaviso_interno_dias", v)} min={0} helpText="Anticipación operativa que el hospital define internamente para organizar la cobertura." required={false} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldCheck label={LABELS.logistica_aviso_habilitada} checked={form.bloque_workflow_sla_cobertura.logistica_aviso_habilitada} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "logistica_aviso_habilitada", v)} helpText="Identifica artículos que generan necesidad de cobertura. Activa la señal para que el sistema gestione avisos de reemplazo o contratación de personal (ej. Art. 16-0 o Tareas Diferentes)." />
              <FieldCheck label={LABELS.toma_conocimiento_limitada} checked={form.bloque_workflow_sla_cobertura.toma_conocimiento_limitada} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "toma_conocimiento_limitada", v)} helpText="Evita que la notificación de acuse escale por toda la cadena jerárquica, limitándola a los niveles inmediatos." />
              <FieldCheck label={LABELS.permite_retroactividad} checked={form.bloque_workflow_sla_cobertura.permite_retroactividad} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "permite_retroactividad", v)} helpText="Permite al usuario crear una solicitud con fecha de inicio anterior a hoy. Si se activa, el sistema ignorará los días de preaviso configurados arriba, siempre que el usuario firme una Declaración Jurada (DDJJ)." />
              <FieldCheck label={LABELS.requiere_toma_conocimiento_superior} checked={form.bloque_workflow_sla_cobertura.requiere_toma_conocimiento_superior} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "requiere_toma_conocimiento_superior", v)} helpText="Si está activo, la solicitud debe pasar por el superior jerárquico del servicio antes de llegar a RRHH. Si está desactivado, la solicitud va directo del jefe inmediato a RRHH." />
            </div>
            {form.bloque_workflow_sla_cobertura.toma_conocimiento_limitada && (
              <FieldNumber label={LABELS.niveles_burbujeo} value={form.bloque_workflow_sla_cobertura.niveles_burbujeo} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "niveles_burbujeo", v)} min={1} helpText="Define cuántos grupos hacia arriba reciben el aviso de toma de conocimiento de una solicitud." required={false} />
            )}
          </Card>

          {/* --- Sección: Documentación --- */}
          <Card className="space-y-4 p-4 shadow-sm md:p-6">
            <h3 className="text-sm font-semibold text-slate-700">Documentación y respaldos</h3>
            <p className="text-xs italic text-slate-500 mt-1 mb-4">Configura qué documentación se exige al agente (certificados, notas, constancias) y qué consecuencia tiene no presentarla a tiempo.</p>
            <FieldCheck
              label={LABELS.requiere_adjunto_obligatorio}
              checked={form.bloque_documentacion_convivencia.requiere_adjunto_obligatorio}
              onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_adjunto_obligatorio", v)}
              helpText="Si está activo, el sistema bloqueará el botón 'Enviar' si el agente no subió un PDF/Imagen. Ejemplo: El Art. 14 (Licencia Médica) DEBE tener esto activo porque exige certificado. El Art. 64-a (Particular) lo tiene desactivado."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FieldSelect
                label={LABELS.accion_incumplimiento_doc_id}
                value={form.bloque_documentacion_convivencia.accion_incumplimiento_doc_id}
                onChange={(v) => setBlock("bloque_documentacion_convivencia", "accion_incumplimiento_doc_id", v)}
                options={getOptions("cfg_accion_incumplimiento_documental")}
                disabled={formBloqueadoPorCatalogos}
                className="md:col-span-2"
                required
                helpText="Define la consecuencia si el agente no presenta la documentación en plazo."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldCheck label={LABELS.requiere_doc_previa} checked={form.bloque_documentacion_convivencia.requiere_doc_previa} onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_doc_previa", v)} helpText="El agente debe adjuntar documentación antes de que se apruebe la solicitud." />
              <FieldNumber label={LABELS.plazo_doc_previa_dias} value={form.bloque_documentacion_convivencia.plazo_doc_previa_dias} onChange={(v) => setBlock("bloque_documentacion_convivencia", "plazo_doc_previa_dias", v)} min={0} helpText="Días máximos para presentar la documentación previa." required={false} />
              <FieldCheck label={LABELS.requiere_doc_posterior} checked={form.bloque_documentacion_convivencia.requiere_doc_posterior} onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_doc_posterior", v)} helpText="El agente tiene un plazo posterior al uso para regularizar su documentación." />
              <FieldNumber label={LABELS.plazo_doc_posterior_dias} value={form.bloque_documentacion_convivencia.plazo_doc_posterior_dias} onChange={(v) => setBlock("bloque_documentacion_convivencia", "plazo_doc_posterior_dias", v)} min={0} helpText="Días posteriores al uso para presentar la documentación pendiente." required={false} />
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || formBloqueadoPorCatalogos || matrizBloqueaGuardar || opcionesBloqueaGuardar}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-50 md:hover:bg-emerald-700"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={validar}
          disabled={saving || formBloqueadoPorCatalogos}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-50 md:hover:bg-blue-700"
        >
          Validar
        </button>
        <button
          type="button"
          onClick={() => setForm(createEmptyArticuloVersionForm())}
          disabled={saving || formBloqueadoPorCatalogos}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Reiniciar borrador
        </button>
      </div>

      {parseResult && (
        <Card className={`p-4 ${parseResult.success ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/60"}`.trim()}>
          {parseResult.success ? (
            <p className="text-sm font-medium text-emerald-800">Validación correcta.</p>
          ) : (
            <div>
              <p className="text-sm font-semibold text-amber-900">Errores de validación</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-amber-950">{issuesText}</pre>
            </div>
          )}
        </Card>
      )}
      </form>
    </div>
  );
}
