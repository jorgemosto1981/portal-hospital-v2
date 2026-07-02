"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("../modules/shared/context");
const { procesarVencimientosLicenciaIncompleta } = require("../modules/shared/procesarVencimientosLicenciaIncompletaCore");

/**
 * §5.7 RFC Caja Negra — invalida avisos incompletos con plazo vencido.
 */
const vencimientosLicenciaIncompletaScheduled = onSchedule(
  {
    schedule: "*/30 * * * *",
    timeZone: "America/Argentina/Buenos_Aires",
    region: "southamerica-east1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    const result = await procesarVencimientosLicenciaIncompleta(db, {
      batchSize: 50,
      maxPaginas: 4,
      dryRun: false,
    });
    console.log(
      "vencimientosLicenciaIncompletaScheduled",
      JSON.stringify({
        ok: result.ok,
        procesados: result.procesados,
        omitidos: result.omitidos,
        candidatos_query: result.candidatos_query,
        errores: result.errores?.length ?? 0,
        tiene_mas: result.tiene_mas,
      }),
    );
    if (!result.ok) {
      throw new Error(`vencimiento_incompleta_errores: ${(result.errores || []).length}`);
    }
  },
);

module.exports = { vencimientosLicenciaIncompletaScheduled };
