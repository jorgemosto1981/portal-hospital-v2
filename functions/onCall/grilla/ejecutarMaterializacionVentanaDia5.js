"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { ejecutarJobMaterializacionVentanaDia5 } = require("../../modules/asistencia/jobMaterializacionVentanaDia5");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");

/**
 * RRHH: ejecutar o simular el job día 5 (ventana M+M+1, fijo/rotativo).
 * `force: true` permite correr fuera del día 5; `dry_run: true` solo evalúa.
 */
const ejecutarMaterializacionVentanaDia5 = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const fechaReferenciaYmd =
    typeof d.fecha_referencia_ymd === "string" ? d.fecha_referencia_ymd.trim() : "";
  const dryRun = d.dry_run === true;
  const force = d.force === true;
  const soloPersonaId = typeof d.persona_id === "string" ? d.persona_id.trim() : null;
  const soloGrupoId =
    typeof d.grupo_trabajo_id === "string" ? d.grupo_trabajo_id.trim() : null;

  try {
    const result = await ejecutarJobMaterializacionVentanaDia5(db, {
      fechaReferenciaYmd: fechaReferenciaYmd || undefined,
      dryRun,
      force,
      soloPersonaId: soloPersonaId || null,
      soloGrupoId: soloGrupoId || null,
      origen: "callable_rrhh",
    });
    if (result.codigo === "NO_ES_DIA_5") {
      throw new HttpsError("failed-precondition", result.mensaje || result.codigo);
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("ejecutarMaterializacionVentanaDia5", err);
    throw new HttpsError(
      "internal",
      err instanceof Error ? err.message : "Error al ejecutar job ventana día 5.",
    );
  }
});

module.exports = { ejecutarMaterializacionVentanaDia5 };
