"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhAccess, serializeFirestoreValue } = require("../../modules/shared/helpers");
const { saldoAnualDocId, saldoGlobalDocId } = require("../../modules/shared/laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";

function assertRrhh(request) {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede consultar saldos de check-in.");
  }
}

/**
 * Conserva bolsas relevantes al check-in (LAO histórico, ciclo A, global C).
 * @param {Record<string, unknown>} docData
 * @param {number} anioCorteA
 */
function filterBolsasCheckin(docData, anioCorteA) {
  const bolsasIn = docData && typeof docData.bolsas === "object" ? docData.bolsas : {};
  /** @type {Record<string, object>} */
  const bolsas = {};
  for (const [bolsaId, b] of Object.entries(bolsasIn)) {
    if (!b || typeof b !== "object") continue;
    const anio = Number(b.anio_origen);
    const id = String(bolsaId || "");
    const esGlobal = id.endsWith("_global") || anio === 0;
    if (esGlobal) {
      bolsas[bolsaId] = b;
      continue;
    }
    if (Number.isInteger(anio) && anio === anioCorteA) {
      bolsas[bolsaId] = b;
      continue;
    }
    if (Number.isInteger(anio) && anio >= 1900 && anio < anioCorteA) {
      bolsas[bolsaId] = b;
    }
  }
  return { ...docData, bolsas };
}

/**
 * @param {string} personaId
 * @param {number} anioCorteA
 */
async function fetchSaldoDocsAcotados(personaId, anioCorteA) {
  const col = db.collection(COL_SALDOS);
  const docSnaps = [];
  const seen = new Set();

  const pushSnap = (snap) => {
    if (!snap.exists || seen.has(snap.id)) return;
    seen.add(snap.id);
    docSnaps.push(snap);
  };

  const globalId = saldoGlobalDocId(personaId);
  const anualId = saldoAnualDocId(personaId, anioCorteA);
  const directRefs = [];
  if (globalId) directRefs.push(col.doc(globalId));
  if (anualId) directRefs.push(col.doc(anualId));
  if (directRefs.length) {
    const direct = await db.getAll(...directRefs);
    direct.forEach(pushSnap);
  }

  try {
    const histSnap = await col
      .where("persona_id", "==", personaId)
      .where("anio_calendario", "<", anioCorteA)
      .get();
    histSnap.docs.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        docSnaps.push(d);
      }
    });
  } catch (err) {
    console.warn("obtenerSaldosCheckinPersona: query histórica, fallback listado completo", err?.message);
    const allSnap = await col.where("persona_id", "==", personaId).get();
    allSnap.docs.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        docSnaps.push(d);
      }
    });
  }

  return docSnaps;
}

const obtenerSaldosCheckinPersona = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const anioCorteA = Number(d.anio_corte_a);

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!Number.isInteger(anioCorteA) || anioCorteA < 1900) {
    throw new HttpsError("invalid-argument", "anio_corte_a inválido.");
  }

  const snaps = await fetchSaldoDocsAcotados(personaId, anioCorteA);

  const docs = snaps.map((docSnap) => {
    const flat = serializeFirestoreValue(docSnap.data() || {});
    const data = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    const filtered = filterBolsasCheckin(data, anioCorteA);
    const bolsas = filtered.bolsas && typeof filtered.bolsas === "object" ? filtered.bolsas : {};
    if (!Object.keys(bolsas).length) return null;
    return { id: docSnap.id, ...filtered };
  }).filter(Boolean);

  return { ok: true, persona_id: personaId, anio_corte_a: anioCorteA, docs };
});

module.exports = { obtenerSaldosCheckinPersona };
