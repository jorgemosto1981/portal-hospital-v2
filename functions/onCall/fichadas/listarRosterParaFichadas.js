"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { listarRosterParaFichadas } = require("../../modules/fichadas/listarRosterFichadasCore");

const listarRosterParaFichadasCallable = onCall(async (request) => {
  assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  try {
    const result = await listarRosterParaFichadas(db, {
      grupo_trabajo_id: d.grupo_trabajo_id || d.grupo_id,
      reloj_id: d.reloj_id,
    });
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Roster inválido.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("listarRosterParaFichadas", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al listar roster.");
  }
});

module.exports = { listarRosterParaFichadas: listarRosterParaFichadasCallable };
