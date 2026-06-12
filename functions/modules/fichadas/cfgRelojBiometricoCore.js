"use strict";

const { ulid } = require("ulid");
const { FieldValue } = require("firebase-admin/firestore");

const COL_CFG = "cfg_reloj_biometrico";
const COL_GRUPOS = "grupos_de_trabajo";

const MASCARA_DEFAULT = "TTTTT DD/MM/YY HH:MM RRR CC";
const POLITICAS_DUPLICADOS = new Set(["EXCLUIR_SEGUNDA", "MANTENER_TODAS", "BLOQUEAR_APLICAR"]);

/**
 * @param {object} params
 * @returns {{ ok: true, payload: object } | { ok: false, codigo: string, mensaje: string }}
 */
function validarPayloadCfgReloj(params) {
  const reloj_id = String(params.reloj_id || "").trim();
  const esActualizacion = Boolean(reloj_id);
  if (esActualizacion && !/^rel_/i.test(reloj_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "reloj_id debe ser rel_*." };
  }

  const nombre = String(params.nombre || "").trim();
  if (!nombre) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "El nombre del reloj es obligatorio." };
  }

  const grupo_trabajo_id = String(params.grupo_trabajo_id || params.grupo_id || "").trim();
  if (!/^gdt_/i.test(grupo_trabajo_id)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "grupo_trabajo_id inválido (gdt_*)." };
  }

  const numero_reloj = String(params.numero_reloj ?? "").trim();
  const mascara_tokens = String(params.mascara_tokens || MASCARA_DEFAULT).trim() || MASCARA_DEFAULT;

  const politicaIn = params.politica_validacion && typeof params.politica_validacion === "object"
    ? params.politica_validacion
    : {};
  const umbralRaw = Number(politicaIn.umbral_duplicado_minutos ?? params.umbral_duplicado_minutos ?? 2);
  const umbral_duplicado_minutos = Number.isFinite(umbralRaw) ? Math.min(120, Math.max(1, Math.round(umbralRaw))) : 2;
  const duplicadosRaw = String(politicaIn.duplicados || params.politica_duplicados || "EXCLUIR_SEGUNDA").trim();
  const duplicados = POLITICAS_DUPLICADOS.has(duplicadosRaw) ? duplicadosRaw : "EXCLUIR_SEGUNDA";

  const activo = params.activo !== false;

  return {
    ok: true,
    payload: {
      reloj_id: esActualizacion ? reloj_id : null,
      nombre,
      grupo_trabajo_id,
      numero_reloj,
      mascara_tokens,
      politica_validacion: { umbral_duplicado_minutos, duplicados },
      activo,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} params
 * @param {object} actor
 */
async function guardarCfgRelojBiometrico(db, params, actor) {
  const val = validarPayloadCfgReloj(params);
  if (!val.ok) return val;

  const { payload } = val;
  const gdtSnap = await db.collection(COL_GRUPOS).doc(payload.grupo_trabajo_id).get();
  if (!gdtSnap.exists) {
    return {
      ok: false,
      codigo: "GRUPO_INEXISTENTE",
      mensaje: `El grupo ${payload.grupo_trabajo_id} no existe.`,
    };
  }

  const id = payload.reloj_id || `rel_${ulid()}`;
  const ref = db.collection(COL_CFG).doc(id);
  const exists = (await ref.get()).exists;

  if (payload.reloj_id && !exists) {
    return { ok: false, codigo: "NO_ENCONTRADO", mensaje: "Reloj no encontrado." };
  }

  const doc = {
    id,
    nombre: payload.nombre,
    grupo_trabajo_id: payload.grupo_trabajo_id,
    numero_reloj: payload.numero_reloj,
    mascara_tokens: payload.mascara_tokens,
    politica_validacion: payload.politica_validacion,
    activo: payload.activo,
    actualizado_en: FieldValue.serverTimestamp(),
    actualizado_por_persona_id: actor.actor_persona_id || null,
  };

  if (!exists) {
    doc.creado_en = FieldValue.serverTimestamp();
    doc.creado_por_persona_id = actor.actor_persona_id || null;
  }

  await ref.set(doc, { merge: true });

  return { ok: true, reloj_id: id, creado: !exists };
}

module.exports = {
  COL_CFG,
  MASCARA_DEFAULT,
  POLITICAS_DUPLICADOS,
  validarPayloadCfgReloj,
  guardarCfgRelojBiometrico,
};
