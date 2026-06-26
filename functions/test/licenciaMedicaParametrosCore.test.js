"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  calcularVencimientoPlazoCertificado,
  resolverHorasDesdeParametroSistema,
} = require("../modules/shared/licenciaMedicaParametrosCore.js");

describe("licenciaMedicaParametrosCore", () => {
  it("resuelve valor_numerico del catálogo", () => {
    assert.equal(resolverHorasDesdeParametroSistema({ valor_numerico: 48 }), 48);
  });

  it("rechaza valor inválido sin fallback", () => {
    assert.throws(() => resolverHorasDesdeParametroSistema({ valor_numerico: 0 }));
  });

  it("calcula vencimiento en horas", () => {
    const anchor = new Date("2026-06-10T12:00:00.000Z");
    const fin = calcularVencimientoPlazoCertificado(anchor, 24);
    assert.equal(fin.getTime() - anchor.getTime(), 24 * 3600 * 1000);
  });
});
