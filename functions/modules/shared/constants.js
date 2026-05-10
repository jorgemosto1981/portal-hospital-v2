"use strict";

const COL_PERSONAS = "personas";
const COL_USUARIOS_CUENTA = "usuarios_cuenta";
const COL_EVENTOS = "eventos_ticket";
const COL_EVENTOS_BANDEJA_RRHH = "eventos_bandeja_rrhh";
const COL_EVENTOS_POR_PERSONA = "eventos_por_persona";
const COL_EVENTOS_POR_MODULO = "eventos_por_modulo";
const COL_RATE_PRIMER_DNI = "_system_reg_primer_dni";
const COL_RATE_LOGIN_DNI = "_system_rate_login_dni";
const COL_GRUPOS_TRABAJO = "grupos_de_trabajo";
const COL_CFG_ROL = "cfg_rol";

const CFG_PEND_REG = "cfg_eca_pend_reg";
const CFG_ONB = "cfg_eca_onb";
const CFG_ECA_ACTIVO = "cfg_eca_activo";
const CFG_EPD_BORR = "cfg_epd_borr";
const CFG_EPD_COMP = "cfg_epd_comp";
const CFG_TEV_LOGIN = "cfg_tev_login";

const RATE_MAX = 7;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const MSG_REG_GENERICO = "No se pudo completar el registro.";
const MSG_LOGIN = "No se pudo iniciar sesión. Verificá DNI y PIN.";

const ESTADO_PENDIENTE_ONBOARDING = "PENDIENTE_ONBOARDING";
const ESTADO_ACTIVO_MVP = "ACTIVO";

const CFG_COLECCIONES_ONBOARDING_LECTURA = new Set([
  "cfg_provincia",
  "cfg_localidad",
  "cfg_parentesco",
  COL_GRUPOS_TRABAJO,
]);

const CFG_COLECCIONES_RRHH = new Set([
  "cfg_rol",
  "cfg_estado_civil",
  "cfg_sexo_genero",
  "cfg_nacionalidad",
  "cfg_pais",
  "cfg_provincia",
  "cfg_localidad",
  "cfg_nivel_estudios",
  "cfg_especialidad",
  "cfg_colegio",
  "cfg_jurisdiccion_matricula",
  "cfg_parentesco",
  "cfg_estado_auditoria_familiar",
  "cfg_motivo_rechazo_familiar",
  "cfg_estado_declaracion_ddjj",
  "cfg_estado_perfil_datos",
  "cfg_motivo_baja_persona",
  "cfg_estado_cuenta_acceso",
  "cfg_tipo_evento",
  "cfg_estado_bandeja_rrhh",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_tipo_vinculo_laboral",
  "cfg_cargo_funcional",
  "grupos_de_trabajo",
  "cfg_efectores",
  "cfg_modalidad_jornada",
  "cfg_regimen_horario",
  "cfg_centro_costo",
  "cfg_estado_asignacion_laboral",
  "cfg_causal_fin_asignacion_laboral",
  "cfg_motivo_deshabilitacion_hlc",
  "cfg_tipo_acto_designacion",
  /** Configuración de artículos (licencias) — listados en formulario RRHH. */
  "cfg_tipo_articulo",
  "cfg_unidad_medida_articulo",
  /** Normativa principal citada en `cfg_articulos.norma_principal_tipo_id` (solo clasificación de fuente). */
  "cfg_tipo_norma_principal_articulo",
  "cfg_origen_alta_solicitud",
  "cfg_regla_split_remanente",
  "cfg_prioridad_normativa",
  "cfg_politica_superposicion",
  "cfg_momento_entrega_documentacion",
  "cfg_tipo_computo_plazo",
  "cfg_accion_vencimiento",
  "cfg_calendario_feriados_institucional",
  "cfg_situacion_revista",
  "cfg_unidad_intervalo_tiempo",
  "cfg_paso_workflow_articulo",
  "usuarios_cuenta",
  /** Lecturas RRHH · seguimiento enrolamiento y perfil laboral (HLc). */
  COL_PERSONAS,
  COL_EVENTOS,
  "historial_laboral_cargos",
]);

module.exports = {
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  COL_EVENTOS,
  COL_EVENTOS_BANDEJA_RRHH,
  COL_EVENTOS_POR_PERSONA,
  COL_EVENTOS_POR_MODULO,
  COL_RATE_PRIMER_DNI,
  COL_RATE_LOGIN_DNI,
  COL_GRUPOS_TRABAJO,
  COL_CFG_ROL,
  CFG_PEND_REG,
  CFG_ONB,
  CFG_ECA_ACTIVO,
  CFG_EPD_BORR,
  CFG_EPD_COMP,
  CFG_TEV_LOGIN,
  RATE_MAX,
  RATE_WINDOW_MS,
  MSG_REG_GENERICO,
  MSG_LOGIN,
  ESTADO_PENDIENTE_ONBOARDING,
  ESTADO_ACTIVO_MVP,
  CFG_COLECCIONES_ONBOARDING_LECTURA,
  CFG_COLECCIONES_RRHH,
};

