"use strict";

const { FieldPath } = require("firebase-admin/firestore");

const COL_RPE = "reloj_persona_enrolamiento";
const COL_PERSONAS = "personas";
const ROSTER_GLOBAL_MAX = 2500;

function personaEsActiva(data) {
  if (!data || typeof data !== "object") return false;
  if (data.activo === false) return false;
  const est = String(data.estado || "").trim().toUpperCase();
  if (est === "INACTIVO" || est === "BAJA") return false;
  return true;
}

function labelPersona(data, id) {
  const nombre = [data?.apellido, data?.nombre].filter(Boolean).join(", ");
  return nombre || data?.dni || id;
}

/**
 * Roster global: agentes con enrolamiento activo (cualquier reloj), con gdt del rpe.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ reloj_id?: string }} [opts]
 */
async function listarRosterGlobalFichadas(db, opts = {}) {
  const reloj_id = String(opts.reloj_id || "").trim();
  let query = db.collection(COL_RPE);
  if (/^rel_/i.test(reloj_id)) {
    query = query.where("reloj_id", "==", reloj_id);
  }
  const snap = await query.limit(ROSTER_GLOBAL_MAX).get();

  /** @type {Map<string, { persona_id: string, grupo_trabajo_id: string }>} */
  const porPersona = new Map();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (d.activo === false) continue;
    const pid = String(d.persona_id || "").trim();
    const gdt = String(d.grupo_trabajo_id || "").trim();
    if (!/^per_/i.test(pid) || !/^gdt_/i.test(gdt)) continue;
    if (!porPersona.has(pid)) {
      porPersona.set(pid, { persona_id: pid, grupo_trabajo_id: gdt });
    }
  }

  const ids = [...porPersona.keys()];
  const agentes = [];
  const chunk = 100;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const refs = slice.map((id) => db.collection(COL_PERSONAS).doc(id));
    const docs = await db.getAll(...refs);
    for (const pdoc of docs) {
      if (!pdoc.exists) continue;
      const data = pdoc.data() || {};
      if (!personaEsActiva(data)) continue;
      const base = porPersona.get(pdoc.id);
      if (!base) continue;
      agentes.push({
        persona_id: pdoc.id,
        grupo_trabajo_id: base.grupo_trabajo_id,
        label: labelPersona(data, pdoc.id),
        dni: data.dni ? String(data.dni) : "",
      });
    }
  }

  agentes.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return { ok: true, scope: "GLOBAL", agentes, truncado: snap.size >= ROSTER_GLOBAL_MAX };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} params
 */
async function listarRosterParaFichadas(db, params) {
  const gdt = String(params.grupo_trabajo_id || params.grupo_id || "").trim();
  if (gdt && gdt !== "GLOBAL" && /^gdt_/i.test(gdt)) {
    const global = await listarRosterGlobalFichadas(db, { reloj_id: params.reloj_id });
    return {
      ...global,
      scope: "SECTOR_ENROL",
      agentes: global.agentes.filter((a) => a.grupo_trabajo_id === gdt),
    };
  }
  return listarRosterGlobalFichadas(db, { reloj_id: params.reloj_id });
}

module.exports = {
  listarRosterParaFichadas,
  listarRosterGlobalFichadas,
  ROSTER_GLOBAL_MAX,
};
