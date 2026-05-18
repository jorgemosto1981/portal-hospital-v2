"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldPath } = require("firebase-admin/firestore");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhAccess, serializeFirestoreValue } = require("../../modules/shared/helpers");

function personaEsActiva(data) {
  if (!data || typeof data !== "object") return false;
  if (data.activo === false) return false;
  const est = String(data.estado || "").trim().toUpperCase();
  if (est === "INACTIVO" || est === "BAJA") return false;
  return true;
}

function mapPersonaDoc(docSnap) {
  const flat = serializeFirestoreValue(docSnap.data() || {});
  const data = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
  return {
    id: docSnap.id,
    nombre: data.nombre ?? "",
    apellido: data.apellido ?? "",
    dni: data.dni ?? "",
    activo: data.activo !== false,
    estado: data.estado ?? "",
  };
}

const buscarPersonasCheckinRrhh = onCall(async (request) => {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede buscar personas.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const query = String(d.query ?? "").trim();
  const limitRaw = Number(d.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 30;

  if (/^per_[0-9A-HJKMNP-TV-Z]{26}$/i.test(query)) {
    const snap = await db.collection("personas").doc(query).get();
    const items =
      snap.exists && personaEsActiva(snap.data()) ? [mapPersonaDoc(snap)] : [];
    return { ok: true, items, truncado: false };
  }

  const dniNorm = query.replace(/\D/g, "");
  if (dniNorm.length >= 6) {
    const snap = await db.collection("personas").where("dni", "==", dniNorm).limit(10).get();
    const items = snap.docs
      .filter((doc) => personaEsActiva(doc.data()))
      .slice(0, limit)
      .map(mapPersonaDoc);
    return { ok: true, items, truncado: snap.size > limit };
  }

  const scanLimit = 450;
  const snap = await db.collection("personas").orderBy(FieldPath.documentId()).limit(scanLimit).get();
  const q = query.toLowerCase();

  const items = snap.docs
    .filter((doc) => personaEsActiva(doc.data()))
    .filter((doc) => {
      if (!q) return true;
      const data = doc.data() || {};
      const blob = `${data.nombre} ${data.apellido} ${data.dni} ${doc.id}`.toLowerCase();
      return blob.includes(q);
    })
    .slice(0, limit)
    .map(mapPersonaDoc);

  return {
    ok: true,
    items,
    truncado: snap.size >= scanLimit && items.length >= limit,
  };
});

module.exports = { buscarPersonasCheckinRrhh };
