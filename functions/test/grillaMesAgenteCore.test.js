"use strict";

/**
 * node --test functions/test/grillaMesAgenteCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  visRequiereMaterializacion,
  visSnapshotDegenerado,
} = require("../modules/shared/grillaMesAgenteCore");

function celdaNl() {
  return { tipo_dia: "no_laborable", es_franco: false };
}

function celdaLaborable() {
  return {
    tipo_dia: "laborable",
    es_franco: false,
    rda_ingreso: "08:00",
    rda_egreso: "14:00",
  };
}

function celdaFranco() {
  return { tipo_dia: "franco", es_franco: true };
}

function mesCon(fn, n = 31) {
  const dias = {};
  for (let d = 1; d <= n; d += 1) {
    dias[String(d).padStart(2, "0")] = fn(d);
  }
  return dias;
}

describe("visSnapshotDegenerado", () => {
  it("detecta mes completo solo no_laborable sin horarios", () => {
    const dias = mesCon(() => celdaNl());
    assert.equal(visSnapshotDegenerado(dias), true);
  });

  it("no marca régimen fijo válido (laborable + franco + NL)", () => {
    const dias = mesCon((d) => {
      const w = ((d + 0) % 7);
      if (w >= 1 && w <= 3) return celdaLaborable();
      if (w === 6 || w === 0) return celdaFranco();
      return celdaNl();
    });
    assert.equal(visSnapshotDegenerado(dias), false);
  });

  it("ignora meses con menos de 20 días cargados", () => {
    const dias = mesCon(() => celdaNl(), 10);
    assert.equal(visSnapshotDegenerado(dias), false);
  });
});

describe("visRequiereMaterializacion", () => {
  it("sin documento o vacío requiere materializar", () => {
    assert.equal(visRequiereMaterializacion(null), true);
    assert.equal(visRequiereMaterializacion({ existe: false }), true);
    assert.equal(visRequiereMaterializacion({ existe: true, dias: {} }), true);
  });

  it("snapshot degenerado (Portería mayo) requiere materializar", () => {
    assert.equal(
      visRequiereMaterializacion({ existe: true, dias: mesCon(() => celdaNl()) }),
      true,
    );
  });

  it("snapshot con turnos no requiere materializar", () => {
    const dias = mesCon((d) => {
      if (d <= 15) return celdaLaborable();
      return celdaFranco();
    });
    assert.equal(visRequiereMaterializacion({ existe: true, dias }), false);
  });
});
