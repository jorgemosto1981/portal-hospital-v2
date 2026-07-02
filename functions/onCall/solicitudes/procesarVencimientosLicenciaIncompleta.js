"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { procesarVencimientosLicenciaIncompleta } = require("../../modules/shared/procesarVencimientosLicenciaIncompletaCore");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");

/**
 * RRHH / operaciones: ejecutar job §5.7 vencimiento aviso incompleto (manual o smoke).
 */
const procesarVencimientosLicenciaIncompletaCallable = onCall({ invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertRrhh(request);
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const batchSize = Number(d.batch_size) || undefined;
  const maxPaginas = Number(d.max_paginas) || undefined;
  const dryRun = d.dry_run === true;

  const result = await procesarVencimientosLicenciaIncompleta(db, {
    batchSize,
    maxPaginas,
    dryRun,
  });

  if (!result.ok) {
    throw new HttpsError(
      "internal",
      `Job vencimiento incompleta con errores (${result.errores?.length || 0}).`,
    );
  }

  return result;
});

module.exports = { procesarVencimientosLicenciaIncompleta: procesarVencimientosLicenciaIncompletaCallable };
