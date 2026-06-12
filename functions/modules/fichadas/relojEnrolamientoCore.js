"use strict";

const { ulid } = require("ulid");
const { FieldValue } = require("firebase-admin/firestore");
const { reconciliarMarcasHuerfanasReloj } = require("./reconciliarMarcasHuerfanasCore");
const { obtenerYmdHoyInstitucional } = require("../shared/fechaInstitucionalBa");
const { listarGruposTrabajoVigentesEnFecha } = require("../shared/solicitudGrupoTrabajoAncla");

const COL_RPE = "reloj_persona_enrolamiento";
const COL_CFG_RELOJ = "cfg_reloj_biometrico";

/**
 * Reloj sectorial → gdt del cfg; reloj universal → enrol multi-cargo (sin gdt único en rpe_*).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function resolverGrupoTrabajoIdParaEnrolamiento(db, { reloj_id, persona_id, grupo_trabajo_id }) {
  const explicito = String(grupo_trabajo_id || "").trim();
  if (/^gdt_/i.test(explicito)) {
    return { ok: true, grupo_trabajo_id: explicito, multi_cargo_universal: false };
  }

  const relojSnap = await db.collection(COL_CFG_RELOJ).doc(reloj_id).get();
  const gdtReloj = relojSnap.exists ? String(relojSnap.get("grupo_trabajo_id") || "").trim() : "";
  if (/^gdt_/i.test(gdtReloj)) {
    return { ok: true, grupo_trabajo_id: gdtReloj, multi_cargo_universal: false };
  }

  const fecha = obtenerYmdHoyInstitucional();
  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, persona_id, fecha);
  if (vigentes.length === 0) {
    return {
      ok: false,
      codigo: "SIN_GRUPO_VIGENTE",
      mensaje:
        "El agente no tiene grupo de trabajo vigente en datos laborales. No se puede enrolar en reloj universal.",
    };
  }

  return {
    ok: true,
    grupo_trabajo_id: null,
    multi_cargo_universal: true,
    grupos_trabajo_vigentes: vigentes.map((g) => g.grupo_de_trabajo_id),
  };
}

/**
 * Alta/actualización enrolamiento tarjeta ↔ persona + reconciliación huérfanas.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function guardarEnrolamientoRelojPersona(db, params, actor) {
  const reloj_id = String(params.reloj_id || "").trim();
  const numero_tarjeta = String(params.numero_tarjeta || "").trim();
  const persona_id = String(params.persona_id || "").trim();

  if (!/^rel_/i.test(reloj_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "reloj_id inválido." };
  }
  if (!numero_tarjeta) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "numero_tarjeta obligatorio." };
  }
  if (!/^per_/i.test(persona_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "persona_id inválido." };
  }

  const resuelto = await resolverGrupoTrabajoIdParaEnrolamiento(db, {
    reloj_id,
    persona_id,
    grupo_trabajo_id: params.grupo_trabajo_id || params.grupo_id,
  });
  if (!resuelto.ok) {
    return {
      ok: false,
      codigo: resuelto.codigo || "PARAMS_INVALIDOS",
      mensaje: resuelto.mensaje,
      requiere_seleccion: resuelto.requiere_seleccion,
    };
  }

  const multi_cargo_universal = Boolean(resuelto.multi_cargo_universal);
  const grupo_trabajo_id = resuelto.grupo_trabajo_id;

  const rpeId = `rpe_${ulid()}`;
  await db.collection(COL_RPE).doc(rpeId).set({
    id: rpeId,
    reloj_id,
    numero_tarjeta,
    persona_id,
    grupo_trabajo_id: grupo_trabajo_id || null,
    multi_cargo_universal,
    activo: true,
    creado_en: FieldValue.serverTimestamp(),
    creado_por_persona_id: actor.actor_persona_id || null,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const recon = await reconciliarMarcasHuerfanasReloj(db, {
    reloj_id,
    numero_tarjeta,
    persona_id,
    grupo_trabajo_id: grupo_trabajo_id || "",
    multi_cargo_universal,
  });

  return {
    ok: true,
    rpe_id: rpeId,
    grupo_trabajo_id: grupo_trabajo_id || null,
    multi_cargo_universal,
    grupos_trabajo_vigentes: resuelto.grupos_trabajo_vigentes || null,
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
  resolverGrupoTrabajoIdParaEnrolamiento,
  guardarEnrolamientoRelojPersona,
};
