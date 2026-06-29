"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  planificarComandosMutacionMedicaAviso,
  resolverComandoMdcPrincipalEstadoMedica,
} = require("../modules/shared/mutarEstadoSolicitudMedicaMdc");
const {
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("../modules/shared/mdcComandosConstants");

describe("mutarEstadoSolicitudMedicaMdc — planificación", () => {
  it("rechazo → solo REVERTIR sobre rango previo", () => {
    const plan = planificarComandosMutacionMedicaAviso(
      "cfg_esa_rechazada",
      { fecha_desde: "2026-06-10", fecha_hasta: "2026-06-12" },
      null,
    );
    assert.equal(plan.ok, true);
    assert.deepEqual(plan.comandos, [
      {
        comando: MDC_COMANDO_REVERTIR_PROYECCION,
        fecha_desde: "2026-06-10",
        fecha_hasta: "2026-06-12",
      },
    ]);
  });

  it("aprobación mismo rango → CONSOLIDAR sin revert previo", () => {
    const rango = { fecha_desde: "2026-06-10", fecha_hasta: "2026-06-12" };
    const plan = planificarComandosMutacionMedicaAviso("cfg_esa_aprobada", rango, rango);
    assert.equal(plan.comandos.length, 1);
    assert.equal(plan.comandos[0].comando, MDC_COMANDO_CONSOLIDAR_APROBADO);
  });

  it("aprobación con cambio de rango → REVERTIR previo + CONSOLIDAR nuevo", () => {
    const plan = planificarComandosMutacionMedicaAviso(
      "cfg_esa_aprobada",
      { fecha_desde: "2026-06-10", fecha_hasta: "2026-06-10" },
      { fecha_desde: "2026-06-10", fecha_hasta: "2026-06-15" },
    );
    assert.equal(plan.comandos.length, 2);
    assert.equal(plan.comandos[0].comando, MDC_COMANDO_REVERTIR_PROYECCION);
    assert.equal(plan.comandos[1].comando, MDC_COMANDO_CONSOLIDAR_APROBADO);
    assert.equal(plan.comandos[1].fecha_hasta, "2026-06-15");
  });

  it("esperando junta → PROYECTAR pendiente (mismo sol_id)", () => {
    assert.equal(
      resolverComandoMdcPrincipalEstadoMedica("cfg_esa_esperando_dictamen_junta"),
      MDC_COMANDO_PROYECTAR_PENDIENTE,
    );
    const rango = { fecha_desde: "2026-06-01", fecha_hasta: "2026-06-20" };
    const plan = planificarComandosMutacionMedicaAviso(
      "cfg_esa_esperando_dictamen_junta",
      { fecha_desde: "2026-06-01", fecha_hasta: "2026-06-18" },
      rango,
    );
    assert.equal(plan.comandos[0].comando, MDC_COMANDO_REVERTIR_PROYECCION);
    assert.equal(plan.comandos[1].comando, MDC_COMANDO_PROYECTAR_PENDIENTE);
  });
});
