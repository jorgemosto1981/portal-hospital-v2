"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  firmaCapaTeoricaMaterializada,
  evaluarDesalineacionFirmaMaterializacion,
} = require("../modules/shared/grillaMaterializacionFirmaDia");

describe("grillaMaterializacionFirmaDia", () => {
  it("firma distingue franco sin segmentos vs turno N", () => {
    const franco = firmaCapaTeoricaMaterializada({ tipo_dia: "franco", segmentos: [] });
    const noche = firmaCapaTeoricaMaterializada({
      tipo_dia: "laborable",
      turno_compuesto_id: "cfg_reg_turno_n",
      segmentos: [{ segmento_id: "cfg_reg_turno_n" }],
    });
    assert.notEqual(franco, noche);
  });

  it("evaluarDesalineacionFirmaMaterializacion", () => {
    const r = evaluarDesalineacionFirmaMaterializacion("a", "b");
    assert.equal(r.desalineado, true);
    assert.equal(evaluarDesalineacionFirmaMaterializacion("x", "x").desalineado, false);
  });
});
