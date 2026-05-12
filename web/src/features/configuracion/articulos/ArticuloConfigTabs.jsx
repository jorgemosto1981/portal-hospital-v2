import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";

import Card from "../../../components/ui/Card.jsx";
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
import FechaCorteAntiguedadDiaMesField from "./FechaCorteAntiguedadDiaMesField.jsx";
import { normalizeFechaCorteAntiguedadIso } from "./fecCorteAntiguedadHelpers.js";

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
      visualizacion: { codigo_grilla: "", color_ui: "" },
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
    },
    bloque_topes_plazos_computo: {
      regla_computo_dias_id: "",
      ambito_consumo_id: "",
      fraccionamiento_habilitado: false,
      intervalo_gracia_dias: 0,
      regla_computo_horas_id: "",
      reinicio_ciclo_id: "",
      depende_rda: false,
      accion_saldo_id: "",
      origen_saldo_id: "",
      correspondencia_anio: "",
      fecha_corte_antiguedad: "",
      matriz_antiguedad_reglas: [],
    },
    bloque_acumulacion_sucesion: {
      caducidad_tipo_id: "",
      caducidad_limite_meses: "",
      permite_prorroga: false,
      prorroga_articulo_relacion_id: "",
      meses_arrastre: 0,
    },
    bloque_workflow_sla_cobertura: {
      plazo_preaviso_normativa_dias: "",
      plazo_preaviso_interno_dias: "",
      logistica_aviso_habilitada: false,
      toma_conocimiento_limitada: false,
    },
    bloque_documentacion_convivencia: {
      requiere_doc_previa: false,
      plazo_doc_previa_dias: "",
      requiere_doc_posterior: false,
      plazo_doc_posterior_dias: "",
      accion_incumplimiento_doc_id: "",
      nivel_ocupacion_dia_id: "",
    },
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

  const edad = numOrUndef(out.bloque_elegibilidad_filtros.edad_limite_familiar);
  out.bloque_elegibilidad_filtros = {
    ...out.bloque_elegibilidad_filtros,
    edad_limite_familiar: edad === undefined ? undefined : edad,
  };

  const rch = trimOrUndef(out.bloque_topes_plazos_computo.regla_computo_horas_id);
  out.bloque_topes_plazos_computo = {
    ...out.bloque_topes_plazos_computo,
    regla_computo_horas_id: rch,
  };

  const esLao = out.bloque_identidad_naturaleza?.es_lao_anual === true;
  if (!esLao) {
    out.bloque_topes_plazos_computo.correspondencia_anio = null;
    out.bloque_topes_plazos_computo.fecha_corte_antiguedad = null;
    out.bloque_topes_plazos_computo.matriz_antiguedad_reglas = null;
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

  out.bloque_documentacion_convivencia = {
    ...out.bloque_documentacion_convivencia,
    plazo_doc_previa_dias: numOrUndef(out.bloque_documentacion_convivencia.plazo_doc_previa_dias),
    plazo_doc_posterior_dias: numOrUndef(out.bloque_documentacion_convivencia.plazo_doc_posterior_dias),
  };

  return out;
}

