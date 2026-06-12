"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { assertRrhh } = require("../../modules/shared/helpers");
const { previsualizarImportFichadasReloj } = require("../../modules/fichadas/fichadasPreviewImportCore");

const previsualizarImportFichadasRelojCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const result = previsualizarImportFichadasReloj({
    contenido_txt: d.contenido_txt,
    umbral_duplicado_minutos: d.umbral_duplicado_minutos,
    politica_duplicados: d.politica_duplicados,
    enrolamiento_por_tarjeta: d.enrolamiento_por_tarjeta,
  });

  if (!result.ok) {
    throw new HttpsError("invalid-argument", result.mensaje || "Preview inválido.");
  }
  return result;
});

module.exports = { previsualizarImportFichadasReloj: previsualizarImportFichadasRelojCallable };
