import { collection, getDocs } from "firebase/firestore";

import { pickPublishedVersionByCorrespondenciaAnio } from "../../../shared/utils/laoVersionResolver.js";
import { dbV2 as db } from "./firebase.js";

/**
 * Resuelve `ver_*` publicada con `correspondencia_anio` = año de bolsa.
 * @param {string} articuloId
 * @param {number} correspondenciaAnio
 * @returns {Promise<{ versionId: string, correspondencia_anio: number } | null>}
 */
export async function resolvePublishedLaoVersionId(articuloId, correspondenciaAnio) {
  const art = String(articuloId || "").trim();
  const anio = Number(correspondenciaAnio);
  if (!/^art_/i.test(art) || !Number.isInteger(anio) || anio < 1900) {
    return null;
  }

  const snap = await getDocs(collection(db, "cfg_articulos", art, "versiones"));
  const pick = pickPublishedVersionByCorrespondenciaAnio(
    snap.docs.map((docSnap) => ({ id: docSnap.id, data: () => docSnap.data() })),
    anio,
  );
  if (!pick) return null;
  return { versionId: pick.versionId, correspondencia_anio: pick.correspondencia_anio };
}
