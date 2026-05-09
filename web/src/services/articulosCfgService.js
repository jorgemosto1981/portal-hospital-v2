import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

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
