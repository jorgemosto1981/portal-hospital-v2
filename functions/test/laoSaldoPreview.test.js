"use strict";

/**
 * node --test functions/test/laoSaldoPreview.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluarSaldoBolsaParaPreview,
  mergeBolsasFromSaldoDocs,
} = require("../modules/shared/laoSaldosBolsa");

const ART = "art_01JTEST00000000000000001";

describe("evaluarSaldoBolsaParaPreview", () => {
  const saldosMerged = mergeBolsasFromSaldoDocs([
    {
      bolsas: {
        bol_2024: {
          bolsa_id: `bol_${ART}_2024`,
          articulo_id: ART,
          anio_origen: 2024,
          disponible: 3,
          consumido: 0,
          cantidad_inicial: 3,
        },
      },
    },
  ]);

  it("rechaza stock cuando dias_solicitados supera disponible", () => {
    const r = evaluarSaldoBolsaParaPreview({
      saldosMerged,
      articuloId: ART,
      anioOrigenBolsa: 2024,
      diasSolicitados: 4,
      fechaDesdeYmd: "2026-05-10",
    });
    assert.equal(r.ok, false);
    assert.equal(r.camino, "stock");
    assert.equal(r.disponible, 3);
    assert.ok(r.motivos.some((m) => m.includes("Saldo insuficiente")));
  });

  it("acepta stock cuando dias_solicitados caben en disponible", () => {
    const r = evaluarSaldoBolsaParaPreview({
      saldosMerged,
      articuloId: ART,
      anioOrigenBolsa: 2024,
      diasSolicitados: 3,
      fechaDesdeYmd: "2026-05-10",
    });
    assert.equal(r.ok, true);
    assert.equal(r.disponible, 3);
  });
});
