/**
 * Builder cfg_articulos + versión publicada — Art. 77-0 Inasistencia injustificada.
 * @see docs/v2/RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md
 */
export function buildArt770Documents(spec, ids) {
  const { artId, verId } = ids;
  const circuito =
    Array.isArray(spec.circuito_ingreso_ids) && spec.circuito_ingreso_ids.length
      ? spec.circuito_ingreso_ids
      : ["CFG_RRHH"];

  const fechaDesde = spec.fecha_desde || "2026-01-01";
  const codigo = String(spec.codigo || "77-0");
  const nombre = String(spec.nombre || "INASISTENCIA INJUSTIFICADA");
  const inciso = String(
    spec.inciso_normativo || "Ley 8525/79 art. 53.a — inasistencias injustificadas",
  );
  const grilla = String(spec.codigo_grilla || codigo);
  const color = String(spec.color_ui || "#B91C1C");
  const origenNorm =
    String(spec.origen_normativo_id || "cfg_ona_decree_1919").trim() || "cfg_ona_decree_1919";

  const umbralDias =
    spec.umbral_inasistencias_injustificadas_dias == null
      ? 10
      : Math.max(1, Math.floor(Number(spec.umbral_inasistencias_injustificadas_dias)));
  const ventanaMeses =
    spec.ventana_acumulado_meses == null
      ? 12
      : Math.max(1, Math.floor(Number(spec.ventana_acumulado_meses)));

  const core = {
    codigo,
    inciso_normativo: inciso,
    nombre,
    origen_normativo_id: origenNorm,
    es_sancion: true,
    es_inasistencia: true,
    es_sin_goce: true,
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
        resolucion: null,
        interno_efector: "EGAP Ley 8525/79 art. 53.a",
      },
      es_lao_anual: false,
      es_sancion: true,
      es_inasistencia: true,
      es_sin_goce: true,
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
      justifica_sueldo_id: "cfg_js_no",
      suma_para_sac: false,
      afecta_presentismo: true,
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
      tope_dias_por_evento: null,
      dias_minimos_por_evento: null,
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
      plazo_preaviso_interno_dias: null,
      logistica_aviso_habilitada: false,
      toma_conocimiento_limitada: false,
      permite_retroactividad: true,
      requiere_toma_conocimiento_superior: false,
      modo_resolucion_jefe: "ninguno",
      umbral_inasistencias_injustificadas_dias: umbralDias,
      ventana_acumulado_meses: ventanaMeses,
      notificar_rrhh_al_umbral: true,
    },
    bloque_documentacion_convivencia: {
      requiere_adjunto_obligatorio: false,
      requiere_doc_previa: false,
      plazo_doc_previa_dias: null,
      requiere_doc_posterior: false,
      plazo_doc_posterior_dias: null,
      accion_incumplimiento_doc_id: "cfg_aid_solo_notificacion",
    },
  };

  return { artId, verId, core, version };
}
