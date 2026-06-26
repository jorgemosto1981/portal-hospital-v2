"use strict";

/**
 * node --test functions/test/validarFechasArticulo.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  validarCruceAnioCalendario,
  validarFechasArticulo,
  readModoCalculo,
  ymdFinHorizonteAgenteBase,
  CODIGO_INCONSISTENCIA_DIAS_CORRIDOS,
} = require("../modules/shared/validarFechasArticulo");
const { buildIndiceEventosCalendario } = require("../modules/shared/calendarInstitucionalCore");
const { CFG_RCD_CORRIDOS, CFG_RCD_HABILES_COMPUESTO } = require("../modules/shared/modoComputoCalendario");

describe("validarFechasArticulo", () => {
  it("detecta cruce de año", () => {
    const r = validarCruceAnioCalendario("2026-12-30", "2027-01-02");
    assert.equal(r.ok, false);
  });

  it("horizonte agente — fin mes siguiente", () => {
    assert.equal(ymdFinHorizonteAgenteBase("2026-05-15"), "2026-06-30");
  });

  it("corridos: deriva fecha_hasta multi-día", () => {
    const versionData = {
      bloque_topes_plazos_computo: { regla_computo_dias_id: CFG_RCD_CORRIDOS },
    };
    const r = validarFechasArticulo({
      versionData,
      fechaDesde: "2026-06-02",
      fechaHasta: "2026-06-02",
      diasSolicitados: 3,
      refYmd: "2026-06-01",
      omitirHorizonte: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.fecha_hasta, "2026-06-04");
  });

  it("corridos: exige coherencia con días de calendario", () => {
    const versionData = {
      bloque_topes_plazos_computo: { regla_computo_dias_id: CFG_RCD_CORRIDOS },
    };
    const m = readModoCalculo(versionData);
    assert.equal(m.usaCalendario, false);
    const r = validarFechasArticulo({
      versionData,
      fechaDesde: "2026-05-23",
      fechaHasta: "2026-05-24",
      diasSolicitados: 1,
      refYmd: "2026-05-20",
    });
    assert.equal(r.ok, false);
    assert.ok(r.codigos.includes(CODIGO_INCONSISTENCIA_DIAS_CORRIDOS));
  });

  it("hábiles compuesto: feriado bloquea C4", () => {
    const versionData = {
      bloque_topes_plazos_computo: { regla_computo_dias_id: CFG_RCD_HABILES_COMPUESTO },
    };
    const indice = buildIndiceEventosCalendario([
      { id: "2026-05-25", data: { tipo: "feriado", descripcion: "F", multiplicador: 1, anual: false } },
    ]);
    const r = validarFechasArticulo({
      versionData,
      fechaDesde: "2026-05-25",
      fechaHasta: "2026-05-25",
      diasSolicitados: 1,
      refYmd: "2026-05-20",
      indice,
    });
    assert.equal(r.ok, false);
    assert.ok(r.codigos.includes("INCONSISTENCIA_DIAS_HABILES"));
  });
});
