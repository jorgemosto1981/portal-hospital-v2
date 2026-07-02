/**
 * Construye cfg_articulos + versión publicada — licencia médica P4 (Art. 14 corta anual).
 * @param {Record<string, unknown>} spec
 * @param {{ artId: string, verId: string }} ids
 */
import { buildOleada63Documents } from "./buildOleada63Version.mjs";

const CFG_MLM_CORTA = "cfg_mlm_corta_anual";

/**
 * @param {Record<string, unknown>} spec
 * @param {{ artId: string, verId: string }} ids
 */
export function buildP4LicenciaMedicaDocuments(spec, ids) {
  const modo = String(spec.modo_licencia_medica_id || CFG_MLM_CORTA).trim();
  const oleadaSpec = {
    codigo: String(spec.codigo),
    nombre: String(spec.nombre),
    inciso_normativo: String(spec.inciso_normativo),
    codigo_grilla: String(spec.codigo_grilla || "LM"),
    color_ui: String(spec.color_ui || "#3B82F6"),
    regla_computo_dias_id: String(spec.regla_computo_dias_id || "cfg_rcd_corridos"),
    cupo_dias_por_ciclo: spec.cupo_dias_por_ciclo ?? null,
    tope_dias_por_evento: spec.tope_dias_por_evento ?? null,
    tope_frecuencia_mensual: spec.tope_frecuencia_mensual ?? null,
    fecha_desde: spec.fecha_desde,
    circuito_ingreso_ids: spec.circuito_ingreso_ids,
  };

  const built = buildOleada63Documents(oleadaSpec, ids);
  const ident = { ...built.version.bloque_identidad_naturaleza };
  ident.es_licencia_medica = true;
  ident.modo_licencia_medica_id = modo;
  ident.causal_larga_duracion_id = null;
  ident.requiere_dictamen = false;

  const topes = {
    ...built.version.bloque_topes_plazos_computo,
    reinicio_ciclo_id: "cfg_rcc_nunca",
    origen_saldo_id: "cfg_os_externo_informado",
    ambito_consumo_id: "cfg_ac_anio_calendario",
    depende_rda: false,
    accion_saldo_id: "cfg_as_neutro",
    cupo_dias_por_ciclo: null,
    tope_dias_por_evento: spec.tope_dias_por_evento ?? null,
    regla_computo_dias_id: oleadaSpec.regla_computo_dias_id,
    usa_calendario_institucional: oleadaSpec.regla_computo_dias_id !== "cfg_rcd_corridos",
    nivel_ocupacion_dia_id: "cfg_nod_exclusivo",
  };

  const workflow = {
    ...built.version.bloque_workflow_sla_cobertura,
    permite_retroactividad: false,
    circuito_ingreso_ids: Array.isArray(spec.circuito_ingreso_ids)
      ? [...spec.circuito_ingreso_ids]
      : built.version.bloque_workflow_sla_cobertura.circuito_ingreso_ids,
  };

  const docs = {
    ...built.version.bloque_documentacion_convivencia,
    requiere_adjunto_obligatorio: spec.requiere_adjunto_obligatorio !== false,
    requiere_doc_posterior: true,
    accion_incumplimiento_doc_id: "cfg_aid_solo_notificacion",
  };

  const impacto = {
    ...built.version.bloque_impacto_economico,
    justifica_sueldo_id: "cfg_js_si_completo",
  };

  const version = {
    ...built.version,
    bloque_identidad_naturaleza: ident,
    bloque_topes_plazos_computo: topes,
    bloque_workflow_sla_cobertura: workflow,
    bloque_documentacion_convivencia: docs,
    bloque_impacto_economico: impacto,
  };

  const core = {
    ...built.core,
    requiere_dictamen: false,
  };

  return {
    ...built,
    core,
    version,
    versionForZod: version,
  };
}
