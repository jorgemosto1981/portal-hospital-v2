"use strict";

const { COL_RPE } = require("./relojEnrolamientoCore");

const COL_CFG_RELOJ = "cfg_reloj_biometrico";
const COL_PERSONAS = "personas";
const LIMITE_DEFAULT = 100;
const RX_PER_ULID = /^per_[0-9A-HJKMNP-TV-Z]{26}$/i;

function normalizarPersonaId(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^per_/i.test(s)) return s;
  return `per_${s}`;
}

/**
 * Resuelve consulta RRHH: ULID `per_*`, DNI numérico o alias legacy.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} raw
 */
async function resolverPersonaIdParaConsulta(db, raw) {
  const q = String(raw || "").trim();
  if (!q) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "Ingresá persona_id (per_*) o DNI." };
  }

  if (RX_PER_ULID.test(q)) {
    return { ok: true, persona_id: q };
  }

  const dniNorm = q.replace(/\D/g, "");
  if (dniNorm.length >= 6) {
    const snap = await db.collection(COL_PERSONAS).where("dni", "==", dniNorm).limit(5).get();
    if (snap.empty) {
      return {
        ok: false,
        codigo: "PERSONA_NO_ENCONTRADA",
        mensaje: `No hay persona activa con DNI ${dniNorm}.`,
      };
    }
    if (snap.size > 1) {
      return {
        ok: false,
        codigo: "PERSONA_AMBIGUA",
        mensaje: "Hay más de una persona con ese DNI; usá el per_* completo.",
      };
    }
    return { ok: true, persona_id: snap.docs[0].id, resuelto_desde: "dni" };
  }

  const prefixed = normalizarPersonaId(q);
  if (RX_PER_ULID.test(prefixed)) {
    const doc = await db.collection(COL_PERSONAS).doc(prefixed).get();
    if (doc.exists) {
      return { ok: true, persona_id: prefixed };
    }
  }

  return {
    ok: false,
    codigo: "PERSONA_NO_ENCONTRADA",
    mensaje: "No se encontró la persona. Usá DNI (solo números) o per_*.",
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarEnrolamientoRelojPorPersona(db, params) {
  const resuelto = await resolverPersonaIdParaConsulta(db, params.persona_id);
  if (!resuelto.ok) {
    return resuelto;
  }
  const persona_id = resuelto.persona_id;

  const incluir_inactivos = params.incluir_inactivos === true;
  const limite = Math.min(Math.max(Number(params.limite) || LIMITE_DEFAULT, 1), 200);

  const snap = await db.collection(COL_RPE).where("persona_id", "==", persona_id).limit(limite).get();

  /** @type {string[]} */
  const relojIds = [];
  const rows = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (!incluir_inactivos && d.activo === false) continue;
    const reloj_id = String(d.reloj_id || "").trim();
    if (reloj_id && !relojIds.includes(reloj_id)) relojIds.push(reloj_id);
    rows.push({
      id: String(d.id || doc.id),
      reloj_id,
      numero_tarjeta: String(d.numero_tarjeta || "").trim(),
      persona_id: String(d.persona_id || "").trim(),
      grupo_trabajo_id: d.grupo_trabajo_id ?? null,
      multi_cargo_universal: d.multi_cargo_universal === true,
      activo: d.activo !== false,
    });
  }

  /** @type {Map<string, string>} */
  const relojNombre = new Map();
  if (relojIds.length > 0) {
    const refs = relojIds.map((id) => db.collection(COL_CFG_RELOJ).doc(id));
    const cfgSnaps = await db.getAll(...refs);
    for (const rs of cfgSnaps) {
      if (!rs.exists) continue;
      const nombre = String(rs.get("nombre") || rs.id).trim();
      relojNombre.set(rs.id, nombre);
    }
  }

  const items = rows.map((row) => ({
    ...row,
    reloj_nombre: relojNombre.get(row.reloj_id) || row.reloj_id || "—",
  }));

  items.sort((a, b) => {
    const ra = String(a.reloj_nombre).localeCompare(String(b.reloj_nombre), "es");
    if (ra !== 0) return ra;
    return String(a.numero_tarjeta).localeCompare(String(b.numero_tarjeta), "es");
  });

  return { ok: true, persona_id, items, total: items.length };
}

module.exports = {
  listarEnrolamientoRelojPorPersona,
  normalizarPersonaId,
  resolverPersonaIdParaConsulta,
};
