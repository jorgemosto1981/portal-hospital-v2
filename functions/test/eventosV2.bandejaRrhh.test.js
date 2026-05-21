"use strict";

/**
 * Bandeja RRHH vs módulo artículos (§5.4 handoff).
 * Ejecutar: node --test functions/test/eventosV2.bandejaRrhh.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { debeProyectarBandejaRrhh } = require("../modules/shared/eventosV2");

describe("debeProyectarBandejaRrhh", () => {
  it("articulos no proyecta a eventos_bandeja_rrhh", () => {
    assert.equal(debeProyectarBandejaRrhh("articulos"), false);
    assert.equal(debeProyectarBandejaRrhh("ARTICULOS"), false);
  });

  it("datos personales y otros módulos sí proyectan", () => {
    assert.equal(debeProyectarBandejaRrhh("datos_personales"), true);
    assert.equal(debeProyectarBandejaRrhh("login"), true);
  });

  it("modulo vacío no proyecta (sin bandeja fantasma)", () => {
    assert.equal(debeProyectarBandejaRrhh(""), false);
    assert.equal(debeProyectarBandejaRrhh(null), false);
  });
});
