"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  planificarComandosMutacionMedicaAviso,
} = require("../modules/shared/mutarEstadoSolicitudMedicaMdc");
const {
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("../modules/shared/mdcComandosConstants");

describe("registrarDictamenJuntaMedica — planificación MDC esperada", () => {
  const rango = { fecha_desde: "2026-06-01", fecha_hasta: "2026-06-20" };

  it("dictamen favorable (mismo rango) → CONSOLIDAR_APROBADO", () => {
    const plan = planificarComandosMutacionMedicaAviso("cfg_esa_aprobada", rango, rango);
    assert.equal(plan.comandos.length, 1);
    assert.equal(plan.comandos[0].comando, MDC_COMANDO_CONSOLIDAR_APROBADO);
  });

  it("dictamen desfavorable → REVERTIR_PROYECCION", () => {
    const plan = planificarComandosMutacionMedicaAviso(
      "cfg_esa_rechazada",
      rango,
      rango,
    );
    assert.deepEqual(plan.comandos, [
      {
        comando: MDC_COMANDO_REVERTIR_PROYECCION,
        fecha_desde: rango.fecha_desde,
        fecha_hasta: rango.fecha_hasta,
      },
    ]);
  });
});

describe("aplicarLicenciaMedicaAprobada — estructura", () => {
  it("expone helper async", async () => {
    const { aplicarLicenciaMedicaAprobada } = require("../modules/shared/aplicarLicenciaMedicaAprobadaCore");
    assert.equal(typeof aplicarLicenciaMedicaAprobada, "function");
  });
});

describe("registrarDictamenJuntaMedicaCore — validación entrada", () => {
  it("rechaza solicitud_id inválido sin tocar Firestore", async () => {
    const { registrarDictamenJuntaMedica } = require("../modules/shared/registrarDictamenJuntaMedicaCore");
    const r = await registrarDictamenJuntaMedica(
      { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) },
      {
        solicitudId: "bad",
        registradoPorPersonaId: "per_x",
        dictamenFavorable: true,
      },
    );
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "SOLICITUD_ID_INVALIDO");
  });
});
