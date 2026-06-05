"use strict";

/**
 * node --test functions/test/grillaGsoSoloLectura.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluarPoliticaGsoMes,
  resolverEscrituraGsoDia,
} = require("../modules/asistencia/grillaGsoSoloLectura");

describe("evaluarPoliticaGsoMes", () => {
  it("junio 2026 consulta mayo → solo lectura", () => {
    const p = evaluarPoliticaGsoMes({
      periodoYm: "2026-05",
      hoyYmd: "2026-06-15",
      esRrhhLabor: false,
    });
    assert.equal(p.solo_lectura, true);
    assert.equal(p.codigo, "ASI-GSO-001");
  });

  it("junio consulta junio → editable", () => {
    const p = evaluarPoliticaGsoMes({
      periodoYm: "2026-06",
      hoyYmd: "2026-06-01",
      esRrhhLabor: false,
    });
    assert.equal(p.solo_lectura, false);
  });

  it("RRHH labor sin ventana", () => {
    const p = evaluarPoliticaGsoMes({
      periodoYm: "2026-05",
      hoyYmd: "2026-06-15",
      esRrhhLabor: true,
    });
    assert.equal(p.solo_lectura, false);
  });
});

describe("resolverEscrituraGsoDia", () => {
  it("prioriza período cerrado", () => {
    const g = resolverEscrituraGsoDia({
      fechaYmd: "2026-06-10",
      periodoCerrado: true,
      esRrhhLabor: false,
    });
    assert.equal(g.escritura_habilitada, false);
    assert.equal(g.codigo, "ASI-PER-001");
  });
});
