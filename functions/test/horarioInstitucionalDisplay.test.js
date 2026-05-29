"use strict";

/**
 * node --test functions/test/horarioInstitucionalDisplay.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  isoToHhmmInstitucional,
  toHhmmInstitucionalDisplay,
  rangoHhmmLabel,
  resolverHorarioCelda,
} = require("../modules/shared/horarioInstitucionalDisplay");

describe("horarioInstitucionalDisplay", () => {
  it("ISO UTC mañana BA → 06:00", () => {
    assert.equal(isoToHhmmInstitucional("2026-06-01T09:00:00.000Z"), "06:00");
  });

  it("no deja ISO en display string", () => {
    assert.equal(toHhmmInstitucionalDisplay("2026-06-01T09:00:00.000Z"), "06:00");
  });

  it("rango compacto 08-14", () => {
    assert.equal(rangoHhmmLabel("08:00", "14:00"), "08-14");
  });

  it("resolverHorarioCelda prioriza HH:mm sobre ISO", () => {
    const r = resolverHorarioCelda({
      ingreso: "06:00",
      egreso: "14:00",
      ingreso_iso: "2026-06-01T09:00:00.000Z",
      egreso_iso: "2026-06-01T17:00:00.000Z",
    });
    assert.equal(r.ingreso, "06:00");
    assert.equal(r.egreso, "14:00");
  });
});
