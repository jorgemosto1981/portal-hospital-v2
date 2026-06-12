"use strict";

const { FieldValue } = require("firebase-admin/firestore");

const COL_COLA = "cola_rematerializacion_asistencia";

/**
 * ID idempotente por (persona, gdt, día civil). Incluye fecha en el id para no colapsar días del mismo mes.
 *
 * @param {string} persona_id
 * @param {string} gdt_id
 * @param {string} fecha_ymd
 */
function buildColaRematDocId(persona_id, gdt_id, fecha_ymd) {
  const per = String(persona_id || "").trim();
  const gdt = String(gdt_id || "").trim();
  const ymd = String(fecha_ymd || "").slice(0, 10);
  const [anio, mes, dia] = ymd.split("-");
  const anio_mes = anio && mes ? `${anio}_${mes}` : "0000_00";
  const diaKey = dia || "00";
  return `remat_${anio_mes}_${diaKey}_per_${per}_gdt_${gdt}`;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ persona_id: string, gdt_id: string, fecha_ymd: string, origen?: string }} item
 */
async function encolarRematerializacionAsistencia(db, item) {
  const persona_id = String(item.persona_id || "").trim();
  const gdt_id = String(item.gdt_id || "").trim();
  const fecha_ymd = String(item.fecha_ymd || "").slice(0, 10);
  if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(gdt_id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_ymd)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS" };
  }
  const docId = buildColaRematDocId(persona_id, gdt_id, fecha_ymd);
  await db.collection(COL_COLA).doc(docId).set(
    {
      persona_id,
      gdt_id,
      fecha_ymd,
      procesado: false,
      origen: String(item.origen || "fichadas").slice(0, 64),
      solicitado_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, doc_id: docId };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Array<{ persona_id: string, gdt_id: string, fecha_ymd: string, origen?: string }>} items
 */
async function encolarRematerializacionAsistenciaLote(db, items) {
  const unicos = new Map();
  for (const it of items || []) {
    const persona_id = String(it.persona_id || "").trim();
    const gdt_id = String(it.gdt_id || "").trim();
    const fecha_ymd = String(it.fecha_ymd || "").slice(0, 10);
    if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(gdt_id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_ymd)) {
      continue;
    }
    const key = `${persona_id}|${gdt_id}|${fecha_ymd}`;
    unicos.set(key, { persona_id, gdt_id, fecha_ymd, origen: it.origen });
  }
  const ids = [];
  for (const it of unicos.values()) {
    const r = await encolarRematerializacionAsistencia(db, it);
    if (r.ok && r.doc_id) ids.push(r.doc_id);
  }
  return { ok: true, doc_ids: ids };
}

/**
 * Lógica del trigger (testeable sin Firestore).
 *
 * @param {object} data — payload del documento de cola
 * @param {(args: { personaId: string, grupoId: string, fechaYmd: string }) => Promise<object>} materializarTurnoTeoricoDia
 */
async function ejecutarRematerializacionDesdeCola(data, materializarTurnoTeoricoDia) {
  const persona_id = String(data?.persona_id || "").trim();
  const gdt_id = String(data?.gdt_id || "").trim();
  const fecha_ymd = String(data?.fecha_ymd || "").slice(0, 10);
  if (!/^per_/i.test(persona_id) || !/^gdt_/i.test(gdt_id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_ymd)) {
    return { ok: false, codigo: "PAYLOAD_INVALIDO" };
  }
  if (data?.procesado === true) {
    return { ok: true, omitido: true, motivo: "ya_procesado" };
  }
  const r = await materializarTurnoTeoricoDia({
    personaId: persona_id,
    grupoId: gdt_id,
    fechaYmd: fecha_ymd,
  });
  return { ok: true, resultado: r };
}

module.exports = {
  COL_COLA,
  buildColaRematDocId,
  encolarRematerializacionAsistencia,
  encolarRematerializacionAsistenciaLote,
  ejecutarRematerializacionDesdeCola,
};
