"use strict";

/**
 * node --test functions/test/opcionesConsumoSolicitud.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const {
  leerOpcionesConsumoDesdeVersion,
  filtrarOpcionesActivas,
  resolverOpcionConsumo,
  versionDataConOpcionAplicada,
  mapOpcionesParaListadoCliente,
  versionTieneOpcionesConsumoActivas,
} = require("../modules/shared/opcionesConsumoSolicitud");

const SPECS_PATH = join(__dirname, "..", "..", "docs/v2/seeds/oleada_63_p2/OLEADA_63_P2_SPECS.json");

/** @type {Record<string, unknown>} */
const spec63j = JSON.parse(readFileSync(SPECS_PATH, "utf8")).articulos.find((a) => a.inciso === "63j");

describe("opcionesConsumoSolicitud — fixture 63.j", () => {
  const versionData = {
    bloque_topes_plazos_computo: {
      regla_computo_dias_id: "cfg_rcd_corridos",
      tope_dias_por_evento: 5,
    },
    opciones_consumo_solicitud: spec63j.opciones_consumo_solicitud,
  };

  it("lee 4 opciones activas", () => {
    const all = leerOpcionesConsumoDesdeVersion(versionData);
    assert.equal(all.length, 4);
    assert.equal(filtrarOpcionesActivas(all).length, 4);
    assert.equal(versionTieneOpcionesConsumoActivas(versionData), true);
  });

  it("resolverOpcionConsumo hermanos → 3 días", () => {
    const r = resolverOpcionConsumo(versionData, "oc_63j_hermanos");
    assert.equal(r.ok, true);
    assert.equal(r.opcion.dias_por_evento, 3);
  });

  it("requiere id cuando hay opciones", () => {
    const r = resolverOpcionConsumo(versionData, "");
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "OPCION_CONSUMO_REQUERIDA");
  });

  it("versionDataConOpcionAplicada mantiene corridos", () => {
    const r = resolverOpcionConsumo(versionData, "oc_63j_tios_sobrinos");
    assert.equal(r.ok, true);
    const eff = versionDataConOpcionAplicada(versionData, r.opcion);
    assert.equal(eff.bloque_topes_plazos_computo.regla_computo_dias_id, "cfg_rcd_corridos");
    assert.equal(eff.bloque_topes_plazos_computo.usa_calendario_institucional, false);
  });

  it("mapOpcionesParaListadoCliente expone campos wizard", () => {
    const rows = mapOpcionesParaListadoCliente(versionData);
    assert.equal(rows.length, 4);
    assert.equal(rows[1].id, "oc_63j_hermanos");
    assert.equal(rows[1].dias_por_evento, 3);
    assert.equal(rows[1].regla_computo_dias_id, "cfg_rcd_corridos");
  });
});

describe("opcionesConsumoSolicitud — sin opciones", () => {
  it("resolver devuelve SIN_OPCIONES_CONSUMO", () => {
    const r = resolverOpcionConsumo({ bloque_topes_plazos_computo: {} }, "oc_x");
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "SIN_OPCIONES_CONSUMO");
  });
});
