"use strict";

/**
 * node --test functions/test/solicitudLaoConsumoOperativo.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveDiasConsumoOperativo, resolveDiasConsumoMotor } = require("../triggers/solicitudArticuloLaoOnCreate");

describe("resolveDiasConsumoOperativo", () => {
  const motorStock = {
    eligible: true,
    camino: "stock",
    matriz: { dias_base: 27 },
  };

  it("prioriza dias_solicitados del documento sobre matriz.dias_base", () => {
    const r = resolveDiasConsumoOperativo(
      { dias_solicitados: 3, resumen_computo_snapshot: { dias_consumo: 3 } },
      motorStock,
    );
    assert.equal(r.dias, 3);
    assert.equal(r.usaRangoWizard, true);
    assert.equal(r.error, null);
  });

  it("rechaza tampering si dias_solicitados no coincide con snapshot", () => {
    const r = resolveDiasConsumoOperativo(
      { dias_solicitados: 4, resumen_computo_snapshot: { dias_consumo: 3 } },
      motorStock,
    );
    assert.equal(r.dias, 0);
    assert.ok(r.error);
  });

  it("sin dias_solicitados usa motor legado", () => {
    const r = resolveDiasConsumoOperativo({ fecha_desde: "2026-05-23" }, motorStock);
    assert.equal(r.dias, 27);
    assert.equal(r.usaRangoWizard, false);
  });
});

describe("resolveDiasConsumoMotor", () => {
  it("lee dias_base en stock", () => {
    assert.equal(
      resolveDiasConsumoMotor({ eligible: true, camino: "stock", matriz: { dias_base: 27 } }),
      27,
    );
  });
});
