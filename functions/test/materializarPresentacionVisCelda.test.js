"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  debeOmitirPresentacionCompuestoMaterializada,
  construirCeldaCtxTrasCapaMaterializada,
  resolverPresentacionVisMaterializada,
} = require("../modules/shared/materializarPresentacionVisCelda");

describe("materializarPresentacionVisCelda (épica B)", () => {
  it("franco materializado omite presentación", () => {
    assert.equal(debeOmitirPresentacionCompuestoMaterializada({ tipo_dia: "franco", segmentos: [] }), true);
    const pres = resolverPresentacionVisMaterializada(
      { presentacion_compuesto: { turno_compuesto_id: "T", filas: [] } },
      { tipo_dia: "franco", segmentos: [] },
      null,
      { fecha_ymd: "2026-06-21" },
    );
    assert.equal(pres, null);
  });

  it("saldo cero (segmentos vacíos) omite presentación", () => {
    assert.equal(
      debeOmitirPresentacionCompuestoMaterializada({ tipo_dia: "laborable", segmentos: [] }),
      true,
    );
  });

  it("construirCeldaCtx limpia presentación stale en franco", () => {
    const ctx = construirCeldaCtxTrasCapaMaterializada(
      {
        tipo_dia: "laborable",
        rda_turno_id: "T",
        presentacion_compuesto: { turno_compuesto_id: "M+T+N", filas: [] },
      },
      { tipo_dia: "franco", segmentos: [], fichadas_esperadas: 0 },
    );
    assert.equal(ctx.tipo_dia, "franco");
    assert.equal(ctx.es_franco, true);
    assert.equal(ctx.rda_turno_id, null);
    assert.equal(ctx.presentacion_compuesto, undefined);
  });
});
