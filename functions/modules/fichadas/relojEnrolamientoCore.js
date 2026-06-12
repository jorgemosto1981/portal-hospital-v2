"use strict";

const { ulid } = require("ulid");
const { FieldValue } = require("firebase-admin/firestore");
const { reconciliarMarcasHuerfanasReloj } = require("./reconciliarMarcasHuerfanasCore");

const COL_RPE = "reloj_persona_enrolamiento";

/**
 * Alta/actualización enrolamiento tarjeta ↔ persona + reconciliación huérfanas.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function guardarEnrolamientoRelojPersona(db, params, actor) {
  const reloj_id = String(params.reloj_id || "").trim();
  const numero_tarjeta = String(params.numero_tarjeta || "").trim();
  const persona_id = String(params.persona_id || "").trim();
  const grupo_trabajo_id = String(params.grupo_trabajo_id || params.grupo_id || "").trim();

  if (!/^rel_/i.test(reloj_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "reloj_id inválido." };
  }
  if (!numero_tarjeta) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "numero_tarjeta obligatorio." };
  }
  if (!/^per_/i.test(persona_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "persona_id inválido." };
  }
  if (!/^gdt_/i.test(grupo_trabajo_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "grupo_trabajo_id inválido." };
  }

  const rpeId = `rpe_${ulid()}`;
  await db.collection(COL_RPE).doc(rpeId).set({
    id: rpeId,
    reloj_id,
    numero_tarjeta,
    persona_id,
    grupo_trabajo_id,
    activo: true,
    creado_en: FieldValue.serverTimestamp(),
    creado_por_persona_id: actor.actor_persona_id || null,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const recon = await reconciliarMarcasHuerfanasReloj(db, {
    reloj_id,
    numero_tarjeta,
    persona_id,
    grupo_trabajo_id,
  });

  return {
    ok: true,
    rpe_id: rpeId,
    reconciliacion: recon.ok
      ? {
          procesadas: recon.procesadas,
          vis_actualizados: recon.vis_actualizados,
          fmh_resueltas: recon.fmh_resueltas,
        }
      : { error: recon.mensaje || recon.codigo },
  };
}

module.exports = {
  COL_RPE,
  guardarEnrolamientoRelojPersona,
};
