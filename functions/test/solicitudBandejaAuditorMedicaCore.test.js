"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  itemPasaFiltroIncompleta,
  esIncompletaMedica,
  FILTRO_COMPLETAS,
  FILTRO_PROVISORIAS,
  FILTRO_TODAS,
} = require("../modules/shared/solicitudBandejaAuditorMedicaCore");

describe("solicitudBandejaAuditorMedicaCore", () => {
  it("esIncompletaMedica lee ingreso_medico", () => {
    assert.equal(esIncompletaMedica({ ingreso_medico: { es_licencia_incompleta: true } }), true);
    assert.equal(esIncompletaMedica({ ingreso_medico: { es_licencia_incompleta: false } }), false);
  });

  it("itemPasaFiltroIncompleta separa completas y provisorias", () => {
    const completa = { es_licencia_incompleta: false };
    const prov = { es_licencia_incompleta: true };
    assert.equal(itemPasaFiltroIncompleta(completa, FILTRO_COMPLETAS), true);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_COMPLETAS), false);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_PROVISORIAS), true);
    assert.equal(itemPasaFiltroIncompleta(completa, FILTRO_PROVISORIAS), false);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_TODAS), true);
  });
});
