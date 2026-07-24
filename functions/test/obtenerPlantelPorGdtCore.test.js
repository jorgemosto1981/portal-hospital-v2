"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  mapFilaPlantel,
  sortFilasPlantel,
  normalizeYmd,
} = require("../modules/organizacion/obtenerPlantelPorGdtCore");

describe("obtenerPlantelPorGdtCore", () => {
  it("normalizeYmd acepta YYYY-MM-DD", () => {
    assert.equal(normalizeYmd("2026-07-24"), "2026-07-24");
    assert.equal(normalizeYmd(" 2026-07-24T12:00:00Z "), "2026-07-24");
    assert.equal(normalizeYmd("24/07/2026"), "");
  });

  it("mapFilaPlantel arma fila limpia", () => {
    const fila = mapFilaPlantel(
      {
        id: "hlg_1",
        persona_id: "per_1",
        nivel_jerarquico: 20,
        regimen_horario_id: "cfg_reg_1",
        dato_laboral_id: "hld_1",
        fecha_inicio: "2026-01-01",
      },
      { apellido: "Lokito", nombre: "Loko", dni: "1234567" },
    );
    assert.equal(fila.apellido, "Lokito");
    assert.equal(fila.dni, "1234567");
    assert.equal(fila.nivel_jerarquico, 20);
    assert.equal(fila.hlg_id, "hlg_1");
  });

  it("sortFilasPlantel ordena por nivel luego apellido", () => {
    const sorted = sortFilasPlantel([
      {
        persona_id: "per_b",
        hlg_id: "hlg_b",
        apellido: "Beto",
        nombre: "B",
        dni: "2",
        nivel_jerarquico: 30,
        fecha_inicio: null,
        regimen_horario_id: null,
        dato_laboral_id: null,
      },
      {
        persona_id: "per_a",
        hlg_id: "hlg_a",
        apellido: "Ana",
        nombre: "A",
        dni: "1",
        nivel_jerarquico: 10,
        fecha_inicio: null,
        regimen_horario_id: null,
        dato_laboral_id: null,
      },
    ]);
    assert.equal(sorted[0].persona_id, "per_a");
    assert.equal(sorted[1].persona_id, "per_b");
  });
});
