/**
 * node --test functions/test/fichadasMultiCargoUniversal.test.js
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  relojEsUniversalPorGrupoCfg,
  enrolamientoEsMultiCargoUniversal,
} = require("../modules/fichadas/fichadasMultiCargoUniversal");

describe("relojEsUniversalPorGrupoCfg", () => {
  it("universal si grupo null o vacío", () => {
    assert.equal(relojEsUniversalPorGrupoCfg(null), true);
    assert.equal(relojEsUniversalPorGrupoCfg(""), true);
  });
  it("sectorial si gdt_*", () => {
    assert.equal(relojEsUniversalPorGrupoCfg("gdt_abc"), false);
  });
});

describe("enrolamientoEsMultiCargoUniversal", () => {
  it("reloj universal siempre multi", () => {
    assert.equal(
      enrolamientoEsMultiCargoUniversal({ persona_id: "per_x", grupo_trabajo_id: "gdt_a" }, true),
      true,
    );
  });
  it("sectorial con flag multi", () => {
    assert.equal(
      enrolamientoEsMultiCargoUniversal(
        { persona_id: "per_x", multi_cargo_universal: true },
        false,
      ),
      true,
    );
  });
  it("sectorial con gdt fijo no multi", () => {
    assert.equal(
      enrolamientoEsMultiCargoUniversal({ persona_id: "per_x", grupo_trabajo_id: "gdt_a" }, false),
      false,
    );
  });
});