function FieldText({ label, value, onChange, placeholder, inputMode, helpText, className = "" }) {
  return (
    <label className={`block space-y-1 ${className}`.trim()}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2"
      />
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

function FieldNumber({ label, value, onChange, min = 0, helpText }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        value={value === "" ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2"
      />
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

function FieldCheck({ label, checked, onChange, helpText, className = "" }) {
  return (
    <label className={`block cursor-pointer rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 ${className}`.trim()}>
      <span className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        <span className="text-sm text-slate-800">{label}</span>
      </span>
      {helpText ? <span className="mt-1 block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

function FieldSelect({ label, value, onChange, options, disabled, placeholder = "Elegí una opción…", helpText, className = "", omitLabel = false }) {
  return (
    <label className={`block space-y-1 ${className}`.trim()}>
      {!omitLabel ? <span className="text-xs font-medium text-slate-600">{label}</span> : null}
      <select
        aria-label={omitLabel ? label : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} title={o.descripcion || undefined}>
            {o.label}
          </option>
        ))}
      </select>
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

const TABS = [
  { id: "meta", label: "Versión" },
  { id: "identidad", label: "Identidad" },
  { id: "impacto", label: "Impacto" },
  { id: "elegibilidad", label: "Elegibilidad" },
  { id: "topes", label: "Topes / cómputo" },
  { id: "acumulacion", label: "Acumulación" },
  { id: "workflow", label: "Workflow / SLA" },
  { id: "documentacion", label: "Documentación" },
];

const TAB_HELP = {
  meta: [
    "IDs: usar prefijos art_ y ver_ (ULID en mayúsculas Crockford, 26 caracteres).",
    "version_semantica: formato x.y.z (ej. 1.0.0).",
    "publicada_en: ISO 8601 (ej. 2026-05-12T09:00:00Z) o vacío si sigue en borrador.",
  ],
  identidad: [
    "codigo: abreviatura humana del artículo (ej. LAO, SAN, SGH).",
    "inciso_normativo: referencia corta de norma (ej. Art. 14 inc. b).",
    "color_ui: HEX #RRGGBB (ej. #3366CC) para la grilla.",
  ],
  impacto: [
    "justifica_sueldo_id: referenciar id de catálogo cfg_* (no texto libre).",
    "Checks en true/false determinan impacto en liquidación y presentismo.",
  ],
  elegibilidad: [
    "edad_limite_familiar: entero >= 0; dejar vacío si no aplica.",
    "Filtros múltiples (roles/escalafones/etc.) se cargan en subcolecciones.",
  ],
  topes: [
    "Todos los *_id deben apuntar a catálogos cfg_* vigentes.",
    "intervalo_gracia_dias: entero >= 0.",
    "depende_rda=true exige validación preventiva en backend.",
    "LAO (solo si es_lao_anual en Identidad): correspondencia_anio = año fiscal del derecho; matriz con operador_id → cfg_operador_comparacion; fecha_corte_antiguedad: día/mes en UI, ISO canónica al guardar o vacío → null (motor §7).",
    "Matriz LAO: las filas se reordenan solas por umbral (años) ascendente; no puede haber dos filas con el mismo umbral y el mismo operador.",
  ],
  acumulacion: [
    "caducidad_limite_meses y meses_arrastre: enteros >= 0.",
    "prorroga_articulo_relacion_id: id de relación car_* si hay prórroga entre artículos.",
  ],
  workflow: [
    "plazo_*_dias: enteros >= 0.",
    "Roles/pasos/SLA por paso se modelan en subcolecciones de la versión.",
  ],
  documentacion: [
    "plazo_doc_previa_dias y plazo_doc_posterior_dias: enteros >= 0.",
    "nivel_ocupacion_dia_id: seleccionar desde cfg_nivel_ocupacion_dia.",
  ],
};

/**
 * Panel principal — pestañas por bloque del documento de versión (`cfgArticuloVersionSchema`).
 * Filtros, roles y pasos viven en subcolecciones (§1.7); no se editan aquí.
 */
export default function ArticuloConfigTabs() {
  const [searchParams] = useSearchParams();
  const { loading: catalogosLoading, error: catalogosError, getOptions, refresh: refreshCatalogos } =
    useCatalogosArticulos(DEFAULT_CATALOGOS_ARTICULOS_FORM);
  const [tab, setTab] = useState("meta");
  const [form, setForm] = useState(createEmptyArticuloVersionForm);
  const [parseResult, setParseResult] = useState(null);
  const [articuloDocumentId, setArticuloDocumentId] = useState("");
  const [versionDocumentId, setVersionDocumentId] = useState("");
  const [saving, setSaving] = useState(false);
  const formBloqueadoPorCatalogos = catalogosLoading || Boolean(catalogosError);

  const operadorComparacionOptions = useMemo(() => getOptions("cfg_operador_comparacion"), [getOptions]);

  const matrizLaoFeedback = useMemo(() => {
    if (!form.bloque_identidad_naturaleza.es_lao_anual) {
      return { errors: [], warnings: [] };
    }
    return analyzeMatrizAntiguedadReglas(form.bloque_topes_plazos_computo.matriz_antiguedad_reglas || []);
  }, [form.bloque_identidad_naturaleza.es_lao_anual, form.bloque_topes_plazos_computo.matriz_antiguedad_reglas]);

  useEffect(() => {
    const a = searchParams.get("articuloId");
    const v = searchParams.get("versionId");
    if (typeof a === "string" && a.trim()) setArticuloDocumentId(a.trim());
    if (typeof v === "string" && v.trim()) setVersionDocumentId(v.trim());
  }, [searchParams]);

  const setRoot = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setBlock = useCallback((block, key, value) => {
    setForm((prev) => ({
      ...prev,
      [block]: { ...prev[block], [key]: value },
    }));
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

  return (
    <div className="space-y-4">
      {catalogosLoading && (
        <Card className="border-blue-100 bg-blue-50/60 p-3 md:p-4">
          <p className="text-sm font-medium text-blue-900">Cargando catálogos desde Firestore…</p>
          <p className="mt-1 text-xs text-blue-800/90">Reinicio de ciclo, acción de saldo, origen de saldo y nivel de ocupación del día.</p>
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
        <h2 className="text-lg font-semibold text-slate-900">Configuración de artículo (versión)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Formulario enlazado a <span className="font-mono text-slate-700">cfgArticuloVersionSchema</span>. Cada pestaña
          corresponde a un bloque del contrato (§4). Listas grandes (filtros, roles, pasos) → subcolecciones §1.7. Ruta de
          persistencia: <span className="font-mono text-slate-700">cfg_articulos/{"{art_*}"}/versiones/{"{ver_*}"}</span>.
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

      <Card className="p-4 md:p-6">
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Ayuda de sintaxis ({TABS.find((x) => x.id === tab)?.label})</p>
          <ul className="mt-1 space-y-1 text-xs text-blue-900/90">
            {(TAB_HELP[tab] || []).map((tip) => (
              <li key={tip}>- {tip}</li>
            ))}
          </ul>
        </div>
        {tab === "meta" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ruta Firestore</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <FieldText
                  label="articulo_id (documento padre)"
                  value={articuloDocumentId}
                  onChange={setArticuloDocumentId}
                  placeholder="art_01ARZ3NDEKTSV4RRFFQ69G5FAV"
                  helpText="Formato requerido: art_ + ULID (26 chars, mayúsculas)."
                />
                <FieldText
                  label="version_id (este documento)"
                  value={versionDocumentId}
                  onChange={setVersionDocumentId}
                  placeholder="ver_01ARZ3NDEKTSV4RRFFQ69G5FAV"
                  helpText="Opcional: si queda vacío, se genera ver_* al guardar."
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
              <p className="mt-2 text-[11px] text-slate-500">
                Si <span className="font-mono">version_id</span> queda vacío, al guardar se crea un <span className="font-mono">ver_</span> nuevo y se actualiza{" "}
                <span className="font-mono">version_actual_id</span> en el núcleo del artículo (mismo batch).
              </p>
            </div>
            <FieldText label="version_semantica" value={form.version_semantica} onChange={(v) => setRoot("version_semantica", v)} placeholder="1.0.0" helpText="Convención semántica x.y.z." />
            <FieldSelect
              label="estado_version_id"
              value={form.estado_version_id}
              onChange={(v) => setRoot("estado_version_id", v)}
              options={getOptions("cfg_estado_version_articulo")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_estado_version_articulo."
            />
            <FieldText label="publicada_en (ISO o Timestamp)" value={form.publicada_en} onChange={(v) => setRoot("publicada_en", v)} placeholder="2026-05-12T09:00:00Z" helpText="Completar solo cuando pasa a publicada." />
            <FieldText label="publicada_por_persona_id" value={form.publicada_por_persona_id} onChange={(v) => setRoot("publicada_por_persona_id", v)} placeholder="per_…" helpText="Persona que publica la versión." />
          </div>
        )}

        {tab === "identidad" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldText label="bloque_identidad_naturaleza.codigo" value={form.bloque_identidad_naturaleza.codigo} onChange={(v) => setBlock("bloque_identidad_naturaleza", "codigo", v)} helpText="Código corto visible en operación y búsquedas." />
            <FieldText label="bloque_identidad_naturaleza.inciso_normativo" value={form.bloque_identidad_naturaleza.inciso_normativo} onChange={(v) => setBlock("bloque_identidad_naturaleza", "inciso_normativo", v)} helpText="Referencia normativa puntual que habilita el artículo." />
            <FieldText label="bloque_identidad_naturaleza.nombre" value={form.bloque_identidad_naturaleza.nombre} onChange={(v) => setBlock("bloque_identidad_naturaleza", "nombre", v)} helpText="Nombre formal del artículo en UI y auditoría." className="md:col-span-2" />
            <FieldText label="normativa_habilitante.decreto" value={form.bloque_identidad_naturaleza.normativa_habilitante.decreto} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "decreto", v)} helpText="Número/cita del decreto (si aplica)." />
            <FieldText label="normativa_habilitante.resolucion" value={form.bloque_identidad_naturaleza.normativa_habilitante.resolucion} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "resolucion", v)} helpText="Número/cita de resolución complementaria." />
            <FieldText label="normativa_habilitante.interno_efector" value={form.bloque_identidad_naturaleza.normativa_habilitante.interno_efector} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "interno_efector", v)} helpText="Referencia interna del efector/hospital para trazabilidad local." className="md:col-span-2" />
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
              <FieldCheck
                label="es_lao_anual"
                checked={form.bloque_identidad_naturaleza.es_lao_anual}
                onChange={(v) => {
                  setForm((prev) => ({
                    ...prev,
                    bloque_identidad_naturaleza: { ...prev.bloque_identidad_naturaleza, es_lao_anual: v },
                    bloque_topes_plazos_computo: v
                      ? prev.bloque_topes_plazos_computo
                      : {
                          ...prev.bloque_topes_plazos_computo,
                          correspondencia_anio: "",
                          fecha_corte_antiguedad: "",
                          matriz_antiguedad_reglas: [],
                        },
                  }));
                }}
                helpText="Única fuente de verdad LAO (Bloque 1). Si desmarcás, se limpian parámetros LAO del Bloque 4 al guardar."
              />
              <FieldCheck label="es_sancion" checked={form.bloque_identidad_naturaleza.es_sancion} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_sancion", v)} helpText="Clasifica el artículo como sanción disciplinaria." />
              <FieldCheck label="es_inasistencia" checked={form.bloque_identidad_naturaleza.es_inasistencia} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_inasistencia", v)} helpText="Indica que computa como inasistencia en controles operativos." />
              <FieldCheck label="es_sin_goce" checked={form.bloque_identidad_naturaleza.es_sin_goce} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_sin_goce", v)} helpText="Define que no justifica haberes (sin goce)." />
              <FieldCheck label="requiere_dictamen" checked={form.bloque_identidad_naturaleza.requiere_dictamen} onChange={(v) => setBlock("bloque_identidad_naturaleza", "requiere_dictamen", v)} helpText="Obliga dictamen previo para aprobar solicitudes del artículo." />
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">visualización (grilla)</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <FieldText label="visualizacion.codigo_grilla" value={form.bloque_identidad_naturaleza.visualizacion.codigo_grilla} onChange={(v) => setNested("bloque_identidad_naturaleza", "visualizacion", "codigo_grilla", v)} placeholder="14-0" helpText="Código corto mostrado en la celda de grilla mensual." />
                <FieldText label="visualizacion.color_ui" value={form.bloque_identidad_naturaleza.visualizacion.color_ui} onChange={(v) => setNested("bloque_identidad_naturaleza", "visualizacion", "color_ui", v)} placeholder="#3366CC" helpText="Color visual del artículo en la grilla (HEX)." />
              </div>
            </div>
          </div>
        )}

        {tab === "impacto" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldSelect
              label="bloque_impacto_economico.justifica_sueldo_id"
              value={form.bloque_impacto_economico.justifica_sueldo_id}
              onChange={(v) => setBlock("bloque_impacto_economico", "justifica_sueldo_id", v)}
              options={getOptions("cfg_justifica_sueldo")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_justifica_sueldo."
              className="md:col-span-2"
            />
            <FieldCheck label="suma_para_sac" checked={form.bloque_impacto_economico.suma_para_sac} onChange={(v) => setBlock("bloque_impacto_economico", "suma_para_sac", v)} helpText="Define si el período impacta en cálculo de SAC." />
            <FieldCheck label="afecta_presentismo" checked={form.bloque_impacto_economico.afecta_presentismo} onChange={(v) => setBlock("bloque_impacto_economico", "afecta_presentismo", v)} helpText="Indica si afecta premio/cálculo de presentismo." />
            <FieldCheck label="acumula_reparto_obra_social" checked={form.bloque_impacto_economico.acumula_reparto_obra_social} onChange={(v) => setBlock("bloque_impacto_economico", "acumula_reparto_obra_social", v)} helpText="Acumula para reparto/consideración de obra social." />
            <FieldCheck label="invalida_reparto_obra_social" checked={form.bloque_impacto_economico.invalida_reparto_obra_social} onChange={(v) => setBlock("bloque_impacto_economico", "invalida_reparto_obra_social", v)} helpText="Anula o excluye reparto de obra social para el período." />
            <FieldCheck label="suma_antiguedad_lao" checked={form.bloque_impacto_economico.suma_antiguedad_lao} onChange={(v) => setBlock("bloque_impacto_economico", "suma_antiguedad_lao", v)} helpText="Computa para antigüedad en el circuito LAO." />
          </div>
        )}

        {tab === "elegibilidad" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Los arreglos de filtros se gestionan en subcolecciones bajo la versión (§1.7).</p>
            <FieldCheck label="bloque_elegibilidad_filtros.requiere_declaracion_familiar" checked={form.bloque_elegibilidad_filtros.requiere_declaracion_familiar} onChange={(v) => setBlock("bloque_elegibilidad_filtros", "requiere_declaracion_familiar", v)} helpText="Si está activo, la solicitud exige DDJJ/declaración familiar vigente para aprobar." />
            <FieldNumber label="bloque_elegibilidad_filtros.edad_limite_familiar" value={form.bloque_elegibilidad_filtros.edad_limite_familiar} onChange={(v) => setBlock("bloque_elegibilidad_filtros", "edad_limite_familiar", v)} min={0} helpText="Edad tope en años; dejar vacío si no aplica." />
          </div>
        )}

        {tab === "topes" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldSelect
              label="bloque_topes_plazos_computo.regla_computo_dias_id"
              value={form.bloque_topes_plazos_computo.regla_computo_dias_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "regla_computo_dias_id", v)}
              options={getOptions("cfg_regla_computo_dias")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_regla_computo_dias."
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.ambito_consumo_id"
              value={form.bloque_topes_plazos_computo.ambito_consumo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "ambito_consumo_id", v)}
              options={getOptions("cfg_ambito_consumo")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_ambito_consumo."
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.reinicio_ciclo_id"
              value={form.bloque_topes_plazos_computo.reinicio_ciclo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "reinicio_ciclo_id", v)}
              options={getOptions("cfg_reinicio_ciclo_cuota")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_reinicio_ciclo_cuota."
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.accion_saldo_id"
              value={form.bloque_topes_plazos_computo.accion_saldo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "accion_saldo_id", v)}
              options={getOptions("cfg_accion_saldo")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_accion_saldo."
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.origen_saldo_id"
              value={form.bloque_topes_plazos_computo.origen_saldo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "origen_saldo_id", v)}
              options={getOptions("cfg_origen_saldo")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_origen_saldo."
              className="md:col-span-2"
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.regla_computo_horas_id (opcional)"
              value={form.bloque_topes_plazos_computo.regla_computo_horas_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "regla_computo_horas_id", v)}
              options={getOptions("cfg_regla_computo_horas")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_regla_computo_horas."
            />
            <FieldNumber label="bloque_topes_plazos_computo.intervalo_gracia_dias" value={form.bloque_topes_plazos_computo.intervalo_gracia_dias} onChange={(v) => setBlock("bloque_topes_plazos_computo", "intervalo_gracia_dias", v)} min={0} helpText="Cantidad de días de tolerancia antes de consumir saldo." />
            <FieldCheck label="bloque_topes_plazos_computo.fraccionamiento_habilitado" checked={form.bloque_topes_plazos_computo.fraccionamiento_habilitado} onChange={(v) => setBlock("bloque_topes_plazos_computo", "fraccionamiento_habilitado", v)} helpText="Permite usar el artículo en partes/fracciones en lugar de bloque completo." />
            <FieldCheck label="bloque_topes_plazos_computo.depende_rda" checked={form.bloque_topes_plazos_computo.depende_rda} onChange={(v) => setBlock("bloque_topes_plazos_computo", "depende_rda", v)} helpText="Si está activo, la validación RDA debe resolverse en backend." className="md:col-span-2" />
            {form.bloque_identidad_naturaleza.es_lao_anual ? (
              <div className="md:col-span-2 space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">LAO — Bloque 4 (solo si es LAO anual)</p>
                <p className="text-[11px] text-emerald-900/90">
                  <strong>correspondencia_anio</strong> es el año fiscal del derecho; cada bolsa en saldos debe llevar el mismo{" "}
                  <span className="font-mono">anio_origen</span>. Motor: año de <span className="font-mono">fecha_desde</span> (Buenos Aires) vs{" "}
                  <span className="font-mono">anio_origen</span> define Stock vs proporcional (ver MODULO PF).
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldNumber
                    label="bloque_topes_plazos_computo.correspondencia_anio"
                    value={form.bloque_topes_plazos_computo.correspondencia_anio}
                    onChange={(v) => setBlock("bloque_topes_plazos_computo", "correspondencia_anio", v)}
                    min={1900}
                    helpText="Año fiscal/presupuestario al que pertenece esta parametrización (ej. 2025)."
                  />
                  <div className="md:col-span-2 rounded-lg border border-emerald-100/80 bg-white/90 p-3">
                    <FechaCorteAntiguedadDiaMesField
                      value={form.bloque_topes_plazos_computo.fecha_corte_antiguedad}
                      onChange={(v) => setBlock("bloque_topes_plazos_computo", "fecha_corte_antiguedad", v)}
                      disabled={formBloqueadoPorCatalogos}
                    />
                    <p className="mt-2 text-[11px] text-slate-500">
                      Persistencia: <span className="font-mono text-slate-700">bloque_topes_plazos_computo.fecha_corte_antiguedad</span> como fecha ISO (año{" "}
                      <span className="font-mono">2000</span> técnico; el motor solo usa mes y día).
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-emerald-900">matriz_antiguedad_reglas</span>
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
                    <strong>Motor (proporcional):</strong> se recorre la tabla en orden ascendente de <span className="font-mono">valor_anos</span>. Para
                    cada fila se evalúa si la antigüedad del agente cumple la condición del <span className="font-mono">operador_id</span> respecto a ese
                    umbral; <strong>gana el último escalón cuya condición sea verdadera</strong> y de ahí se toman los{" "}
                    <span className="font-mono">dias_otorgados</span> base para el proporcional (ver MODULO PF). Las filas se reordenan solas al editar.
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
                                disabled={formBloqueadoPorCatalogos}
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
            ) : null}
          </div>
        )}

        {tab === "acumulacion" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldSelect
              label="bloque_acumulacion_sucesion.caducidad_tipo_id"
              value={form.bloque_acumulacion_sucesion.caducidad_tipo_id}
              onChange={(v) => setBlock("bloque_acumulacion_sucesion", "caducidad_tipo_id", v)}
              options={getOptions("cfg_tipo_caducidad")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_tipo_caducidad — vencimiento de bolsa (separado del tipo de acumulación en cfg_tipo_acumulacion)."
            />
            <FieldNumber label="bloque_acumulacion_sucesion.caducidad_limite_meses" value={form.bloque_acumulacion_sucesion.caducidad_limite_meses} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "caducidad_limite_meses", v)} min={0} helpText="Meses máximos antes de vencer saldo/remanente (según tipo de caducidad)." />
            <FieldNumber label="bloque_acumulacion_sucesion.meses_arrastre" value={form.bloque_acumulacion_sucesion.meses_arrastre} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "meses_arrastre", v)} min={0} helpText="Cuántos meses se arrastra saldo no usado al ciclo siguiente." />
            <FieldText label="bloque_acumulacion_sucesion.prorroga_articulo_relacion_id (car_…)" value={form.bloque_acumulacion_sucesion.prorroga_articulo_relacion_id} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "prorroga_articulo_relacion_id", v)} helpText="Relación del grafo (car_*) que define a qué artículo se prorroga." className="md:col-span-2" />
            <FieldCheck label="bloque_acumulacion_sucesion.permite_prorroga" checked={form.bloque_acumulacion_sucesion.permite_prorroga} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "permite_prorroga", v)} helpText="Habilita generar o aceptar prórrogas del artículo." />
          </div>
        )}

        {tab === "workflow" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Roles de ingreso, pasos y SLA por paso → subcolecciones (§1.7).</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldNumber label="bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias" value={form.bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "plazo_preaviso_normativa_dias", v)} min={0} helpText="Anticipación mínima exigida por norma para iniciar la solicitud." />
              <FieldNumber label="bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias" value={form.bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "plazo_preaviso_interno_dias", v)} min={0} helpText="Anticipación operativa interna (puede ser distinta a la normativa)." />
              <FieldCheck label="bloque_workflow_sla_cobertura.logistica_aviso_habilitada" checked={form.bloque_workflow_sla_cobertura.logistica_aviso_habilitada} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "logistica_aviso_habilitada", v)} helpText="Activa avisos/notificaciones logísticas del workflow." />
              <FieldCheck label="bloque_workflow_sla_cobertura.toma_conocimiento_limitada" checked={form.bloque_workflow_sla_cobertura.toma_conocimiento_limitada} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "toma_conocimiento_limitada", v)} helpText="Restringe quién puede tomar conocimiento del trámite." />
            </div>
          </div>
        )}

        {tab === "documentacion" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldSelect
              label="bloque_documentacion_convivencia.accion_incumplimiento_doc_id"
              value={form.bloque_documentacion_convivencia.accion_incumplimiento_doc_id}
              onChange={(v) => setBlock("bloque_documentacion_convivencia", "accion_incumplimiento_doc_id", v)}
              options={getOptions("cfg_accion_incumplimiento_documental")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Catálogo cfg_accion_incumplimiento_documental."
              className="md:col-span-2"
            />
            <FieldSelect
              label="bloque_documentacion_convivencia.nivel_ocupacion_dia_id"
              value={form.bloque_documentacion_convivencia.nivel_ocupacion_dia_id}
              onChange={(v) => setBlock("bloque_documentacion_convivencia", "nivel_ocupacion_dia_id", v)}
              options={getOptions("cfg_nivel_ocupacion_dia")}
              disabled={formBloqueadoPorCatalogos}
              helpText="Nivel que controla convivencia intradía en la grilla."
              className="md:col-span-2"
            />
            <FieldCheck label="bloque_documentacion_convivencia.requiere_doc_previa" checked={form.bloque_documentacion_convivencia.requiere_doc_previa} onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_doc_previa", v)} helpText="Exige documentación antes del inicio del artículo/licencia." />
            <FieldNumber label="bloque_documentacion_convivencia.plazo_doc_previa_dias" value={form.bloque_documentacion_convivencia.plazo_doc_previa_dias} onChange={(v) => setBlock("bloque_documentacion_convivencia", "plazo_doc_previa_dias", v)} min={0} helpText="Días máximos para presentar documentación previa." />
            <FieldCheck label="bloque_documentacion_convivencia.requiere_doc_posterior" checked={form.bloque_documentacion_convivencia.requiere_doc_posterior} onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_doc_posterior", v)} helpText="Exige documentación luego del período otorgado." />
            <FieldNumber label="bloque_documentacion_convivencia.plazo_doc_posterior_dias" value={form.bloque_documentacion_convivencia.plazo_doc_posterior_dias} onChange={(v) => setBlock("bloque_documentacion_convivencia", "plazo_doc_posterior_dias", v)} min={0} helpText="Días máximos posteriores para regularizar documentación." />
            <p className="md:col-span-2 text-xs text-slate-500">Incompatibilidades / compatibilidades normativas: grafo `cfg_articulo_relaciones` (§1.7).</p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || formBloqueadoPorCatalogos || matrizBloqueaGuardar}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-50 md:hover:bg-emerald-700"
        >
          {saving ? "Guardando…" : "Guardar en Firestore"}
        </button>
        <button
          type="button"
          onClick={validar}
          disabled={saving || formBloqueadoPorCatalogos}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-50 md:hover:bg-blue-700"
        >
          Validar con Zod
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
            <p className="text-sm font-medium text-emerald-800">Validación correcta según cfgArticuloVersionSchema.</p>
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
