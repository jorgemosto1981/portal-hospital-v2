"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { previsualizarImportFichadasReloj } = require("../../modules/fichadas/fichadasPreviewImportCore");

const previsualizarImportFichadasRelojCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  let mascara_tokens =
    typeof d.mascara_tokens === "string" ? d.mascara_tokens.trim() : "";
  const reloj_id = String(d.reloj_id || "").trim();
  if (/^rel_/i.test(reloj_id)) {
    const snap = await db.collection("cfg_reloj_biometrico").doc(reloj_id).get();
    if (snap.exists) {
      const cfg = String(snap.get("mascara_tokens") || "").trim();
      if (cfg) mascara_tokens = cfg;
    }
  }

  const result = previsualizarImportFichadasReloj({
    contenido_txt: d.contenido_txt,
    umbral_duplicado_minutos: d.umbral_duplicado_minutos,
    politica_duplicados: d.politica_duplicados,
    enrolamiento_por_tarjeta: d.enrolamiento_por_tarjeta,
    mascara_tokens,
  });

  if (!result.ok) {
    throw new HttpsError("invalid-argument", result.mensaje || "Preview inválido.");
  }
  return result;
});

module.exports = { previsualizarImportFichadasReloj: previsualizarImportFichadasRelojCallable };
