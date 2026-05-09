import { z } from 'zod';

/** Fecha civil ISO YYYY-MM-DD (normalización TZ fuera de este archivo). */
export const fechaIsoCivilSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usar fecha ISO YYYY-MM-DD');

export const idArticuloSchema = z.string().regex(/^art_[0-9A-Za-z]{26}$/);
export const idCfgTcpSchema = z.string().regex(/^cfg_tcp_[0-9A-Za-z]{26}$/);
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
  plazo_documental_tipo_dias_id: idCfgTcpSchema.optional(),
  accion_vencimiento_documental_id: idCfgSchema.optional(),

  admite_reemplazo: z.boolean().optional(),
  dispara_evento_contrataciones: z.boolean().optional(),
  prioridad_normativa_id: idCfgSchema.optional(),
  politica_superposicion_id: idCfgSchema.optional(),
  articulos_incompatibles_ids: z.array(idArticuloSchema).optional(),

  filtros_elegibilidad: filtrosElegibilidadSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
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
