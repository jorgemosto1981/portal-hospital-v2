import { z } from 'zod';

/** Fecha civil ISO YYYY-MM-DD (normalización TZ fuera de este archivo). */
export const fechaIsoCivilSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usar fecha ISO YYYY-MM-DD');

export const idArticuloSchema = z.string().regex(/^art_[0-9A-Za-z]{26}$/);
/** Prefijo documental `cfg_tcp_` (mayúsculas/minúsculas; callable normaliza a mayúsculas). */
export const idCfgTcpSchema = z
  .string()
  .regex(/^cfg_tcp_[0-9A-Za-z]{26}$/i, 'ID de tipo de cómputo plazo inválido (cfg_tcp_…)');
/** Unidad de intervalo (cadencia / preaviso) — `cfg_uit_` + ULID. */
export const idCfgUitSchema = z
  .string()
  .regex(/^cfg_uit_[0-9A-Za-z]{26}$/i, 'ID de unidad de intervalo inválido (cfg_uit_…)');
/** Paso de workflow — `cfg_pwa_` + ULID. */
export const idCfgPwaSchema = z
  .string()
  .regex(/^cfg_pwa_[0-9A-Za-z]{26}$/i, 'ID de paso workflow inválido (cfg_pwa_…)');
export const idCfgSchema = z.string().min(1);

export const varianteSarhSchema = z.object({
  codigo_sarh: z.string().min(1),
  etiqueta_ui: z.string().min(1),
  afecta_sueldo_porcentaje: z.number().min(0).max(100),
  activo: z.boolean(),
});

export const variantesSarhSchema = z
  .array(varianteSarhSchema)
  .min(1, 'variantes_sarh debe tener al menos un elemento');

export const filtrosElegibilidadSchema = z
  .object({
    escalafon_ids: z.array(idCfgSchema).optional(),
    agrupamiento_ids: z.array(idCfgSchema).optional(),
    cargo_funcional_ids: z.array(idCfgSchema).optional(),
    tipo_vinculo_ids: z.array(idCfgSchema).optional(),
    efector_ids: z.array(idCfgSchema).optional(),
    grupo_trabajo_ids: z.array(idCfgSchema).optional(),
    genero_ids: z.array(idCfgSchema).optional(),
    excluye_ids: z.array(idCfgSchema).optional(),
  })
  .optional();

/** RFC 1919 — carencia, situación de revista, pre-requisitos clínicos. */
export const reglasElegibilidadAmpliadaSchema = z
  .object({
    antiguedad_minima_meses: z.number().int().nonnegative().optional(),
    situacion_revista_ids: z.array(idCfgSchema).optional(),
    requiere_junta_medica_previa: z.boolean().optional(),
  })
  .optional();

/** RFC 1919 — cadencia, preaviso y límites por periodo. */
export const reglasCadenciaSchema = z
  .object({
    intervalo_minimo_entre_usos_cantidad: z.number().int().nonnegative().optional(),
    intervalo_minimo_entre_usos_unidad_id: idCfgUitSchema.optional(),
    preaviso_cantidad: z.number().int().nonnegative().optional(),
    preaviso_unidad_id: idCfgUitSchema.optional(),
    duracion_minima_solicitud_cantidad: z.number().int().nonnegative().optional(),
    limite_maximo_periodo_cantidad: z.number().int().nonnegative().optional(),
    limite_maximo_periodo_unidad_id: idCfgUitSchema.optional(),
  })
  .optional();

