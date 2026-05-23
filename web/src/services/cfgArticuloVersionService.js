import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { z } from "zod";

import { dbV2 } from "./firebase.js";
import { ARTICULO_SCHEMA_VERSION, cfgArticuloVersionSchema } from "../schemas/articulo.schema.js";
import { ulid } from "ulid";

/** @returns {string} id `art_<ULID>` */
export function newArticuloDocumentId() {
  return `art_${ulid()}`;
}

/** @returns {string} id `ver_<ULID>` */
export function newVersionDocumentId() {
  return `ver_${ulid()}`;
}

/**
 * Objeto plano JSON-like (no Date/FieldValue dentro del payload de versión validado).
 * @param {unknown} value
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Política NULL explícito: cualquier `undefined` → `null` de forma recursiva.
 * No altera instancias no planas (por si el payload incluye tipos especiales fuera del schema).
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function deepUndefinedToNull(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => deepUndefinedToNull(item));
  if (!isPlainObject(value)) return value;

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const k of Object.keys(value)) {
    const v = value[k];
    out[k] = v === undefined ? null : deepUndefinedToNull(v);
  }
  return out;
}

/**
 * @param {import("zod").ZodTypeAny} schema
 * @returns {import("zod").ZodObject | null}
 */
function getZodObject(schema) {
  let s = schema;
  if (s._def?.typeName === "ZodEffects") {
    s = s._def.schema;
  }
  return s instanceof z.ZodObject ? s : null;
}

/**
 * Quita solo Optional/Nullable externos (no Default), para detectar objeto anidado.
 *
 * @param {import("zod").ZodTypeAny} schema
 */
function unwrapOptionalNullable(schema) {
  let s = schema;
  while (s._def?.typeName === "ZodOptional" || s._def?.typeName === "ZodNullable") {
    s = s._def.innerType;
  }
  return s;
}

/**
 * Alinea el documento a llaves del schema: opcionales ausentes → `null`;
 * objetos anidados siempre presentes con subcampos explícitos;
 * respeta `ZodDefault` cuando falta el valor (p. ej. boolean false, intervalo_gracia 0).
 *
 * @param {Record<string, unknown>} data
 * @param {import("zod").ZodObject} [zodObj]
 * @returns {Record<string, unknown>}
 */
export function expandArticuloVersionExplicitNulls(data, zodObj = cfgArticuloVersionSchema) {
  const obj = getZodObject(zodObj);
  if (!obj) return /** @type {Record<string, unknown>} */ (deepUndefinedToNull(data));

  const shape = obj.shape;
  const src = isPlainObject(data) ? data : {};
  /** @type {Record<string, unknown>} */
  const out = {};

  for (const key of Object.keys(shape)) {
    const fieldSchema = shape[key];
    const rawVal = src[key];

    if (fieldSchema._def?.typeName === "ZodDefault") {
      const innerType = fieldSchema._def.innerType;
      const defFn = fieldSchema._def.defaultValue;
      const defVal = typeof defFn === "function" ? defFn() : defFn;
      const innerObj = getZodObject(innerType);

      if (rawVal === undefined) {
        out[key] = innerObj ? expandArticuloVersionExplicitNulls({}, innerObj) : defVal;
      } else if (innerObj && isPlainObject(rawVal)) {
        out[key] = expandArticuloVersionExplicitNulls(rawVal, innerObj);
      } else {
        out[key] = rawVal === undefined ? null : deepUndefinedToNull(rawVal);
      }
      continue;
    }

    const unwrapped = unwrapOptionalNullable(fieldSchema);
    const nestedObj = getZodObject(unwrapped);

    if (nestedObj) {
      const childSrc = rawVal === undefined || rawVal === null ? {} : rawVal;
      out[key] = expandArticuloVersionExplicitNulls(
        isPlainObject(childSrc) ? childSrc : {},
        nestedObj,
      );
      continue;
    }

    out[key] = rawVal === undefined ? null : deepUndefinedToNull(rawVal);
  }

  return out;
}

