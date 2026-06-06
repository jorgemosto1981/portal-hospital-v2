"use strict";

/**
 * node --test functions/test/capaTeoricaPorGrupoCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolverCapaTeoricaGrupo } = require("../modules/shared/capaTeoricaPorGrupoCore");

const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const OTRO_GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2W";

describe("resolverCapaTeoricaGrupo", () => {
  it("retorna slice del mapa por gdt", () => {
    const capa = { tipo_dia: "laborable", turno_compuesto_id: "M" };
    const asi = {
      capa_teorica_por_grupo: {
        [GDT]: capa,
        [OTRO_GDT]: { tipo_dia: "franco" },
      },
    };
    assert.deepEqual(resolverCapaTeoricaGrupo(asi, GDT), capa);
  });

  it("retorna null si mapa vacío o ausente", () => {
    assert.equal(resolverCapaTeoricaGrupo(null, GDT), null);
    assert.equal(resolverCapaTeoricaGrupo({}, GDT), null);
    assert.equal(resolverCapaTeoricaGrupo({ capa_teorica_por_grupo: {} }, GDT), null);
  });

  it("retorna null si gdt no tiene entrada", () => {
    const asi = {
      capa_teorica_por_grupo: {
        [OTRO_GDT]: { tipo_dia: "franco" },
      },
    };
    assert.equal(resolverCapaTeoricaGrupo(asi, GDT), null);
  });

  it("retorna null si grupoTrabajoId inválido", () => {
    const asi = {
      capa_teorica_por_grupo: {
        [GDT]: { tipo_dia: "laborable" },
      },
    };
    assert.equal(resolverCapaTeoricaGrupo(asi, ""), null);
    assert.equal(resolverCapaTeoricaGrupo(asi, "not_gdt"), null);
  });

  it("ignora capa_teorica plana legacy en raíz", () => {
    const asi = {
      capa_teorica: { tipo_dia: "laborable" },
      capa_teorica_por_grupo: {},
    };
    assert.equal(resolverCapaTeoricaGrupo(asi, GDT), null);
  });
});
