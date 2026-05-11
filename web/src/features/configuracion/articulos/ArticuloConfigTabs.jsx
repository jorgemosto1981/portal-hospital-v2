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

function FieldText({ label, value, onChange, placeholder, inputMode, className = "" }) {
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
    </label>
  );
}

function FieldNumber({ label, value, onChange, min = 0 }) {
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
    </label>
  );
}

function FieldCheck({ label, checked, onChange, className = "" }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 ${className}`.trim()}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
      <span className="text-sm text-slate-800">{label}</span>
    </label>
  );
}

function FieldSelect({ label, value, onChange, options, disabled, placeholder = "Elegí una opción…", className = "" }) {
  return (
    <label className={`block space-y-1 ${className}`.trim()}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
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
    setParseResult(runVersionValidation());
  }, [runVersionValidation]);

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
  }, [articuloDocumentId, versionDocumentId, runVersionValidation]);

  const onSubmitFormulario = useCallback(
    (e) => {
      e.preventDefault();
      void guardarEnFirestore();
    },
    [guardarEnFirestore],
  );

  const issuesText = useMemo(() => {
    if (!parseResult || parseResult.success) return null;
    return parseResult.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("\n");
  }, [parseResult]);

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
                />
                <FieldText
                  label="version_id (este documento)"
                  value={versionDocumentId}
                  onChange={setVersionDocumentId}
                  placeholder="ver_01ARZ3NDEKTSV4RRFFQ69G5FAV"
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
            <FieldText label="version_semantica" value={form.version_semantica} onChange={(v) => setRoot("version_semantica", v)} placeholder="1.0.0" />
            <FieldText label="estado_version_id" value={form.estado_version_id} onChange={(v) => setRoot("estado_version_id", v)} placeholder="cfg_…" />
            <FieldText label="publicada_en (ISO o Timestamp)" value={form.publicada_en} onChange={(v) => setRoot("publicada_en", v)} />
            <FieldText label="publicada_por_persona_id" value={form.publicada_por_persona_id} onChange={(v) => setRoot("publicada_por_persona_id", v)} placeholder="per_…" />
          </div>
        )}

        {tab === "identidad" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldText label="bloque_identidad_naturaleza.codigo" value={form.bloque_identidad_naturaleza.codigo} onChange={(v) => setBlock("bloque_identidad_naturaleza", "codigo", v)} />
            <FieldText label="bloque_identidad_naturaleza.inciso_normativo" value={form.bloque_identidad_naturaleza.inciso_normativo} onChange={(v) => setBlock("bloque_identidad_naturaleza", "inciso_normativo", v)} />
            <FieldText label="bloque_identidad_naturaleza.nombre" value={form.bloque_identidad_naturaleza.nombre} onChange={(v) => setBlock("bloque_identidad_naturaleza", "nombre", v)} className="md:col-span-2" />
            <FieldText label="normativa_habilitante.decreto" value={form.bloque_identidad_naturaleza.normativa_habilitante.decreto} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "decreto", v)} />
            <FieldText label="normativa_habilitante.resolucion" value={form.bloque_identidad_naturaleza.normativa_habilitante.resolucion} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "resolucion", v)} />
            <FieldText label="normativa_habilitante.interno_efector" value={form.bloque_identidad_naturaleza.normativa_habilitante.interno_efector} onChange={(v) => setNested("bloque_identidad_naturaleza", "normativa_habilitante", "interno_efector", v)} className="md:col-span-2" />
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
              <FieldCheck label="es_lao_anual" checked={form.bloque_identidad_naturaleza.es_lao_anual} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_lao_anual", v)} />
              <FieldCheck label="es_sancion" checked={form.bloque_identidad_naturaleza.es_sancion} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_sancion", v)} />
              <FieldCheck label="es_inasistencia" checked={form.bloque_identidad_naturaleza.es_inasistencia} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_inasistencia", v)} />
              <FieldCheck label="es_sin_goce" checked={form.bloque_identidad_naturaleza.es_sin_goce} onChange={(v) => setBlock("bloque_identidad_naturaleza", "es_sin_goce", v)} />
              <FieldCheck label="requiere_dictamen" checked={form.bloque_identidad_naturaleza.requiere_dictamen} onChange={(v) => setBlock("bloque_identidad_naturaleza", "requiere_dictamen", v)} />
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">visualización (grilla)</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <FieldText label="visualizacion.codigo_grilla" value={form.bloque_identidad_naturaleza.visualizacion.codigo_grilla} onChange={(v) => setNested("bloque_identidad_naturaleza", "visualizacion", "codigo_grilla", v)} placeholder="14-0" />
                <FieldText label="visualizacion.color_ui" value={form.bloque_identidad_naturaleza.visualizacion.color_ui} onChange={(v) => setNested("bloque_identidad_naturaleza", "visualizacion", "color_ui", v)} placeholder="#3366CC" />
              </div>
            </div>
          </div>
        )}

        {tab === "impacto" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldText label="bloque_impacto_economico.justifica_sueldo_id" value={form.bloque_impacto_economico.justifica_sueldo_id} onChange={(v) => setBlock("bloque_impacto_economico", "justifica_sueldo_id", v)} className="md:col-span-2" />
            <FieldCheck label="suma_para_sac" checked={form.bloque_impacto_economico.suma_para_sac} onChange={(v) => setBlock("bloque_impacto_economico", "suma_para_sac", v)} />
            <FieldCheck label="afecta_presentismo" checked={form.bloque_impacto_economico.afecta_presentismo} onChange={(v) => setBlock("bloque_impacto_economico", "afecta_presentismo", v)} />
            <FieldCheck label="acumula_reparto_obra_social" checked={form.bloque_impacto_economico.acumula_reparto_obra_social} onChange={(v) => setBlock("bloque_impacto_economico", "acumula_reparto_obra_social", v)} />
            <FieldCheck label="invalida_reparto_obra_social" checked={form.bloque_impacto_economico.invalida_reparto_obra_social} onChange={(v) => setBlock("bloque_impacto_economico", "invalida_reparto_obra_social", v)} />
            <FieldCheck label="suma_antiguedad_lao" checked={form.bloque_impacto_economico.suma_antiguedad_lao} onChange={(v) => setBlock("bloque_impacto_economico", "suma_antiguedad_lao", v)} />
          </div>
        )}

        {tab === "elegibilidad" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Los arreglos de filtros se gestionan en subcolecciones bajo la versión (§1.7).</p>
            <FieldCheck label="bloque_elegibilidad_filtros.requiere_declaracion_familiar" checked={form.bloque_elegibilidad_filtros.requiere_declaracion_familiar} onChange={(v) => setBlock("bloque_elegibilidad_filtros", "requiere_declaracion_familiar", v)} />
            <FieldNumber label="bloque_elegibilidad_filtros.edad_limite_familiar" value={form.bloque_elegibilidad_filtros.edad_limite_familiar} onChange={(v) => setBlock("bloque_elegibilidad_filtros", "edad_limite_familiar", v)} min={0} />
          </div>
        )}

        {tab === "topes" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldText label="bloque_topes_plazos_computo.regla_computo_dias_id" value={form.bloque_topes_plazos_computo.regla_computo_dias_id} onChange={(v) => setBlock("bloque_topes_plazos_computo", "regla_computo_dias_id", v)} />
            <FieldText label="bloque_topes_plazos_computo.ambito_consumo_id" value={form.bloque_topes_plazos_computo.ambito_consumo_id} onChange={(v) => setBlock("bloque_topes_plazos_computo", "ambito_consumo_id", v)} />
            <FieldSelect
              label="bloque_topes_plazos_computo.reinicio_ciclo_id"
              value={form.bloque_topes_plazos_computo.reinicio_ciclo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "reinicio_ciclo_id", v)}
              options={getOptions("cfg_reinicio_ciclo_cuota")}
              disabled={formBloqueadoPorCatalogos}
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.accion_saldo_id"
              value={form.bloque_topes_plazos_computo.accion_saldo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "accion_saldo_id", v)}
              options={getOptions("cfg_accion_saldo")}
              disabled={formBloqueadoPorCatalogos}
            />
            <FieldSelect
              label="bloque_topes_plazos_computo.origen_saldo_id"
              value={form.bloque_topes_plazos_computo.origen_saldo_id}
              onChange={(v) => setBlock("bloque_topes_plazos_computo", "origen_saldo_id", v)}
              options={getOptions("cfg_origen_saldo")}
              disabled={formBloqueadoPorCatalogos}
              className="md:col-span-2"
            />
            <FieldText label="bloque_topes_plazos_computo.regla_computo_horas_id (opcional)" value={form.bloque_topes_plazos_computo.regla_computo_horas_id} onChange={(v) => setBlock("bloque_topes_plazos_computo", "regla_computo_horas_id", v)} />
            <FieldNumber label="bloque_topes_plazos_computo.intervalo_gracia_dias" value={form.bloque_topes_plazos_computo.intervalo_gracia_dias} onChange={(v) => setBlock("bloque_topes_plazos_computo", "intervalo_gracia_dias", v)} min={0} />
            <FieldCheck label="bloque_topes_plazos_computo.fraccionamiento_habilitado" checked={form.bloque_topes_plazos_computo.fraccionamiento_habilitado} onChange={(v) => setBlock("bloque_topes_plazos_computo", "fraccionamiento_habilitado", v)} />
            <FieldCheck label="bloque_topes_plazos_computo.depende_rda" checked={form.bloque_topes_plazos_computo.depende_rda} onChange={(v) => setBlock("bloque_topes_plazos_computo", "depende_rda", v)} className="md:col-span-2" />
          </div>
        )}

        {tab === "acumulacion" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldText label="bloque_acumulacion_sucesion.caducidad_tipo_id" value={form.bloque_acumulacion_sucesion.caducidad_tipo_id} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "caducidad_tipo_id", v)} />
            <FieldNumber label="bloque_acumulacion_sucesion.caducidad_limite_meses" value={form.bloque_acumulacion_sucesion.caducidad_limite_meses} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "caducidad_limite_meses", v)} min={0} />
            <FieldNumber label="bloque_acumulacion_sucesion.meses_arrastre" value={form.bloque_acumulacion_sucesion.meses_arrastre} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "meses_arrastre", v)} min={0} />
            <FieldText label="bloque_acumulacion_sucesion.prorroga_articulo_relacion_id (car_…)" value={form.bloque_acumulacion_sucesion.prorroga_articulo_relacion_id} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "prorroga_articulo_relacion_id", v)} className="md:col-span-2" />
            <FieldCheck label="bloque_acumulacion_sucesion.permite_prorroga" checked={form.bloque_acumulacion_sucesion.permite_prorroga} onChange={(v) => setBlock("bloque_acumulacion_sucesion", "permite_prorroga", v)} />
          </div>
        )}

        {tab === "workflow" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Roles de ingreso, pasos y SLA por paso → subcolecciones (§1.7).</p>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldNumber label="bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias" value={form.bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "plazo_preaviso_normativa_dias", v)} min={0} />
              <FieldNumber label="bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias" value={form.bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "plazo_preaviso_interno_dias", v)} min={0} />
              <FieldCheck label="bloque_workflow_sla_cobertura.logistica_aviso_habilitada" checked={form.bloque_workflow_sla_cobertura.logistica_aviso_habilitada} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "logistica_aviso_habilitada", v)} />
              <FieldCheck label="bloque_workflow_sla_cobertura.toma_conocimiento_limitada" checked={form.bloque_workflow_sla_cobertura.toma_conocimiento_limitada} onChange={(v) => setBlock("bloque_workflow_sla_cobertura", "toma_conocimiento_limitada", v)} />
            </div>
          </div>
        )}

        {tab === "documentacion" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldText label="bloque_documentacion_convivencia.accion_incumplimiento_doc_id" value={form.bloque_documentacion_convivencia.accion_incumplimiento_doc_id} onChange={(v) => setBlock("bloque_documentacion_convivencia", "accion_incumplimiento_doc_id", v)} className="md:col-span-2" />
            <FieldSelect
              label="bloque_documentacion_convivencia.nivel_ocupacion_dia_id"
              value={form.bloque_documentacion_convivencia.nivel_ocupacion_dia_id}
              onChange={(v) => setBlock("bloque_documentacion_convivencia", "nivel_ocupacion_dia_id", v)}
              options={getOptions("cfg_nivel_ocupacion_dia")}
              disabled={formBloqueadoPorCatalogos}
              className="md:col-span-2"
            />
            <FieldCheck label="bloque_documentacion_convivencia.requiere_doc_previa" checked={form.bloque_documentacion_convivencia.requiere_doc_previa} onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_doc_previa", v)} />
            <FieldNumber label="bloque_documentacion_convivencia.plazo_doc_previa_dias" value={form.bloque_documentacion_convivencia.plazo_doc_previa_dias} onChange={(v) => setBlock("bloque_documentacion_convivencia", "plazo_doc_previa_dias", v)} min={0} />
            <FieldCheck label="bloque_documentacion_convivencia.requiere_doc_posterior" checked={form.bloque_documentacion_convivencia.requiere_doc_posterior} onChange={(v) => setBlock("bloque_documentacion_convivencia", "requiere_doc_posterior", v)} />
            <FieldNumber label="bloque_documentacion_convivencia.plazo_doc_posterior_dias" value={form.bloque_documentacion_convivencia.plazo_doc_posterior_dias} onChange={(v) => setBlock("bloque_documentacion_convivencia", "plazo_doc_posterior_dias", v)} min={0} />
            <p className="md:col-span-2 text-xs text-slate-500">Incompatibilidades / compatibilidades normativas: grafo `cfg_articulo_relaciones` (§1.7).</p>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || formBloqueadoPorCatalogos}
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
