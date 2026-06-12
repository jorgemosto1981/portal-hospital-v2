"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { listarMarcasHuerfanasBandeja } = require("../../modules/fichadas/fichadasHuerfanasBandejaCore");

const listarMarcasHuerfanasRelojCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  try {
    const result = await listarMarcasHuerfanasBandeja(db, {
      reloj_id: d.reloj_id,
      fecha_ymd_desde: d.fecha_ymd_desde,
      fecha_ymd_hasta: d.fecha_ymd_hasta,
      limite: d.limite,
    });
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Listado inválido.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("listarMarcasHuerfanasReloj", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al listar huérfanas.");
  }
});

module.exports = { listarMarcasHuerfanasReloj: listarMarcasHuerfanasRelojCallable };
