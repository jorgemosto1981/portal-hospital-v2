"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { rechazarPaseGdtCore } = require("../modules/organizacion/rechazarPaseGdtCore");
const { aprobarPaseGdtCore, parseOverrides } = require("../modules/organizacion/aprobarPaseGdtCore");

describe("rechazarPaseGdtCore", () => {
  it("exige motivo_rechazo", async () => {
    const r = await rechazarPaseGdtCore(/** @type {any} */ (null), {
      paseId: "spg_01TESTPASE0000000000000000",
      motivoRechazo: "no",
      resolventePersonaId: "per_01TESTRRHH000000000000000",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid-argument");
    assert.match(String(r.message || ""), /motivo_rechazo/i);
  });
});

describe("aprobarPaseGdtCore / parseOverrides", () => {
  it("parseOverrides acepta vacío", () => {
    const r = parseOverrides(null);
    assert.equal(r.ok, true);
    assert.equal(r.overrides.nivel_jerarquico, null);
  });

  it("parseOverrides rechaza ancla inválida", () => {
    const r = parseOverrides({ regimen_fecha_ancla: "24-07-2026" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid-argument");
  });

  it("valida pase_id sin Firestore", async () => {
    const r = await aprobarPaseGdtCore(/** @type {any} */ (null), {
      paseId: "malo",
      gdtDestinoId: "gdt_01TESTDEST0000000000000000",
      resolventePersonaId: "per_01TESTRRHH000000000000000",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid-argument");
    assert.match(String(r.message || ""), /pase_id/i);
  });
});
