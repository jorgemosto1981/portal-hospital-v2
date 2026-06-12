"use strict";

const { FieldValue } = require("firebase-admin/firestore");

const COL_FMH = "fichadas_marca_huerfana";
const ESTADO_PENDIENTE = "PENDIENTE_ENROLAMIENTO";
const ESTADO_DESCARTADA = "DESCARTADA";

/**
 * Bandeja RRHH — índice (reloj_id, estado, fecha_ymd).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarMarcasHuerfanasBandeja(db, params) {
  const reloj_id = String(params.reloj_id || "").trim();
  if (!/^rel_/i.test(reloj_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "reloj_id inválido." };
  }

  const fecha_desde = typeof params.fecha_ymd_desde === "string" ? params.fecha_ymd_desde.trim() : "";
  const fecha_hasta = typeof params.fecha_ymd_hasta === "string" ? params.fecha_ymd_hasta.trim() : "";
  const limite = Math.min(Math.max(Number(params.limite) || 200, 1), 500);

  let q = db
    .collection(COL_FMH)
    .where("reloj_id", "==", reloj_id)
    .where("estado", "==", ESTADO_PENDIENTE);

  if (fecha_desde) {
    q = q.where("fecha_ymd", ">=", fecha_desde);
  }
  if (fecha_hasta) {
    q = q.where("fecha_ymd", "<=", fecha_hasta);
  }

  q = q.orderBy("fecha_ymd").limit(limite);

  const snap = await q.get();
  const items = snap.docs.map((doc) => {
    const d = doc.data() || {};
    return {
      id: doc.id,
      reloj_id: d.reloj_id,
      numero_tarjeta: d.numero_tarjeta,
      fecha_ymd: d.fecha_ymd,
      hora_hm: d.hora_hm,
      codigo_dispositivo: d.codigo_dispositivo ?? null,
      origen: d.origen ?? null,
      import_lote_id: d.import_lote_id ?? null,
    };
  });

  return { ok: true, items, truncado: snap.size >= limite };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function descartarMarcaHuerfanaReloj(db, params, actor) {
  const fmh_id = String(params.fmh_id || "").trim();
  const motivo = String(params.motivo || "").trim();
  if (!/^fmh_/i.test(fmh_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "fmh_id inválido." };
  }
  if (motivo.length < 3) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "motivo obligatorio (mín. 3 caracteres)." };
  }

  const ref = db.collection(COL_FMH).doc(fmh_id);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADO", mensaje: "Marca huérfana no encontrada." };
  }
  const data = snap.data() || {};
  if (data.estado !== ESTADO_PENDIENTE) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "Solo se descartan marcas pendientes." };
  }

  await ref.update({
    estado: ESTADO_DESCARTADA,
    motivo_descarte: motivo.slice(0, 240),
    descartada_por_persona_id: actor.actor_persona_id || null,
    descartada_en: FieldValue.serverTimestamp(),
  });

  return { ok: true, fmh_id };
}

module.exports = {
  COL_FMH,
  ESTADO_PENDIENTE,
  ESTADO_DESCARTADA,
  listarMarcasHuerfanasBandeja,
  descartarMarcaHuerfanaReloj,
};
