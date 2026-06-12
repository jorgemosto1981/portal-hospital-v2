/**
 * node --test functions/test/cfgRelojBiometricoCore.test.js
 */
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validarPayloadCfgReloj } = require("../modules/fichadas/cfgRelojBiometricoCore");

describe("validarPayloadCfgReloj", () => {
  it("rechaza sin nombre", () => {
    const r = validarPayloadCfgReloj({ grupo_trabajo_id: "gdt_x" });
    assert.equal(r.ok, false);
  });

  it("normaliza política y umbral", () => {
    const r = validarPayloadCfgReloj({
      nombre: "Entrada",
      grupo_trabajo_id: "gdt_abc",
      politica_validacion: { duplicados: "BLOQUEAR_APLICAR", umbral_duplicado_minutos: 5 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.payload.politica_validacion.duplicados, "BLOQUEAR_APLICAR");
    assert.equal(r.payload.politica_validacion.umbral_duplicado_minutos, 5);
  });

  it("exige rel_* en actualización", () => {
    const r = validarPayloadCfgReloj({
      reloj_id: "bad_id",
      nombre: "X",
      grupo_trabajo_id: "gdt_x",
    });
    assert.equal(r.ok, false);
  });
});
