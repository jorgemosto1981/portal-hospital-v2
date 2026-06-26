/**
 * Contrato documento `solicitudes_articulo` — unión por `schema_version` (create cliente).
 * @see docs/v2/RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md §2.2
 */

import { z } from "zod";

import {
  ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA,
  PATRON_SALDO_MEDICO_AVISO,
  SCHEMA_SOLICITUD_MED_AVISO,
  SCHEMA_SOLICITUD_PATRON_B,
  SCHEMA_SOLICITUD_PATRON_C,
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../constants/solicitudesArticuloV2.js";
import {
  solicitudArticuloCreateShapePatronBSchema,
  solicitudArticuloCreateShapePatronCSchema,
} from "./solicitudArticuloCreate.schema.js";

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

const perIdSchema = z.string().regex(new RegExp(`^per_${ULID}$`, "i"));
const gdtIdSchema = z.string().regex(new RegExp(`^gdt_${ULID}$`, "i"));
const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cfgTigIdSchema = z.enum([
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
]);

export const ingresoMedicoAdjuntoSchema = z
  .object({
    storage_path: z.string().min(1).max(1024),
    content_type: z.string().max(128).optional(),
    nombre_archivo: z.string().max(256).optional(),
  })
  .strict();

export const declaracionContactoAvisoSchema = z
  .object({
    usar_datos_perfil: z.boolean(),
    telefono_celular: z.string().min(6).max(32),
    telefono_fijo: z.string().max(32).optional(),
    domicilio_declarado: z.string().min(3).max(512),
    permanece_en_domicilio: z.boolean(),
    usar_email_perfil: z.boolean(),
    email: z.string().email().max(256),
  })
  .strict();

export const declaracionClinicaAvisoSchema = z
  .object({
    sintomas: z.string().max(2000).optional(),
    enfermedad: z.string().max(500).optional(),
    codigo_cie: z.string().max(16).optional(),
    detalle: z.string().max(2000).optional(),
  })
  .strict();

export const familiarAtendidoAvisoSchema = z
  .object({
    declaracion_grupo_familiar_id: z.string().regex(/^gf_[0-9A-HJKMNP-TV-Z]{26}$/i),
    familiar_id: z.string().min(1).max(64),
    nombre: z.string().min(1).max(120),
    apellido: z.string().min(1).max(120),
    dni: z.string().min(6).max(16),
    parentesco_id: z.string().max(64).optional(),
  })
  .strict();

const ingresoMedicoBaseSchema = z.object({
  modo: z.literal("caja_negra"),
  tipo_ingreso_id: cfgTigIdSchema,
  comentario_agente: z.string().max(2000).optional(),
  declaracion_contacto: declaracionContactoAvisoSchema,
  declaracion_clinica: declaracionClinicaAvisoSchema.optional(),
  familiar_atendido: familiarAtendidoAvisoSchema.optional(),
});

const ingresoMedicoCompletoSchema = ingresoMedicoBaseSchema
  .extend({
    es_licencia_incompleta: z.literal(false),
    adjuntos: z.array(ingresoMedicoAdjuntoSchema).min(1).max(10),
  })
  .strict();

const ingresoMedicoIncompletoSchema = ingresoMedicoBaseSchema
  .extend({
    es_licencia_incompleta: z.literal(true),
    adjuntos: z.array(ingresoMedicoAdjuntoSchema).max(10).default([]),
    timestamp_aviso_incompleto: z.string().min(1).max(64),
  })
  .strict();

export const ingresoMedicoCajaNegraSchema = z.discriminatedUnion("es_licencia_incompleta", [
  ingresoMedicoCompletoSchema,
  ingresoMedicoIncompletoSchema,
]);

const solicitudMedAvisoAltaInputBase = z.object({
  personaId: perIdSchema,
  tipoIngresoId: cfgTigIdSchema,
  grupoTrabajoIdAncla: gdtIdSchema,
  fechaInicioReposoEstimada: ymdSchema,
  fechaFinReposoEstimada: ymdSchema.optional(),
  fechaReferenciaHoyBa: ymdSchema,
  comentarioAgente: z.string().max(2000).optional(),
  esLicenciaIncompleta: z.boolean().default(false),
  declaracionContacto: declaracionContactoAvisoSchema,
  declaracionClinica: declaracionClinicaAvisoSchema.optional(),
  familiarAtendido: familiarAtendidoAvisoSchema.optional(),
});

/** Parámetros UI — aviso médico antes de clasificación auditor. */
export const solicitudMedAvisoAltaInputSchema = solicitudMedAvisoAltaInputBase
  .extend({
    adjuntos: z.array(ingresoMedicoAdjuntoSchema).max(10).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.fechaInicioReposoEstimada < data.fechaReferenciaHoyBa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de inicio del reposo no puede ser anterior a hoy.",
        path: ["fechaInicioReposoEstimada"],
      });
    }
    const fin = data.fechaFinReposoEstimada || data.fechaInicioReposoEstimada;
    if (fin && fin < data.fechaInicioReposoEstimada) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de fin no puede ser anterior al inicio del reposo.",
        path: ["fechaFinReposoEstimada"],
      });
    }
    if (data.tipoIngresoId === TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR) {
      if (!data.familiarAtendido) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Seleccioná el familiar que vas a atender.",
          path: ["familiarAtendido"],
        });
      }
    } else if (data.familiarAtendido) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Solo el aviso por familiar enfermo incluye familiar_atendido.",
        path: ["familiarAtendido"],
      });
    }
    if (data.esLicenciaIncompleta) {
      if (data.adjuntos && data.adjuntos.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Aviso incompleto no debe incluir adjuntos en el alta.",
          path: ["adjuntos"],
        });
      }
      return;
    }
    if (!data.fechaFinReposoEstimada) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indicá la fecha estimada de fin del reposo.",
        path: ["fechaFinReposoEstimada"],
      });
    }
    const clin = data.declaracionClinica || {};
    const tieneManifestacion =
      Boolean(String(clin.sintomas || "").trim()) ||
      Boolean(String(clin.enfermedad || "").trim()) ||
      Boolean(String(clin.codigo_cie || "").trim());
    if (!tieneManifestacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indicá síntomas, enfermedad o código CIE.",
        path: ["declaracionClinica"],
      });
    }
    if (!data.adjuntos || data.adjuntos.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Adjuntá el certificado médico.",
        path: ["adjuntos"],
      });
    }
  });

