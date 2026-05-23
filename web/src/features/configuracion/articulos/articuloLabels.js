/**
 * Diccionario de labels humanas para el configurador de artículos.
 * Clave = ruta del campo en el form state (sin prefijo de bloque cuando el contexto es obvio).
 * Valor = texto legible para RRHH.
 */
export const LABELS = Object.freeze({
  // --- Versión / meta ---
  version_semantica: "Versión",
  estado_version_id: "Estado de publicación",
  publicada_en: "Fecha de publicación",
  publicada_por_persona_id: "Publicada por",
  articulo_id: "ID del artículo",
  version_id: "ID de la versión",

  // --- Identidad (Bloque 1) ---
  codigo: "Código del artículo",
  inciso_normativo: "Inciso normativo",
  nombre: "Nombre del artículo",
  decreto: "Decreto habilitante",
  resolucion: "Resolución complementaria",
  interno_efector: "Referencia interna del efector",
  es_lao_anual: "Es Licencia Anual Ordinaria (LAO)",
  es_sancion: "Es sanción disciplinaria (impacta legajo)",
  es_inasistencia: "Computa como inasistencia",
  es_sin_goce: "Sin goce de haberes (afecta liquidación)",
  requiere_dictamen: "¿Requiere validación técnica (Legales / Medicina)?",
  es_licencia_medica: "Es licencia médica (Caja Negra)",
  codigo_grilla: "Código en grilla",
  color_ui: "Color del artículo",
  fecha_desde: "Vigente desde",
  fecha_hasta: "Vigente hasta",

  // --- Impacto económico (Bloque 2) ---
  justifica_sueldo_id: "Justificación de haberes",
  suma_para_sac: "Impacta en cálculo de SAC",
  afecta_presentismo: "Afecta presentismo",
  acumula_reparto_obra_social: "Acumula para obra social",
  invalida_reparto_obra_social: "Excluye de obra social",
  suma_antiguedad_lao: "Cuenta para antigüedad (vacaciones / LAO)",

  // --- Elegibilidad (Bloque 3) ---
  requiere_declaracion_familiar: "Requiere declaración familiar",
  edad_limite_familiar: "Edad límite familiar",
  escalafon_ids: "Escalafones habilitados",
  agrupamiento_ids: "Agrupamientos",
  tipo_vinculo_ids: "Tipos de vínculo",
  cargo_funcional_ids: "Cargos funcionales",
  grupo_trabajo_ids: "Grupos de trabajo",
  persona_ids: "Agentes específicos",
  genero_ids: "Género / Sexo permitido",
  antiguedad_minima_meses: "Antigüedad mínima requerida (meses)",

  // --- Topes / cómputo (Bloque 4) ---
  regla_computo_dias_id: "Criterio de descuento (Días corridos vs Hábiles)",
  ambito_consumo_id: "Ámbito de renovación del cupo",
  unidad_medida_id: "Unidad de medida del saldo",
  unidad_minima_consumo_id: "Fracción mínima descontable",
  modulo_fraccionamiento_minutos: "Redondeo por bloques (minutos)",
  regla_computo_horas_id: "Regla de cómputo en horas",
  fraccionamiento_habilitado: "Permite tomar en partes",
  intervalo_gracia_dias: "Días de gracia antes de descontar",
  depende_rda: "Requiere validación de disponibilidad (RDA)",
  reinicio_ciclo_id: "Momento de reseteo de la bolsa de días",
  accion_saldo_id: "Efecto de la solicitud sobre el saldo",
  multiplicador_valor: "Factor multiplicador de horas",
  origen_saldo_id: "¿De dónde salen los días disponibles?",

  // --- Límites y cupos (Bloque 4) ---
  cupo_dias_por_ciclo: "Cupo de días por ciclo",
  tope_frecuencia_mensual: "Tope de frecuencia mensual",
  tope_dias_por_evento: "Máximo de días por solicitud",
  dias_minimos_por_evento: "Mínimo de días por solicitud",

  // --- LAO (Bloque 4, condicional) ---
  correspondencia_anio: "Año fiscal del derecho",
  fecha_corte_antiguedad: "Fecha de corte de antigüedad",
  matriz_antiguedad_reglas: "Escala de antigüedad",
  mes_dia_apertura_solicitudes: "Apertura de temporada (MM-DD)",
  tse_minimo_dias_base: "Umbral TSE (días)",
  permite_calculo_proporcional_tse: "Permite cupo proporcional por TSE",

  // --- Acumulación (Bloque 5) ---
  caducidad_tipo_id: "Tipo de vencimiento",
  caducidad_limite_meses: "Meses hasta vencimiento",
  meses_arrastre: "Meses de arrastre",
  prorroga_articulo_relacion_id: "Artículo de prórroga",
  permite_prorroga: "Permite prórroga",

  // --- Workflow (Bloque 6) ---
  circuito_ingreso_ids: "Roles habilitados para crear solicitud",
  plazo_preaviso_normativa_dias: "Preaviso por norma (días)",
  plazo_preaviso_interno_dias: "Preaviso interno (días)",
  logistica_aviso_habilitada: "Genera necesidad de cobertura / reemplazo",
  toma_conocimiento_limitada: "Toma de conocimiento limitada (burbujeo)",
  permite_retroactividad: "Permite carga retroactiva (DDJJ)",
  requiere_toma_conocimiento_superior: "Requiere toma de conocimiento del superior",
  niveles_burbujeo: "Niveles de burbujeo",

  // --- Documentación (Bloque 7) ---
  requiere_adjunto_obligatorio: "Adjunto obligatorio para enviar la solicitud",
  requiere_doc_previa: "Requiere documentación previa",
  plazo_doc_previa_dias: "Plazo para doc. previa (días)",
  requiere_doc_posterior: "Requiere documentación posterior",
  plazo_doc_posterior_dias: "Plazo para doc. posterior (días)",
  accion_incumplimiento_doc_id: "Si falta documentación…",

  // --- Superposición y convivencia (Bloque 4 bis) ---
  nivel_ocupacion_dia_id: "Nivel de ocupación del día",
  politica_superposicion_id: "Comportamiento ante superposición de fechas",
});

