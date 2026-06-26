"use strict";

/**
 * node --test functions/test/patronBFechasSolicitud.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const {
  fechaHastaDesdeVersionPatronB,
  diasSolicitadosDesdeVersion,
} = require("../modules/shared/patronBFechasSolicitud");
const {
  resolvePatronBConsumoDesdeSolicitud,
} = require("../modules/shared/opcionesConsumoSolicitud");
const { validarFechasArticulo } = require("../modules/shared/validarFechasArticulo");
const { CFG_RCD_CORRIDOS } = require("../modules/shared/modoComputoCalendario");

const SPECS_PATH = join(__dirname, "..", "..", "docs/v2/seeds/oleada_63_p2/OLEADA_63_P2_SPECS.json");

function version63jFromSpecs() {
  const spec63j = JSON.parse(readFileSync(SPECS_PATH, "utf8")).articulos.find((a) => a.inciso === "63j");
  return {
    bloque_topes_plazos_computo: {
      regla_computo_dias_id: CFG_RCD_CORRIDOS,
      tope_dias_por_evento: 5,
      usa_calendario_institucional: false,
    },
    opciones_consumo_solicitud: spec63j.opciones_consumo_solicitud,
  };
}

describe("patronBFechasSolicitud — corridos 63.j", () => {
  const versionData = version63jFromSpecs();

  it("sin opciones en listado devuelve 1 día por defecto cuando hay opciones activas", () => {
    assert.equal(diasSolicitadosDesdeVersion(versionData), 1);
  });

  it("hermanos (3 días): fecha_hasta = fecha_desde + 2 corridos", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_hermanos",
      dias_solicitados: 3,
    });
    assert.equal(consumo.ok, true);
    assert.equal(consumo.diasPedidos, 3);
    const hasta = fechaHastaDesdeVersionPatronB("2026-06-02", consumo.diasPedidos, consumo.versionEff);
    assert.equal(hasta, "2026-06-04");
  });

  it("validarFechasArticulo acepta 3 corridos con fecha_hasta derivada", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_hermanos",
      dias_solicitados: 3,
    });
    assert.equal(consumo.ok, true);
    const r = validarFechasArticulo({
      versionData: consumo.versionEff,
      fechaDesde: "2026-06-02",
      fechaHasta: "2026-06-02",
      diasSolicitados: 3,
      refYmd: "2026-06-01",
      omitirHorizonte: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.fecha_hasta, "2026-06-04");
  });

  it("versionDataConOpcionAplicada fija tope por opción", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_tios_sobrinos",
      dias_solicitados: 1,
    });
    assert.equal(consumo.ok, true);
    assert.equal(
      consumo.versionEff.bloque_topes_plazos_computo.tope_dias_por_evento,
      1,
    );
  });
});
