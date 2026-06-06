/**
 * node --test functions/test/grillaTeoriaDesalineacion.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  extraerTeoriaRefDesdeCeldaVis,
  evaluarDesalineacionTeoriaLicencia,
  celdaTieneDesalineacionTeoria,
} = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/grillaTeoriaDesalineacion.js"),
);

describe("grillaTeoriaDesalineacion", () => {
  it("extrae referencia desde celda vis con turno", () => {
    const ref = extraerTeoriaRefDesdeCeldaVis({
      tipo_dia: "laborable",
      rda_turno_id: "M",
      es_franco: false,
      rda_ingreso: "06:00",
      rda_egreso: "14:00",
    });
    assert.deepEqual(ref, {
      tipo_dia: "laborable",
      rda_turno_id: "M",
      es_franco: false,
    });
  });

  it("detecta desalineación cuando cambia turno", () => {
    const ref = { tipo_dia: "laborable", rda_turno_id: "M", es_franco: false };
    const vigente = {
      tipo_dia: "laborable",
      rda_turno_id: "T",
      es_franco: false,
    };
    const r = evaluarDesalineacionTeoriaLicencia(ref, vigente);
    assert.equal(r.desalineado, true);
    assert.equal(r.tooltip, "Teoría modificada post-licencia");
  });

  it("no desalinea si teoría coincide", () => {
    const ref = { tipo_dia: "laborable", rda_turno_id: "M", es_franco: false };
    const vigente = {
      tipo_dia: "laborable",
      rda_turno_id: "M",
      es_franco: false,
    };
    assert.equal(evaluarDesalineacionTeoriaLicencia(ref, vigente).desalineado, false);
  });

  it("detecta cambio laborable → franco", () => {
    const ref = { tipo_dia: "laborable", rda_turno_id: "M", es_franco: false };
    const vigente = { tipo_dia: "franco", es_franco: true };
    assert.equal(evaluarDesalineacionTeoriaLicencia(ref, vigente).desalineado, true);
  });

  it("celdaTieneDesalineacionTeoria con eventos", () => {
    const eventos = [
      {
        solicitud_id: "sol_test",
        teoria_ref: { tipo_dia: "laborable", rda_turno_id: "M", es_franco: false },
      },
    ];
    const celda = { tipo_dia: "laborable", rda_turno_id: "N", es_franco: false };
    assert.equal(celdaTieneDesalineacionTeoria(eventos, celda).desalineado, true);
  });

  it("sin teoria_ref ni contradicción fichada no marca desalineación", () => {
    const eventos = [{ solicitud_id: "sol_test" }];
    const celda = {
      tipo_dia: "laborable",
      rda_turno_id: "N",
      fichadas_reales: [{ hora: "08:00" }],
    };
    assert.equal(celdaTieneDesalineacionTeoria(eventos, celda).desalineado, false);
  });

  it("marca desalineación por fichada contradictoria con licencia", () => {
    const eventos = [{ solicitud_id: "sol_test", codigo_grilla: "64-A" }];
    const celda = {
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      rda_turno_id: "M",
      fichadas_reales: [],
    };
    const r = celdaTieneDesalineacionTeoria(eventos, celda);
    assert.equal(r.desalineado, true);
    assert.equal(r.tooltip, "Fichada no coincide con turno teórico");
  });
});