/** Documento cfg_articulos — borrador / guardado parcial. */
export const cfgArticuloBorradorSchema = z.object({
  id: idArticuloSchema.optional(),

  variantes_sarh: variantesSarhSchema,

  norma_principal_tipo_id: idCfgSchema.optional(),
  norma_principal_referencia: z.string().optional(),
  inciso_normativo: z.string().optional(),
  titulo: z.string().min(1).optional(),
  descripcion_operativa: z.string().optional(),

  tipo_articulo_id: idCfgSchema.optional(),
  unidad_medida_id: idCfgSchema.optional(),

  activo: z.boolean().optional(),
  vigente_desde: fechaIsoCivilSchema.nullable().optional(),
  vigente_hasta: fechaIsoCivilSchema.nullable().optional(),

  permite_alta_iniciada_por_jefe_grupo: z.boolean().optional(),
  requiere_autorizacion_jefe: z.boolean().optional(),
  origen_alta_id_default: idCfgSchema.optional(),

  permite_aprobacion_parcial: z.boolean().optional(),
  regla_split_remanente_id: idCfgSchema.optional(),
  permite_remanente_sin_articulo: z.boolean().optional(),
  permite_nueva_solicitud_remanente: z.boolean().optional(),
  requiere_decision_rrhh_para_remanente: z.boolean().optional(),
  requiere_auditoria_medica: z.boolean().optional(),

  documentacion_diferida_habilitada: z.boolean().optional(),
  momento_entrega_documentacion_id: idCfgSchema.optional(),
  plazo_documental_post_inicio_dias: z.number().int().nonnegative().optional(),
  plazo_documental_post_inicio_horas: z.number().int().nonnegative().optional(),
  plazo_documental_tipo_dias_id: idCfgTcpSchema.optional(),
  accion_vencimiento_documental_id: idCfgSchema.optional(),
  documentacion_certificado_obligatorio: z.boolean().optional(),

  admite_reemplazo: z.boolean().optional(),
  dispara_evento_contrataciones: z.boolean().optional(),
  prioridad_normativa_id: idCfgSchema.optional(),
  politica_superposicion_id: idCfgSchema.optional(),
  articulos_incompatibles_ids: z.array(idArticuloSchema).optional(),
  articulos_interrupcion_permitida_ids: z.array(idArticuloSchema).optional(),

  paso_workflow_articulo_ids: z.array(idCfgPwaSchema).optional(),
  requiere_asesoria_letrada: z.boolean().optional(),
  requiere_dictamen_medicina_laboral: z.boolean().optional(),

  reglas_elegibilidad_ampliada: reglasElegibilidadAmpliadaSchema,
  reglas_cadencia: reglasCadenciaSchema,

  filtros_elegibilidad: filtrosElegibilidadSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => {
  const rc = data.reglas_cadencia;
  if (!rc || typeof rc !== 'object') return;
  if (
    rc.intervalo_minimo_entre_usos_cantidad != null &&
    rc.intervalo_minimo_entre_usos_cantidad > 0 &&
    !rc.intervalo_minimo_entre_usos_unidad_id
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Con intervalo mínimo entre usos > 0 se requiere unidad (cfg_unidad_intervalo_tiempo).',
      path: ['reglas_cadencia', 'intervalo_minimo_entre_usos_unidad_id'],
    });
  }
  if (
    rc.preaviso_cantidad != null &&
    rc.preaviso_cantidad > 0 &&
    !rc.preaviso_unidad_id
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Con preaviso > 0 se requiere unidad (cfg_unidad_intervalo_tiempo).',
      path: ['reglas_cadencia', 'preaviso_unidad_id'],
    });
  }
  if (
    rc.limite_maximo_periodo_cantidad != null &&
    rc.limite_maximo_periodo_cantidad > 0 &&
    !rc.limite_maximo_periodo_unidad_id
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Con límite por periodo > 0 se requiere unidad de periodo.',
      path: ['reglas_cadencia', 'limite_maximo_periodo_unidad_id'],
    });
  }
});

/** Publicación: campos mínimos + ≥1 variante SARH con activo: true. */
export const cfgArticuloPublicableSchema = cfgArticuloBorradorSchema
  .required({
    titulo: true,
    tipo_articulo_id: true,
    unidad_medida_id: true,
  })
  .superRefine((data, ctx) => {
    const activas = data.variantes_sarh.filter((v) => v.activo);
    if (activas.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Para publicar se requiere al menos una variante SARH con activo: true',
        path: ['variantes_sarh'],
      });
    }
  });

export const cfgArticuloPublicadoSchema = cfgArticuloPublicableSchema;
