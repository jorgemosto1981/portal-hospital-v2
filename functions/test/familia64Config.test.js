"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveFamilia64Pair,
  esIngresoFamilia64Oculto,
  esIngresoFamilia64ConGoce,
  resolveFamilia64DesdeSolicitud,
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
} = require("../modules/shared/familia64Config");

const ART_A_HALF = "art_01KTTZZ6841BHNTR479X74M67S";
const ART_B_HALF = "art_01KYSF5SSNM8PQERBK0GB9HREW";

describe("familia64Config", () => {
  it("legacy: 64-A/B canónicos sin campo cfg", () => {
    const a = resolveFamilia64Pair(ARTICULO_64A_ETAPA1_ID, { es_sin_goce: false });
    assert.equal(a.enFamilia, true);
    assert.equal(a.legacy, true);
    assert.equal(a.conGoceId, ARTICULO_64A_ETAPA1_ID);
    assert.equal(a.sinGoceId, ARTICULO_64B_ETAPA1_ID);
    assert.equal(a.esSinGoce, false);

    const b = resolveFamilia64Pair(ARTICULO_64B_ETAPA1_ID, { es_sin_goce: true });
    assert.equal(b.enFamilia, true);
    assert.equal(b.esSinGoce, true);
  });

  it("cfg: par ½ carga profesional", () => {
    const coreA = {
      es_sin_goce: false,
      familia_64_par_articulo_id: ART_B_HALF,
    };
    const coreB = {
      es_sin_goce: true,
      familia_64_par_articulo_id: ART_A_HALF,
    };
    const a = resolveFamilia64Pair(ART_A_HALF, coreA);
    assert.equal(a.enFamilia, true);
    assert.equal(a.legacy, false);
    assert.equal(a.conGoceId, ART_A_HALF);
    assert.equal(a.sinGoceId, ART_B_HALF);
    assert.equal(esIngresoFamilia64ConGoce(coreA, ART_A_HALF), true);
    assert.equal(esIngresoFamilia64Oculto(coreB, ART_B_HALF), true);
    assert.equal(esIngresoFamilia64Oculto(coreA, ART_A_HALF), false);
  });

  it("snapshot en solicitud", () => {
    const sol = {
      articulo_familia_64: true,
      articulo_id: ART_A_HALF,
      articulo_id_con_goce: ART_A_HALF,
      articulo_id_sin_goce: ART_B_HALF,
    };
    const r = resolveFamilia64DesdeSolicitud(sol, null);
    assert.equal(r.enFamilia, true);
    assert.equal(r.conGoceId, ART_A_HALF);
    assert.equal(r.sinGoceId, ART_B_HALF);
  });

  it("art sin par cfg no es familia", () => {
    const r = resolveFamilia64Pair("art_01KVWVW9Z50VR6T1BC6J0R3YQ8", {
      es_sin_goce: false,
      codigo: "63-J",
    });
    assert.equal(r.enFamilia, false);
  });
});
