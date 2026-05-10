import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";

import { dbV2 } from "./firebase.js";
import { generarArticuloId } from "../utils/generarId.js";

/** Colección canónica `cfg_articulos` (módulo configuración artículos V2). */
export const CFG_ARTICULOS_COLLECTION = "cfg_articulos";

/**
 * Elimina `undefined` recursivamente (Firestore no acepta undefined).
 * @param {unknown} value
 */
export function stripUndefinedDeep(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      const inner = stripUndefinedDeep(v);
      if (inner === undefined) continue;
      out[k] = inner;
    }
    return out;
  }
  return value;
}

/**
 * @param {string} articuloId
 * @returns {Promise<(Record<string, unknown> & { id: string }) | null>}
 */
export async function obtenerArticuloCfgPorId(articuloId) {
  if (!articuloId || typeof articuloId !== "string") return null;
  const ref = doc(dbV2, CFG_ARTICULOS_COLLECTION, articuloId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Lista documentos de `cfg_articulos` (Firestore directo; rules RRHH).
 * Orden: `actualizado_en` descendente cuando existe Timestamp.
 * @returns {Promise<Array<{ id: string, titulo: string, activo: boolean, actualizado_en: unknown, creado_en: unknown }>>}
 */
export async function listarArticulosCfgResumen() {
  const snap = await getDocs(collection(dbV2, CFG_ARTICULOS_COLLECTION));
  const rows = snap.docs.map((d) => {
    const x = d.data() || {};
    return {
      id: d.id,
      titulo: typeof x.titulo === "string" ? x.titulo : "",
      activo: x.activo !== false,
      actualizado_en: x.actualizado_en ?? null,
      creado_en: x.creado_en ?? null,
    };
  });
  rows.sort((a, b) => {
    const ma =
      a.actualizado_en && typeof a.actualizado_en.toMillis === "function"
        ? a.actualizado_en.toMillis()
        : 0;
    const mb =
      b.actualizado_en && typeof b.actualizado_en.toMillis === "function"
        ? b.actualizado_en.toMillis()
        : 0;
    return mb - ma;
  });
  return rows;
}

/**
 * Alta de cfg_articulos (timestamps del servidor).
 * @param {Record<string, unknown>} payload — ya validado con Zod en capa superior.
 * @param {{ personaId?: string }} [opciones]
 */
export async function crearArticuloCfg(payload, opciones = {}) {
  const id = generarArticuloId();
  const ref = doc(dbV2, CFG_ARTICULOS_COLLECTION, id);
  const base = stripUndefinedDeep(payload) ?? {};
  /** @type {Record<string, unknown>} */
  const data = {
    ...base,
    id,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  };
  if (opciones.personaId) {
    data.actualizado_por_persona_id = opciones.personaId;
  }
  await setDoc(ref, data);
  return { id };
}

/**
 * Actualización por merge (timestamps del servidor).
 * @param {string} articuloId
 * @param {Record<string, unknown>} payload — ya validado con Zod en capa superior.
 * @param {{ personaId?: string }} [opciones]
 */
export async function actualizarArticuloCfg(articuloId, payload, opciones = {}) {
  const ref = doc(dbV2, CFG_ARTICULOS_COLLECTION, articuloId);
  const base = stripUndefinedDeep(payload) ?? {};
  /** @type {Record<string, unknown>} */
  const data = {
    ...base,
    id: articuloId,
    actualizado_en: serverTimestamp(),
  };
  if (opciones.personaId) {
    data.actualizado_por_persona_id = opciones.personaId;
  }
  await setDoc(ref, data, { merge: true });
}
