"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { aplicarImportFichadasReloj } = require("../../modules/fichadas/fichadasCapaDiaCore");

const aplicarImportFichadasRelojCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth?.token || {};

  try {
    const result = await aplicarImportFichadasReloj(
      db,
      {
        reloj_id: d.reloj_id,
        grupo_trabajo_id: d.grupo_trabajo_id || d.grupo_id,
        contenido_txt: d.contenido_txt,
        import_lote_id: d.import_lote_id,
        umbral_duplicado_minutos: d.umbral_duplicado_minutos,
      },
      {
        actor_uid: request.auth?.uid || null,
        actor_persona_id: typeof token.persona_id === "string" ? token.persona_id : null,
      },
    );

    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Import inválido.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err && err.code === "failed-precondition") {
      throw new HttpsError("failed-precondition", err.message || "Período cerrado o precondición fallida.");
    }
    console.error("aplicarImportFichadasReloj", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al aplicar import.");
  }
});

module.exports = { aplicarImportFichadasReloj: aplicarImportFichadasRelojCallable };
