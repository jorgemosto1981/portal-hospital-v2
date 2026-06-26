import { ref, uploadBytes } from "firebase/storage";

import { storageV2 } from "./firebase.js";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * @param {File} file
 * @param {{ authUid: string, year?: number }} opts
 * @returns {Promise<{ storage_path: string, content_type: string, nombre_archivo: string }>}
 */
export async function subirCertificadoAvisoMedico(file, { authUid, year }) {
  const uid = String(authUid || "").trim();
  if (!uid) {
    throw new Error("Sesión inválida para subir el certificado.");
  }
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Seleccioná un archivo válido.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("El archivo no puede superar 10 MB.");
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Formato no permitido. Usá PDF o imagen (JPG, PNG, WebP).");
  }

  const y = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeName = String(file.name || "certificado")
    .replace(/[^\w.\-()+ ]/gi, "_")
    .slice(0, 120);
  const storagePath = `avisos-med/${y}/${uid}/${Date.now()}_${safeName}`;
  const storageRef = ref(storageV2, storagePath);
  const snap = await uploadBytes(storageRef, file, {
    contentType,
    cacheControl: "private,max-age=3600",
  });

  return {
    storage_path: snap.metadata.fullPath || storagePath,
    content_type: snap.metadata.contentType || contentType,
    nombre_archivo: file.name || safeName,
  };
}
