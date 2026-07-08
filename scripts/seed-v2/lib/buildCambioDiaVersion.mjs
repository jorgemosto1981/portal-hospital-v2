/**
 * Builder cfg_articulos + versión publicada — CAMBIO-DIA (Etapa 1).
 * @see docs/v2/CONTRATO_CONFIG_ARTICULO_CAMBIO_DIA_V2.md
 */
export function buildCambioDiaDocuments(spec, ids) {
  const { artId, verId } = ids;
  const circuito =
    Array.isArray(spec.circuito_ingreso_ids) && spec.circuito_ingreso_ids.length
      ? spec.circuito_ingreso_ids
      : ["CFG_USUARIO", "CFG_RRHH", "CFG_MEDICO", "CFG_VISUALIZADOR"];

  const fechaDesde = spec.fecha_desde || "2026-07-01";
  const codigo = String(spec.codigo || "CAMBIO-DIA");
  const nombre = String(spec.nombre || "Cambio de día (traslado propio)");
  const inciso = String(spec.inciso_normativo || "Operativo GSO — traslado propio (Etapa 1)");
  const grilla = String(spec.codigo_grilla || "C-DIA");
  const color = String(spec.color_ui || "#0F766E");
  const origenNorm =
    String(spec.origen_normativo_id || "cfg_ona_resolucion_institucional").trim() ||
    "cfg_ona_resolucion_institucional";
  const preaviso =
    spec.plazo_preaviso_interno_dias == null
      ? 2
      : Math.max(0, Math.floor(Number(spec.plazo_preaviso_interno_dias)));

  const core = {
    codigo,
    inciso_normativo: inciso,
    nombre,
    origen_normativo_id: origenNorm,
    es_sancion: false,
    es_inasistencia: false,
    es_sin_goce: false,
    requiere_dictamen: false,
    activo: true,
    motivo_deshabilitado: null,
    fecha_deshabilitado: null,
    estado_articulo_id: "cfg_est_art_vigente",
    vigente_desde: fechaDesde,
    vigente_hasta: null,
    version_actual_id: verId,
  };

  const version = {
    version_semantica: "1.0.0",
    estado_version_id: "cfg_est_ver_publicada",
    publicada_en: null,
    publicada_por_persona_id: null,
    bloque_identidad_naturaleza: {
      codigo,
      inciso_normativo: inciso,
      nombre,
      normativa_habilitante: {
        decreto: null,
        resolucion: "Etapa 1 portal — cambio de día",
        interno_efector: null,
      },
      es_lao_anual: false,
      es_sancion: false,
      es_inasistencia: false,
      es_sin_goce: false,
      requiere_dictamen: false,
      es_licencia_medica: false,
      visualizacion: {
        codigo_grilla: grilla,
        color_ui: color,
      },
      fecha_desde: fechaDesde,
      fecha_hasta: null,
    },
    bloque_impacto_economico: {
      justifica_sueldo_id: "cfg_js_si_completo",
      suma_para_sac: true,
      afecta_presentismo: false,
      acumula_reparto_obra_social: false,
      invalida_reparto_obra_social: false,
      suma_antiguedad_lao: false,
    },
    bloque_elegibilidad_filtros: {
      requiere_declaracion_familiar: false,
      edad_limite_familiar: null,
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
      regla_computo_dias_id: "cfg_rcd_corridos",
      usa_calendario_institucional: false,
      ambito_consumo_id: "cfg_ac_anio_calendario",
      unidad_medida_id: "cfg_uma_dias",
      unidad_minima_consumo_id: "cfg_umc_dia_completo",
      modulo_fraccionamiento_minutos: 15,
      fraccionamiento_habilitado: false,
      intervalo_gracia_dias: 0,
      regla_computo_horas_id: null,
      reinicio_ciclo_id: "cfg_rcc_anual",
      depende_rda: true,
      accion_saldo_id: "cfg_as_neutro",
      multiplicador_valor: 1,
      origen_saldo_id: "cfg_os_interno",
      cupo_dias_por_ciclo: null,
      tope_frecuencia_mensual: null,
      tope_dias_por_evento: 1,
      dias_minimos_por_evento: 1,
      correspondencia_anio: null,
      fecha_corte_antiguedad: null,
      matriz_antiguedad_reglas: null,
      mes_dia_apertura_solicitudes: null,
      tse_minimo_dias_base: null,
      permite_calculo_proporcional_tse: null,
      nivel_ocupacion_dia_id: "cfg_nod_exclusivo",
      politica_superposicion_id: null,
    },
    bloque_acumulacion_sucesion: {
      caducidad_tipo_id: "cfg_cad_nunca",
      caducidad_limite_meses: null,
      permite_prorroga: false,
      prorroga_articulo_relacion_id: null,
      meses_arrastre: 0,
    },
    bloque_workflow_sla_cobertura: {
      circuito_ingreso_ids: [...circuito],
      plazo_preaviso_normativa_dias: null,
      plazo_preaviso_interno_dias: preaviso,
      logistica_aviso_habilitada: false,
      toma_conocimiento_limitada: false,
      permite_retroactividad: spec.permite_retroactividad === true,
      requiere_toma_conocimiento_superior: false,
    },
    bloque_documentacion_convivencia: {
      requiere_adjunto_obligatorio: false,
      requiere_doc_previa: false,
      plazo_doc_previa_dias: null,
      requiere_doc_posterior: false,
      plazo_doc_posterior_dias: null,
      accion_incumplimiento_doc_id: "cfg_aid_solo_notificacion",
    },
    cambio_dia_solicitud:
      spec.cambio_dia_solicitud && typeof spec.cambio_dia_solicitud === "object"
        ? { ...spec.cambio_dia_solicitud }
        : {
            schema: "CAMBIO_DIA_V1",
            campos_requeridos: ["fecha_origen", "fecha_destino", "motivo"],
            origen_celdas_ok: ["laborable_con_turno"],
            destino_celdas_ok: ["franco", "apto_sin_turno_exclusivo"],
            aplica_batch: "traslado_propio_b_batch",
            motivo_max_len: 500,
          },
  };

  return { artId, verId, core, version };
}
