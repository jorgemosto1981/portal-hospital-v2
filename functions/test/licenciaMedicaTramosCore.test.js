"use strict";

/**
 * node --test functions/test/licenciaMedicaTramosCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  calcularTramosLicenciaMedicaCorta,
  buildLicenciaMedicaPreviewCorta,
  CFG_MLM_CORTA_ANUAL,
} = require("../modules/shared/licenciaMedicaTramosCore");

function tramosStr(result) {
  const t = result.tramos_haberes;
  return { "100": t[100], "60": t[60], "0": t[0] };
}

describe("calcularTramosLicenciaMedicaCorta", () => {
  it("34 + 5 cruza el primer límite → 1 al 100% y 4 al 60%", () => {
    const r = calcularTramosLicenciaMedicaCorta({ consumido_previo: 34, dias_solicitados: 5 });
    assert.deepEqual(tramosStr(r), { "100": 1, "60": 4, "0": 0 });
    assert.equal(r.cruza_limite_35, true);
    assert.equal(r.cruza_limite_70, false);
  });

  it("69 + 2 cruza el segundo límite → 1 al 60% y 1 sin goce", () => {
    const r = calcularTramosLicenciaMedicaCorta({ consumido_previo: 69, dias_solicitados: 2 });
    assert.deepEqual(tramosStr(r), { "100": 0, "60": 1, "0": 1 });
    assert.equal(r.cruza_limite_35, false);
    assert.equal(r.cruza_limite_70, true);
  });

  it("0 + 10 caso base → 10 al 100%", () => {
    const r = calcularTramosLicenciaMedicaCorta({ consumido_previo: 0, dias_solicitados: 10 });
    assert.deepEqual(tramosStr(r), { "100": 10, "60": 0, "0": 0 });
  });

  it("40 + 5 intermedio → 5 al 60%", () => {
    const r = calcularTramosLicenciaMedicaCorta({ consumido_previo: 40, dias_solicitados: 5 });
    assert.deepEqual(tramosStr(r), { "100": 0, "60": 5, "0": 0 });
  });

  it("rechaza dias_solicitados inválidos", () => {
    assert.throws(() => calcularTramosLicenciaMedicaCorta({ consumido_previo: 0, dias_solicitados: 0 }));
  });
});

describe("buildLicenciaMedicaPreviewCorta", () => {
  it("genera mensaje_ui con desglose", () => {
    const p = buildLicenciaMedicaPreviewCorta({
      anio_calendario: 2026,
      consumido_previo: 34,
      dias_solicitados: 5,
    });
    assert.equal(p.tramos_haberes["100"], 1);
    assert.equal(p.tramos_haberes["60"], 4);
    assert.match(p.mensaje_ui, /1 día al 100%/);
    assert.match(p.mensaje_ui, /4 días al 60%/);
    assert.equal(p.modo_licencia_medica_id, CFG_MLM_CORTA_ANUAL);
  });
});
