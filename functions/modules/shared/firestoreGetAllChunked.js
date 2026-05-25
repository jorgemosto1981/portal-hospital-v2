"use strict";

/** Límite Firestore Admin SDK por llamada a getAll. */
const GET_ALL_CHUNK = 10;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {import("firebase-admin/firestore").DocumentReference[]} refs
 * @returns {Promise<import("firebase-admin/firestore").DocumentSnapshot[]>}
 */
async function getAllDocsChunked(db, refs) {
  if (!refs.length) return [];
  /** @type {import("firebase-admin/firestore").DocumentSnapshot[]} */
  const out = [];
  for (let i = 0; i < refs.length; i += GET_ALL_CHUNK) {
    const chunk = refs.slice(i, i + GET_ALL_CHUNK);
    const snaps = await db.getAll(...chunk);
    out.push(...snaps);
  }
  return out;
}

module.exports = { GET_ALL_CHUNK, getAllDocsChunked };
