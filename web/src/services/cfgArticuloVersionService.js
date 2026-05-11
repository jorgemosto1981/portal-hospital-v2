import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";

import { dbV2 } from "./firebase.js";
import { ARTICULO_SCHEMA_VERSION } from "../schemas/articulo.schema.js";
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
 * Payload persistible: mismos campos que valida Zod + metadatos de contrato para Functions / jobs.
 * @param {import("../schemas/articulo.schema.js").ArticuloVersion} parsed
 */
export function buildFirestoreArticuloVersionDoc(parsed) {
  return {
    ...parsed,
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
  batch.set(
    coreRef,
    {
      version_actual_id: versionId,
      actualizado_en: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}
