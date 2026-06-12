"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { reconciliarMarcasHuerfanasReloj } = require("../../modules/fichadas/reconciliarMarcasHuerfanasCore");

const reconciliarMarcasHuerfanasRelojCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const reloj_id = typeof d.reloj_id === "string" ? d.reloj_id.trim() : "";
  const numero_tarjeta = typeof d.numero_tarjeta === "string" ? d.numero_tarjeta.trim() : "";
  const persona_id = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const grupo_trabajo_id =
    typeof d.grupo_trabajo_id === "string"
      ? d.grupo_trabajo_id.trim()
      : typeof d.grupo_id === "string"
        ? d.grupo_id.trim()
        : "";

  if (!/^rel_/i.test(reloj_id)) {
    throw new HttpsError("invalid-argument", "reloj_id inválido.");
  }
  if (!numero_tarjeta) {
    throw new HttpsError("invalid-argument", "numero_tarjeta es obligatorio.");
  }
  if (!/^per_/i.test(persona_id)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!/^gdt_/i.test(grupo_trabajo_id)) {
    throw new HttpsError("invalid-argument", "grupo_trabajo_id (gdt_*) es obligatorio.");
  }

  try {
    const result = await reconciliarMarcasHuerfanasReloj(db, {
      reloj_id,
      numero_tarjeta,
      persona_id,
      grupo_trabajo_id,
    });
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Reconciliación inválida.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("reconciliarMarcasHuerfanasReloj", err);
    throw new HttpsError(
      "internal",
      err instanceof Error ? err.message : "Error al reconciliar marcas huérfanas.",
    );
  }
});

module.exports = { reconciliarMarcasHuerfanasReloj: reconciliarMarcasHuerfanasRelojCallable };