/**
 * Paleta de colores institucionales para el selector visual.
 * RRHH elige visualmente; el sistema persiste el HEX.
 */
export const PALETA_COLORES = Object.freeze([
  { hex: "#2563EB", nombre: "Azul institucional" },
  { hex: "#059669", nombre: "Verde salud" },
  { hex: "#D97706", nombre: "Amarillo alerta" },
  { hex: "#DC2626", nombre: "Rojo urgencia" },
  { hex: "#7C3AED", nombre: "Violeta especial" },
  { hex: "#0891B2", nombre: "Cyan administrativo" },
  { hex: "#4B5563", nombre: "Gris neutro" },
  { hex: "#EA580C", nombre: "Naranja operativo" },
]);

/**
 * "Machete humano" — explicaciones de impacto para opciones críticas de catálogos.
 * Clave = ID del documento en la colección cfg_*.
 * Se prioriza sobre `descripcion_ui` de Firestore cuando existe.
 */
/** Textos de ayuda largos (checkboxes y campos que lo requieran). */
export const HELP_TEXTS = Object.freeze({
  suma_antiguedad_lao:
    "El tiempo de esta licencia cuenta para antigüedad. Activado: no se descuentan estos días del tiempo de servicio para vacaciones (LAO). Desactivado: el motor LAO puede excluir ese período del cómputo de servicio efectivo (ej.: licencias sin goce de haberes).",
  acumula_reparto_obra_social:
    "Los días se consideran para acumulación de licencias para el cálculo de aportes a la obra social.",
  invalida_reparto_obra_social:
    "Este artículo excluye al agente del reparto de obra social durante el período mensual.",
});

export const EXPLICACIONES_OPCIONES = Object.freeze({
  // cfg_regla_computo_dias
  cfg_rcd_corridos: "Cuenta sábados, domingos y feriados. Estándar para vacaciones (LAO) y la mayoría de licencias anuales.",
  cfg_rcd_habiles_simple: "Solo lun–vie; feriados no consumen salvo norma específica. Permisos cortos administrativos.",
  cfg_rcd_habiles_compuesto: "Hábiles con reglas compuestas (feriados móviles, etc.). Usar cuando la norma lo exige.",

  // cfg_reinicio_ciclo_cuota
  cfg_rcc_anual: "Reinicio por año civil o ciclo LAO. Ej: vacaciones — cupo nuevo cada período fiscal.",
  cfg_rcc_mensual: "El contador se reinicia cada mes. Ej: permiso con tope de 2 días por mes calendario.",
  cfg_rcc_diario: "Ventana diaria (uso poco frecuente). Ej: controles puntuales de presentismo.",
  cfg_rcc_nunca: "El saldo no se resetea solo; cambia al consumir o por carga RRHH. Ej: bolsa única de compensatorio.",

  // cfg_origen_saldo
  cfg_os_interno: "El portal calcula y descuenta la bolsa (saldos_articulo_agente). LAO, francos, horas extra acreditadas.",
  cfg_os_externo_informado: "RRHH informa el disponible (planilla o sistema legado). El portal valida pero no recalcula el cupo.",
  cfg_os_externo_calculado: "Cupo derivado de reglas externas; el portal registra movimientos según integración futura.",

  // cfg_accion_saldo (motor aritmético)
  cfg_as_suma: "El valor ingresado incrementa el saldo (ej: carga de horas extra).",
  cfg_as_resta: "El valor ingresado descuenta del saldo (ej: uso de licencia).",
  cfg_as_neutro: "Solo registro informativo, no afecta la bolsa de días/horas.",

  // cfg_ambito_consumo
  cfg_ac_anio_calendario: "El contador se reinicia el 1 de enero. Los días usados se suman dentro del año civil (ej. licencias por trámites, exámenes).",
  cfg_ac_anio_laboral: "El contador sigue el ciclo laboral del agente, que puede no coincidir con el año civil. Típico de vacaciones (LAO) y licencias con fecha de corte institucional.",
  cfg_ac_mes_corriente: "Solo cuenta lo usado en el mes en curso. Para artículos con tope mensual (ej. no más de 2 días por mes).",

  // cfg_tipo_caducidad
  sin_caducidad: "El saldo no caduca nunca. Los días acumulados permanecen indefinidamente.",
  fin_de_anio: "El saldo vence el 31 de diciembre. Lo que no se usó, se pierde.",
  meses_desde_otorgamiento: "Caduca X meses después de otorgado. Configurá el plazo en 'Meses hasta vencimiento'.",
});