/**
 * Clon JSON del payload de versión (post-Zod) para aplicar reglas de negocio sin mutar el original.
 * @param {import("../schemas/articulo.schema.js").ArticuloVersion} parsed
 */
function cloneArticuloVersionRecord(parsed) {
  return /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(parsed)));
}

/**
 * Guardián Paso 0 LAO: si no es LAO anual, fuerza `null` en parámetros LAO del Bloque 4 (evita basura en Firestore).
 * @param {import("../schemas/articulo.schema.js").ArticuloVersion} parsed
 * @returns {import("../schemas/articulo.schema.js").ArticuloVersion}
 */
export function applyLaoBloque4Guardian(parsed) {
  const v = cloneArticuloVersionRecord(parsed);
  const esLao = v?.bloque_identidad_naturaleza?.es_lao_anual === true;
  const topes = v.bloque_topes_plazos_computo;
  if (!topes || typeof topes !== "object") return /** @type {import("../schemas/articulo.schema.js").ArticuloVersion} */ (v);
  if (!esLao) {
    v.bloque_topes_plazos_computo = {
      ...topes,
      correspondencia_anio: null,
      fecha_corte_antiguedad: null,
      matriz_antiguedad_reglas: null,
      mes_dia_apertura_solicitudes: null,
      tse_minimo_dias_base: null,
      permite_calculo_proporcional_tse: null,
    };
  }
  return /** @type {import("../schemas/articulo.schema.js").ArticuloVersion} */ (v);
}

/**
 * Payload persistible: schema + política NULL explícito + metadatos de contrato para Functions / jobs.
 * @param {import("../schemas/articulo.schema.js").ArticuloVersion} parsed
 */
export function buildFirestoreArticuloVersionDoc(parsed) {
  const guarded = applyLaoBloque4Guardian(parsed);
  const expanded = expandArticuloVersionExplicitNulls(
    /** @type {Record<string, unknown>} */ (guarded),
  );
  const cleaned = deepUndefinedToNull(expanded);
  return {
    ...cleaned,
    schema_contract_version: ARTICULO_SCHEMA_VERSION,
    actualizado_en: serverTimestamp(),
  };
}

/**
 * Escribe `cfg_articulos/{articuloId}/versiones/{versionId}` (reemplazo del documento).
 * @param {string} articuloId `art_…`
 * @param {string} versionId `ver_…`
 * @param {import("../schemas/articulo.schema.js").ArticuloVersion} parsed
 */
export async function saveCfgArticuloVersionEnFirestore(articuloId, versionId, parsed) {
  const ref = doc(dbV2, "cfg_articulos", articuloId, "versiones", versionId);
  await setDoc(ref, buildFirestoreArticuloVersionDoc(parsed), { merge: false });
}

/**
 * Escritura atómica: documento de versión + `version_actual_id` (merge) en la raíz del artículo.
 * Si el núcleo no existía, crea un stub mínimo con el puntero (completar campos core vía seed/callable).
 *
 * @param {string} articuloId `art_…`
 * @param {string} versionId `ver_…`
 * @param {import("../schemas/articulo.schema.js").ArticuloVersion} parsed
 */
export async function saveArticuloVersionAndPunteroCore(articuloId, versionId, parsed) {
  const batch = writeBatch(dbV2);
  const verRef = doc(dbV2, "cfg_articulos", articuloId, "versiones", versionId);
  const coreRef = doc(dbV2, "cfg_articulos", articuloId);
  batch.set(verRef, buildFirestoreArticuloVersionDoc(parsed), { merge: false });
  const identidad = parsed.bloque_identidad_naturaleza ?? {};
  batch.set(
    coreRef,
    {
      version_actual_id: versionId,
      codigo: identidad.codigo ?? null,
      inciso_normativo: identidad.inciso_normativo ?? null,
      nombre: identidad.nombre ?? null,
      es_sancion: identidad.es_sancion ?? false,
      es_inasistencia: identidad.es_inasistencia ?? false,
      es_sin_goce: identidad.es_sin_goce ?? false,
      requiere_dictamen: identidad.requiere_dictamen ?? false,
      activo: true,
      actualizado_en: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}
