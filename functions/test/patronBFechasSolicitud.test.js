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
  fechaHastaConIndiceCalendario,
  diasSolicitadosDesdeVersion,
} = require("../modules/shared/patronBFechasSolicitud");
const {
  resolvePatronBConsumoDesdeSolicitud,
} = require("../modules/shared/opcionesConsumoSolicitud");
const { validarFechasArticulo } = require("../modules/shared/validarFechasArticulo");
const { buildIndiceEventosCalendario } = require("../modules/shared/calendarInstitucionalCore");
const { CFG_RCD_HABILES_COMPUESTO } = require("../modules/shared/modoComputoCalendario");

const SPECS_PATH = join(__dirname, "..", "..", "docs/v2/seeds/oleada_63_p2/OLEADA_63_P2_SPECS.json");

function version63jFromSpecs() {
  const spec63j = JSON.parse(readFileSync(SPECS_PATH, "utf8")).articulos.find((a) => a.inciso === "63j");
  return {
    bloque_topes_plazos_computo: {
      regla_computo_dias_id: CFG_RCD_HABILES_COMPUESTO,
      tope_dias_por_evento: 5,
      usa_calendario_institucional: true,
    },
    opciones_consumo_solicitud: spec63j.opciones_consumo_solicitud,
  };
}

/** Índice de prueba 2026: feriado institucional el miércoles 2026-06-03. */
function indiceCalendarioJunio2026() {
  return buildIndiceEventosCalendario([
    {
      id: "2026-06-03",
      data: { tipo: "feriado", descripcion: "Feriado prueba UAT", multiplicador: 1, anual: false },
    },
  ]);
}

describe("patronBFechasSolicitud — 63.j días laborables (calendario institucional)", () => {
  const versionData = version63jFromSpecs();
  const indice = indiceCalendarioJunio2026();

  it("SPECS 63.j declara hábiles compuesto en todas las opciones", () => {
    for (const row of versionData.opciones_consumo_solicitud) {
      assert.equal(row.regla_computo_id, CFG_RCD_HABILES_COMPUESTO);
    }
    assert.equal(versionData.bloque_topes_plazos_computo.regla_computo_dias_id, CFG_RCD_HABILES_COMPUESTO);
  });

  it("sin opción en listado devuelve 1 día cuando hay opciones activas", () => {
    assert.equal(diasSolicitadosDesdeVersion(versionData), 1);
  });

  it("hermanos (3 laborables): salta feriado 2026-06-03 — no es suma aritmética de corridos", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_hermanos",
      dias_solicitados: 3,
    });
    assert.equal(consumo.ok, true);
    assert.equal(consumo.diasPedidos, 3);
    const hasta = fechaHastaConIndiceCalendario(
      "2026-06-02",
      consumo.diasPedidos,
      consumo.versionEff,
      indice,
    );
    assert.equal(hasta, "2026-06-05", "3 hábiles: mar 2, jue 4, vie 5 (mié 3 feriado)");
    assert.notEqual(hasta, "2026-06-04", "corridos daría jue 4 sin calendario");
  });

  it("validarFechasArticulo alinea fecha_hasta con el mismo índice", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_hermanos",
      dias_solicitados: 3,
    });
    const r = validarFechasArticulo({
      versionData: consumo.versionEff,
      fechaDesde: "2026-06-02",
      fechaHasta: "2026-06-02",
      diasSolicitados: 3,
      refYmd: "2026-06-01",
      omitirHorizonte: true,
      indice,
    });
    assert.equal(r.ok, true);
    assert.equal(r.fecha_hasta, "2026-06-05");
  });

  it("opción aplicada usa calendario institucional en bloque 4", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_tios_sobrinos",
      dias_solicitados: 1,
    });
    assert.equal(consumo.ok, true);
    assert.equal(
      consumo.versionEff.bloque_topes_plazos_computo.regla_computo_dias_id,
      CFG_RCD_HABILES_COMPUESTO,
    );
    assert.equal(consumo.versionEff.bloque_topes_plazos_computo.usa_calendario_institucional, true);
  });

  it("fechaHastaDesdeVersionPatronB sync exige índice para multi-día hábil", () => {
    const consumo = resolvePatronBConsumoDesdeSolicitud(versionData, {
      opcion_consumo_id: "oc_63j_hermanos",
      dias_solicitados: 3,
    });
    const conIndice = fechaHastaDesdeVersionPatronB(
      "2026-06-02",
      3,
      consumo.versionEff,
      indice,
    );
    assert.equal(conIndice, "2026-06-05");
  });
});
