"use strict";

/**
 * Pruebas unitarias (sin Firestore) — lógica pura §5.2.
 * Escala: 01 menor … 99 mayor jerarquía.
 * Ejecutar: node --test functions/test/solicitudAutorizacionJerarquicaCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  autorizadoresCandidatosEnGrupo,
  reducirAutorizadoresPorMejorRango,
  revisorPuedeAutorizarJerarquico,
} = require("../modules/shared/solicitudAutorizacionJerarquicaCore");

describe("autorizadoresCandidatosEnGrupo", () => {
  const integrantes = [
    { persona_id: "per_TITULAR", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 20 },
    { persona_id: "per_BAJO", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 1 },
    { persona_id: "per_JEFE_A", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 90 },
    { persona_id: "per_JEFE_B", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 90 },
    { persona_id: "per_MEDIO", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 25 },
    { persona_id: "per_SIN_NIVEL", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: null },
  ];

  it("solo niveles estrictamente mayores que el titular", () => {
    const c = autorizadoresCandidatosEnGrupo(integrantes, "per_TITULAR", 20);
    const ids = c.map((x) => x.persona_id).sort();
    assert.deepEqual(ids, ["per_JEFE_A", "per_JEFE_B", "per_MEDIO"]);
  });

  it("sin nivel titular → sin candidatos", () => {
    const c = autorizadoresCandidatosEnGrupo(integrantes, "per_TITULAR", null);
    assert.equal(c.length, 0);
  });
});

describe("reducirAutorizadoresPorMejorRango", () => {
  it("autoriza el nivel más alto entre superiores (empate OR)", () => {
    const r = reducirAutorizadoresPorMejorRango([
      { persona_id: "per_25", nivel: 25 },
      { persona_id: "per_60", nivel: 60 },
      { persona_id: "per_77", nivel: 77 },
      { persona_id: "per_77b", nivel: 77 },
    ]);
    assert.deepEqual(r.autorizadores_elegibles_ids, ["per_77", "per_77b"]);
    assert.equal(r.nivel_autorizacion, 77);
  });

  it("titular 20 con 25 y 90 → gana 90", () => {
    const r = reducirAutorizadoresPorMejorRango([
      { persona_id: "per_A", nivel: 90 },
      { persona_id: "per_B", nivel: 90 },
      { persona_id: "per_C", nivel: 25 },
    ]);
    assert.deepEqual(r.autorizadores_elegibles_ids, ["per_A", "per_B"]);
    assert.equal(r.nivel_autorizacion, 90);
  });
});

describe("revisorPuedeAutorizarJerarquico", () => {
  it("revisor en lista", () => {
    assert.equal(
      revisorPuedeAutorizarJerarquico(
        { autorizadores_elegibles_ids: ["per_A", "per_B"] },
        "per_B",
      ),
      true,
    );
  });

  it("huérfana solo con flag RRHH sustituto", () => {
    assert.equal(
      revisorPuedeAutorizarJerarquico(
        { autorizacion_rrhh_sustituta: true, autorizadores_elegibles_ids: [] },
        "per_RRHH",
        { rrhhSustituto: true },
      ),
      true,
    );
    assert.equal(
      revisorPuedeAutorizarJerarquico(
        { autorizacion_rrhh_sustituta: true, autorizadores_elegibles_ids: [] },
        "per_RRHH",
      ),
      false,
    );
  });
});
