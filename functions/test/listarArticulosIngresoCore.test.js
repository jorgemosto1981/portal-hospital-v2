"use strict";

/**
 * node --test functions/test/listarArticulosIngresoCore.test.js
 */
const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  esArticuloOperativo,
  versionPublicadaEsMasReciente,
} = require("../modules/shared/listarArticulosIngresoCore");
const {
  modoListadoArticulosIngreso,
  usaCatalogoPatronBCompleto,
} = require("../modules/shared/ticketeraArticulosMvp");
const { GET_ALL_CHUNK } = require("../modules/shared/firestoreGetAllChunked");

describe("esArticuloOperativo", () => {
  it("rechaza activo false", () => {
    assert.equal(esArticuloOperativo({ activo: false, nombre: "X" }), false);
  });

  it("acepta activo true o ausente", () => {
    assert.equal(esArticuloOperativo({ activo: true }), true);
    assert.equal(esArticuloOperativo({ nombre: "64-A" }), true);
  });
});

describe("versionPublicadaEsMasReciente", () => {
  it("elige vigente_desde posterior", () => {
    assert.equal(
      versionPublicadaEsMasReciente({ vigente_desde: "2026-05-01" }, { vigente_desde: "2026-01-01" }),
      true,
    );
    assert.equal(
      versionPublicadaEsMasReciente({ vigente_desde: "2026-01-01" }, { vigente_desde: "2026-05-01" }),
      false,
    );
  });
});

describe("modoListadoArticulosIngreso", () => {
  const prev = process.env.TICKETERA_LISTAR_TODOS_PATRON_B;

  afterEach(() => {
    if (prev === undefined) delete process.env.TICKETERA_LISTAR_TODOS_PATRON_B;
    else process.env.TICKETERA_LISTAR_TODOS_PATRON_B = prev;
  });

  it("mvp por defecto (whitelist piloto)", () => {
    delete process.env.TICKETERA_LISTAR_TODOS_PATRON_B;
    assert.equal(modoListadoArticulosIngreso(), "mvp");
    assert.equal(usaCatalogoPatronBCompleto(), false);
  });

  it("catalogo con TICKETERA_LISTAR_TODOS_PATRON_B=1", () => {
    process.env.TICKETERA_LISTAR_TODOS_PATRON_B = "1";
    assert.equal(modoListadoArticulosIngreso(), "catalogo");
    assert.equal(usaCatalogoPatronBCompleto(), true);
  });
});

describe("GET_ALL_CHUNK", () => {
  it("respeta límite Firestore (10)", () => {
    assert.equal(GET_ALL_CHUNK, 10);
  });
});
