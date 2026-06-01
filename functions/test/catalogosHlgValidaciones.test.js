"use strict";

/**
 * Validaciones HLg (régimen activo, solape, cambio de régimen).
 * node --test functions/test/catalogosHlgValidaciones.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  hasRangoSolapado,
  isRegimenHorarioActivo,
  hlgCuentaParaSolapeOperativo,
} = require("../modules/laboral/hlgValidacionesCore");

describe("hasRangoSolapado", () => {
  it("detecta solape inclusivo con fin abierto", () => {
    assert.equal(
      hasRangoSolapado({
        desdeA: "2026-02-01",
        hastaA: null,
        desdeB: "2026-02-15",
        hastaB: "2026-02-28",
      }),
      true,
    );
  });

  it("no solapa rangos contiguos (fin día anterior al inicio del otro)", () => {
    assert.equal(
      hasRangoSolapado({
        desdeA: "2026-01-01",
        hastaA: "2026-01-31",
        desdeB: "2026-02-01",
        hastaB: null,
      }),
      false,
    );
  });
});

describe("isRegimenHorarioActivo", () => {
  it("acepta sin campo activo", () => {
    assert.equal(isRegimenHorarioActivo({ nombre: "Fijo" }), true);
  });

  it("rechaza activo false", () => {
    assert.equal(isRegimenHorarioActivo({ activo: false }), false);
  });
});

describe("hlgCuentaParaSolapeOperativo", () => {
  it("excluye HLg deshabilitado administrativamente", () => {
    assert.equal(hlgCuentaParaSolapeOperativo({ activo: false }), false);
  });

  it("incluye HLg activo o sin campo activo", () => {
    assert.equal(hlgCuentaParaSolapeOperativo({ activo: true }), true);
    assert.equal(hlgCuentaParaSolapeOperativo({}), true);
  });
});
