"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { FieldPath } = require("firebase-admin/firestore");
const { db, FieldValue } = require("./shared/context");
const runtimeFlags = require("../../shared/runtimeFlags.json");
const {
  assertColeccionOnboardingLectura,
  assertColeccionRrhh,
  assertRrhh,
  normalizeCatalogDocId,
  serializeFirestoreValue,
  toTimestampOrNull,
} = require("./shared/helpers");
const { COLECCIONES_PUBLICAS_TEMPORALES, normalizeGrupoTrabajoIdV2 } = require("./catalogosShared");

const listarColeccion = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const col = assertColeccionRrhh(request.data && request.data.collectionName);
  const snap = await db.collection(col).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const flat = serializeFirestoreValue(data);
    const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { ...base, id: doc.id };
  });
  return { items };
});

const guardarOpcion = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const col = assertColeccionRrhh(request.data && request.data.collectionName);
  const datos =
    request.data && request.data.datos && typeof request.data.datos === "object" ? request.data.datos : {};
  const id = col === "grupos_de_trabajo" ? normalizeGrupoTrabajoIdV2(datos.id) : normalizeCatalogDocId(datos.id);
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) throw new HttpsError("invalid-argument", "[VAL-CFG-001] El nombre es obligatorio.");
  const activo = datos.activo !== false;
  const ref = db.collection(col).doc(id);
  const exists = (await ref.get()).exists;
  const payload = { id, nombre, activo, actualizado_en: FieldValue.serverTimestamp() };
  if ("vigente_desde" in datos) {
    payload.vigente_desde =
      datos.vigente_desde == null || datos.vigente_desde === "" ? null : toTimestampOrNull(datos.vigente_desde);
  }
  if ("vigente_hasta" in datos) {
    payload.vigente_hasta =
      datos.vigente_hasta == null || datos.vigente_hasta === "" ? null : toTimestampOrNull(datos.vigente_hasta);
  }
  if (!exists) payload.creado_en = FieldValue.serverTimestamp();
  if (col === "cfg_localidad" && "provincia_id" in datos) {
    const raw = datos.provincia_id;
    payload.provincia_id = raw == null || raw === "" ? null : normalizeCatalogDocId(String(raw));
  }
  await ref.set(payload, { merge: true });
  return { ok: true, id };
});

const listarCatalogoOnboarding = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere sesión.");
  const col = assertColeccionOnboardingLectura(request.data && request.data.collectionName);
  const snap = await db.collection(col).get();
  const items = snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      if (Object.hasOwn(data, "activo") && data.activo === false) return null;
      const flat = serializeFirestoreValue(data);
      const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
      return { ...base, id: doc.id };
    })
    .filter(Boolean);
  return { items };
});

const listarColeccionPublicaTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) throw new HttpsError("permission-denied", "[VAL-CFG-002] Acceso temporal deshabilitado.");
  const colRaw = request.data && request.data.collectionName;
  if (typeof colRaw !== "string" || !COLECCIONES_PUBLICAS_TEMPORALES.has(colRaw.trim())) {
    throw new HttpsError("invalid-argument", "[VAL-CFG-003] Colección no permitida en acceso temporal.");
  }
  const col = colRaw.trim();
  const pageSizeRaw = Number(request.data && request.data.pageSize);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(500, Math.trunc(pageSizeRaw))) : 200;
  const pageTokenRaw = request.data && request.data.pageToken;
  const pageToken = typeof pageTokenRaw === "string" ? pageTokenRaw.trim() : "";

  let q = db.collection(col).orderBy(FieldPath.documentId()).limit(pageSize);
  if (pageToken) q = q.startAfter(pageToken);
  const snap = await q.get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const flat = serializeFirestoreValue(data);
    const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { ...base, id: doc.id };
  });
  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  const hasMore = snap.size === pageSize;
  return {
    items,
    hasMore,
    nextPageToken: hasMore && lastDoc ? String(lastDoc.id) : null,
  };
});

module.exports = {
  listarColeccion,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
};