const solicitudMedAvisoDocumentBase = z.object({
  schema_version: z.literal(SCHEMA_SOLICITUD_MED_AVISO),
  articulo_id: z.null(),
  version_id_aplicada: z.null(),
  titular_persona_id: perIdSchema,
  actor_alta_persona_id: perIdSchema,
  grupo_trabajo_id_ancla: gdtIdSchema,
  patron_saldo: z.literal(PATRON_SALDO_MEDICO_AVISO),
  estado_solicitud_id: z.literal(ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA),
  ingreso_medico: ingresoMedicoCajaNegraSchema,
  fecha_inicio_reposo_estimada: ymdSchema.optional(),
  fecha_fin_reposo_estimada: ymdSchema.optional(),
  vencimiento_plazo_certificado: z.unknown().optional(),
  creado_en: z.unknown(),
  actualizado_en: z.unknown(),
});

export const solicitudArticuloCreateShapeMedAvisoSchema = solicitudMedAvisoDocumentBase
  .strict()
  .superRefine((doc, ctx) => {
    const inc = doc.ingreso_medico.es_licencia_incompleta === true;
    if (inc && doc.vencimiento_plazo_certificado == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "vencimiento_plazo_certificado obligatorio en aviso incompleto.",
        path: ["vencimiento_plazo_certificado"],
      });
    }
    if (!inc && "vencimiento_plazo_certificado" in doc && doc.vencimiento_plazo_certificado != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "vencimiento_plazo_certificado solo aplica a aviso incompleto.",
        path: ["vencimiento_plazo_certificado"],
      });
    }
  });

/**
 * @param {z.infer<typeof solicitudMedAvisoAltaInputSchema>} input
 * @param {{
 *   creado_en: unknown,
 *   actualizado_en: unknown,
 *   vencimiento_plazo_certificado?: unknown,
 *   timestampAvisoIncompletoIso?: string,
 * }} timestamps
 */
export function buildSolicitudMedAvisoDocument(input, timestamps) {
  const parsed = solicitudMedAvisoAltaInputSchema.parse(input);
  const esIncompleta = parsed.esLicenciaIncompleta === true;

  /** @type {Record<string, unknown>} */
  const ingreso = {
    modo: "caja_negra",
    tipo_ingreso_id: parsed.tipoIngresoId,
    es_licencia_incompleta: esIncompleta,
    adjuntos: esIncompleta ? [] : parsed.adjuntos || [],
    declaracion_contacto: parsed.declaracionContacto,
  };
  if (parsed.familiarAtendido) {
    ingreso.familiar_atendido = parsed.familiarAtendido;
  }
  if (!esIncompleta && parsed.declaracionClinica) {
    ingreso.declaracion_clinica = parsed.declaracionClinica;
  }
  if (parsed.comentarioAgente) {
    ingreso.comentario_agente = parsed.comentarioAgente;
  }
  if (esIncompleta) {
    ingreso.timestamp_aviso_incompleto =
      timestamps.timestampAvisoIncompletoIso || new Date().toISOString();
  }

  /** @type {Record<string, unknown>} */
  const doc = {
    schema_version: SCHEMA_SOLICITUD_MED_AVISO,
    articulo_id: null,
    version_id_aplicada: null,
    titular_persona_id: parsed.personaId,
    actor_alta_persona_id: parsed.personaId,
    grupo_trabajo_id_ancla: parsed.grupoTrabajoIdAncla,
    patron_saldo: PATRON_SALDO_MEDICO_AVISO,
    estado_solicitud_id: ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA,
    ingreso_medico: ingreso,
    creado_en: timestamps.creado_en,
    actualizado_en: timestamps.actualizado_en,
  };
  if (parsed.fechaInicioReposoEstimada) {
    doc.fecha_inicio_reposo_estimada = parsed.fechaInicioReposoEstimada;
  }
  const finReposo = parsed.fechaFinReposoEstimada || parsed.fechaInicioReposoEstimada;
  if (finReposo) {
    doc.fecha_fin_reposo_estimada = finReposo;
  }
  if (esIncompleta && timestamps.vencimiento_plazo_certificado != null) {
    doc.vencimiento_plazo_certificado = timestamps.vencimiento_plazo_certificado;
  }
  return solicitudArticuloCreateShapeMedAvisoSchema.parse(doc);
}

export const solicitudArticuloCreateDocumentSchema = z.union([
  solicitudArticuloCreateShapePatronBSchema,
  solicitudArticuloCreateShapePatronCSchema,
  solicitudArticuloCreateShapeMedAvisoSchema,
]);

export function parseSolicitudArticuloCreateDocument(doc) {
  return solicitudArticuloCreateDocumentSchema.parse(doc);
}
