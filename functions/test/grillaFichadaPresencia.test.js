/**
 * node --test functions/test/grillaFichadaPresencia.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  resolverFichadaPresencia,
  evaluarContradiccionFichadaTeoria,
  lineasHorarioFichadaReal,
} = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/grillaFichadaPresencia.js"),
);

describe("grillaFichadaPresencia (US-15)", () => {
  it("presente cuando hay fichadas_reales", () => {
    const p = resolverFichadaPresencia({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      fichadas_reales: [{ hora: "06:05" }],
    });
    assert.equal(p, "presente");
  });

  it("ausente en laborable sin fichada cuando capa 4 está cargada", () => {
    const p = resolverFichadaPresencia({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      rda_turno_id: "M",
      fichadas_reales: [],
    });
    assert.equal(p, "ausente");
  });

  it("null si no hay capa fichada materializada", () => {
    const p = resolverFichadaPresencia({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      rda_turno_id: "M",
    });
    assert.equal(p, null);
  });

  it("null en franco sin fichada", () => {
    const p = resolverFichadaPresencia({
      tipo_dia: "franco",
      es_franco: true,
    });
    assert.equal(p, null);
  });

  it("contradicción: fichada en franco", () => {
    const r = evaluarContradiccionFichadaTeoria({
      tipo_dia: "franco",
      es_franco: true,
      fichadas_reales: [{ hora: "08:00" }],
    });
    assert.equal(r.contradictorio, true);
    assert.equal(r.tooltip, "Fichada no coincide con turno teórico");
  });

  it("contradicción: ausente en laborable con expectativa", () => {
    const r = evaluarContradiccionFichadaTeoria({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      rda_turno_id: "M",
      fichadas_reales: [],
    });
    assert.equal(r.contradictorio, true);
  });

  it("lineasHorarioFichadaReal formatea pares y hora suelta", () => {
    const lineas = lineasHorarioFichadaReal([
      { ingreso: "06:00", egreso: "14:00" },
      { tipo: "ingreso", hora: "06:05" },
    ]);
    assert.deepEqual(lineas, ["06:00 – 14:00", "ingreso: 06:05"]);
  });
});
