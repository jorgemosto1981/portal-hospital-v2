"use strict";

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("../modules/shared/context");
const { ejecutarJobMaterializacionVentanaDia5 } = require("../modules/asistencia/jobMaterializacionVentanaDia5");

/**
 * Día 5 de cada mes, 07:00 ART — materialización idempotente M+1 (y M si aplica). §17.2.1.
 */
const materializacionVentanaDia5Scheduled = onSchedule(
  {
    schedule: "0 7 5 * *",
    timeZone: "America/Argentina/Buenos_Aires",
    region: "southamerica-east1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const result = await ejecutarJobMaterializacionVentanaDia5(db, { origen: "scheduler" });
    console.log("materializacionVentanaDia5Scheduled", JSON.stringify({
      ok: result.ok,
      codigo: result.codigo,
      asignaciones: result.asignaciones_evaluadas,
      materializados: result.materializados,
      omitidos: result.omitidos,
      errores: result.errores?.length ?? 0,
    }));
    if (!result.ok && result.codigo !== "NO_ES_DIA_5") {
      throw new Error(`job_dia5_fallos: ${(result.errores || []).length}`);
    }
  },
);

module.exports = { materializacionVentanaDia5Scheduled };
