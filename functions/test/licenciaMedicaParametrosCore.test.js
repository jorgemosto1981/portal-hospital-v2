"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolverHorasDesdeParametroSistema,
} = require("../modules/shared/licenciaMedicaParametrosCore.js");

describe("licenciaMedicaParametrosCore", () => {
  it("resuelve valor_numerico del catálogo", () => {
    assert.equal(resolverHorasDesdeParametroSistema({ valor_numerico: 48 }), 48);
  });

  it("rechaza valor inválido sin fallback", () => {
    assert.throws(() => resolverHorasDesdeParametroSistema({ valor_numerico: 0 }));
  });

  it("calcula vencimiento desde inicio de licencia al cierre del día calendario", () => {
    const {
      calcularVencimientoPlazoCertificadoDesdeInicioLicencia,
      diasCalendarioPlazoDesdeHorasParametro,
    } = require("../modules/shared/licenciaMedicaParametrosCore.js");
    assert.equal(diasCalendarioPlazoDesdeHorasParametro(24), 1);
    const fin = calcularVencimientoPlazoCertificadoDesdeInicioLicencia("2026-06-24", 24);
    const isoBa = fin.toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    assert.match(isoBa, /23:59/);
  });
});
