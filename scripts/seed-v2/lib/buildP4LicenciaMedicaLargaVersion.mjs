/**
 * Construye cfg_articulos + versión publicada — licencia médica larga P4.4 (Arts. 16/19).
 * @param {Record<string, unknown>} spec
 * @param {{ artId: string, verId: string }} ids
 */
import { buildOleada63Documents } from "./buildOleada63Version.mjs";

const CFG_MLM_LARGA = "cfg_mlm_larga_episodio";
const CFG_AC_EPISODIO = "cfg_ac_episodio_continuo";

/**
 * @param {Record<string, unknown>} spec
 * @param {{ artId: string, verId: string }} ids
 */
export function buildP4LicenciaMedicaLargaDocuments(spec, ids) {
  const modo = String(spec.modo_licencia_medica_id || CFG_MLM_LARGA).trim();
  const oleadaSpec = {
    codigo: String(spec.codigo),
    nombre: String(spec.nombre),
    inciso_normativo: String(spec.inciso_normativo),
    codigo_grilla: String(spec.codigo_grilla || "LM-L"),
    color_ui: String(spec.color_ui || "#7C3AED"),
    regla_computo_dias_id: String(spec.regla_computo_dias_id || "cfg_rcd_corridos"),
    cupo_dias_por_ciclo: spec.cupo_dias_por_ciclo ?? null,
    tope_dias_por_evento: spec.tope_dias_por_evento ?? 730,
    tope_frecuencia_mensual: spec.tope_frecuencia_mensual ?? null,
    fecha_desde: spec.fecha_desde,
    circuito_ingreso_ids: spec.circuito_ingreso_ids,
  };

  const built = buildOleada63Documents(oleadaSpec, ids);
  const ident = { ...built.version.bloque_identidad_naturaleza };
  ident.es_licencia_medica = true;
  ident.modo_licencia_medica_id = modo;
  ident.causal_larga_duracion_id = null;
  ident.requiere_dictamen = spec.requiere_dictamen !== false;

  const topes = {
    ...built.version.bloque_topes_plazos_computo,
    reinicio_ciclo_id: "cfg_rcc_nunca",
    origen_saldo_id: "cfg_os_externo_informado",
    ambito_consumo_id: String(spec.ambito_consumo_id || CFG_AC_EPISODIO),
    depende_rda: false,
    accion_saldo_id: "cfg_as_neutro",
    cupo_dias_por_ciclo: null,
    tope_dias_por_evento: oleadaSpec.tope_dias_por_evento,
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
    requiere_dictamen: ident.requiere_dictamen === true,
  };

  return {
    ...built,
    core,
    version,
    versionForZod: version,
  };
}
