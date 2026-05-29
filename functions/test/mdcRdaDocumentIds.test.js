"use strict";

/**
 * node --test functions/test/mdcRdaDocumentIds.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  CODIGO_PARAMS_INVALIDOS,
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
} = require("../modules/shared/mdcRdaDocumentIds");

const PER = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const FECHA = "2026-06-15";

describe("buildAsiDocumentId", () => {
  it("genera id diario asi_*", () => {
    assert.equal(buildAsiDocumentId(PER, FECHA), "asi_per_01KQQJA5Q1VKBTJ74RHQ0HSHSB_20260615");
  });
});

describe("buildVisDocumentId (bounded context)", () => {
  it("formato vis_{YYYY}_{MM}_per_{ulid}_gdt_{ulid}", () => {
    const id = buildVisDocumentId(PER, FECHA, GDT);
    assert.equal(id, "vis_2026_06_per_01KQQJA5Q1VKBTJ74RHQ0HSHSB_gdt_01KQA6QCA8TDQK9YBTHKYA4R2V");
  });

  it("usa mes de fechaYmd aunque sea día distinto al 01", () => {
    const id = buildVisDocumentId(PER, "2026-06-28", GDT);
    assert.match(id, /^vis_2026_06_per_.+_gdt_.+$/);
  });

  it("lanza PARAMS_INVALIDOS si falta grupo_trabajo_id", () => {
    assert.throws(
      () => buildVisDocumentId(PER, FECHA, ""),
      (err) => err.code === CODIGO_PARAMS_INVALIDOS,
    );
    assert.throws(
      () => buildVisDocumentId(PER, FECHA),
      (err) => err.code === CODIGO_PARAMS_INVALIDOS,
    );
  });

  it("lanza PARAMS_INVALIDOS si grupo no es gdt_*", () => {
    assert.throws(
      () => buildVisDocumentId(PER, FECHA, "grupo_invalido"),
      (err) => err.code === CODIGO_PARAMS_INVALIDOS,
    );
  });

  it("lanza PARAMS_INVALIDOS si persona o fecha inválidos", () => {
    assert.throws(
      () => buildVisDocumentId("x", FECHA, GDT),
      (err) => err.code === CODIGO_PARAMS_INVALIDOS,
    );
    assert.throws(
      () => buildVisDocumentId(PER, "2026-13-01", GDT),
      (err) => err.code === CODIGO_PARAMS_INVALIDOS,
    );
  });
});

describe("diaMesKeyDesdeYmd", () => {
  it("extrae dd", () => {
    assert.equal(diaMesKeyDesdeYmd(FECHA), "15");
  });
});
