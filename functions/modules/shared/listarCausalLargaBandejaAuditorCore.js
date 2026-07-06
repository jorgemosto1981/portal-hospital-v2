"use strict";

const COL_CAUSAL_LARGA = "cfg_causal_larga_duracion";

/**
 * Catálogo causal Art. 19 para bandeja auditoría médica (C2).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarCausalLargaBandejaAuditor(db) {
  const snap = await db.collection(COL_CAUSAL_LARGA).limit(200).get();
  /** @type {Array<Record<string, unknown>>} */
  const items = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (Object.hasOwn(d, "activo") && d.activo === false) continue;
    const titulo_ui = String(d.titulo_ui || d.nombre || "").trim();
    if (!titulo_ui) continue;
    items.push({
      id: doc.id,
      titulo_ui,
      descripcion_ui: String(d.descripcion_ui || "").trim() || null,
    });
  }

  items.sort((a, b) =>
    String(a.titulo_ui).localeCompare(String(b.titulo_ui), undefined, { sensitivity: "base" }),
  );

  return { items, total: items.length };
}

module.exports = { listarCausalLargaBandejaAuditor };
