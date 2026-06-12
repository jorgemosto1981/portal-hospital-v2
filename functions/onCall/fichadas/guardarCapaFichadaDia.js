"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { guardarCapaFichadaDia } = require("../../modules/fichadas/fichadasCapaDiaCore");

const guardarCapaFichadaDiaCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth?.token || {};

  try {
    const result = await guardarCapaFichadaDia(
      db,
      {
        persona_id: d.persona_id,
        grupo_trabajo_id: d.grupo_trabajo_id || d.grupo_id,
        fecha_ymd: d.fecha_ymd,
        accion: d.accion,
        marcas: d.marcas,
        motivo: d.motivo,
        origen: d.origen,
        fila_index: d.fila_index,
        version_esperada: d.version_esperada,
      },
      {
        actor_uid: request.auth?.uid || null,
        actor_persona_id: typeof token.persona_id === "string" ? token.persona_id : null,
      },
    );

    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Guardado inválido.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err && err.code === "failed-precondition") {
      throw new HttpsError("failed-precondition", err.message || "Precondición fallida.");
    }
    console.error("guardarCapaFichadaDia", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al guardar fichada.");
  }
});

module.exports = { guardarCapaFichadaDia: guardarCapaFichadaDiaCallable };
