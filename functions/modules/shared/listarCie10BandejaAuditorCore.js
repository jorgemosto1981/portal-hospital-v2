"use strict";

const COL_CIE10 = "cfg_cie10";

/**
 * Catálogo CIE-10 piloto para bandeja auditoría médica (C2).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarCie10BandejaAuditor(db) {
  const snap = await db.collection(COL_CIE10).limit(500).get();
  /** @type {Array<Record<string, unknown>>} */
  const items = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (Object.hasOwn(d, "activo") && d.activo === false) continue;
    const codigo_interno = String(d.codigo_interno || "").trim();
    const titulo_ui = String(d.titulo_ui || "").trim();
    if (!codigo_interno || !titulo_ui) continue;
    items.push({
      id: doc.id,
      codigo_interno,
      titulo_ui,
      orden: typeof d.orden === "number" ? d.orden : null,
    });
  }

  items.sort((a, b) => {
    const oa = Number(a.orden);
    const ob = Number(b.orden);
    if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob;
    return String(a.codigo_interno).localeCompare(String(b.codigo_interno), undefined, {
      numeric: true,
    });
  });

  return { items, total: items.length };
}

module.exports = { listarCie10BandejaAuditor };
