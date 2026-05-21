"use strict";

/**
 * Pruebas unitarias (sin Firestore) — lógica pura §5.2.
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
    { persona_id: "per_TITULAR", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 40 },
    { persona_id: "per_JEFE_A", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 10 },
    { persona_id: "per_JEFE_B", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 10 },
    { persona_id: "per_OTRO", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: 25 },
    { persona_id: "per_SIN_NIVEL", grupo_de_trabajo_id: "gdt_A", nivel_jerarquico: null },
  ];

  it("excluye titular y niveles >= titular", () => {
    const c = autorizadoresCandidatosEnGrupo(integrantes, "per_TITULAR", 40);
    const ids = c.map((x) => x.persona_id).sort();
    assert.deepEqual(ids, ["per_JEFE_A", "per_JEFE_B", "per_OTRO"]);
  });

  it("sin nivel titular → sin candidatos", () => {
    const c = autorizadoresCandidatosEnGrupo(integrantes, "per_TITULAR", null);
    assert.equal(c.length, 0);
  });
});

describe("reducirAutorizadoresPorMejorRango", () => {
  it("empate OR — solo nivel mínimo", () => {
    const r = reducirAutorizadoresPorMejorRango([
      { persona_id: "per_A", nivel: 10 },
      { persona_id: "per_B", nivel: 10 },
      { persona_id: "per_C", nivel: 15 },
    ]);
    assert.deepEqual(r.autorizadores_elegibles_ids, ["per_A", "per_B"]);
    assert.equal(r.nivel_autorizacion, 10);
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
