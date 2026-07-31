"use strict";

/**
 * node --test functions/test/solicitudTrazabilidadResolucion.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  trazabilidadResolucionSolicitud,
} = require("../modules/shared/solicitudTrazabilidadResolucion");

/** Stub de Firestore que solo resuelve `cfg_articulos`. */
function fakeDb(articulos) {
  return {
    collection() {
      return {
        doc(id) {
          return {
            async get() {
              const core = articulos[id];
              return { exists: Boolean(core), data: () => core || {} };
            },
          };
        },
      };
    },
  };
}

const ARTICULOS = {
  art_con: { codigo: "64-A", nombre: "ASUNTOS PARTICULARES CON GOCE DE HABERES" },
  art_sin: { codigo: "64-B", nombre: "ASUNTOS PARTICULARES SIN GOCE DE HABERES" },
};

describe("trazabilidadResolucionSolicitud", () => {
  it("trámite sin cruces ni derivaciones no genera bloque", async () => {
    const r = await trazabilidadResolucionSolicitud(fakeDb({}), { articulo_id: "art_x" }, new Map());
    assert.equal(r, null);
  });

  it("cruce 64: expone los códigos de origen y destino, no solo los ids", async () => {
    const r = await trazabilidadResolucionSolicitud(
      fakeDb(ARTICULOS),
      {
        cruce_modalidad_64: {
          de: "con_goce",
          a: "sin_goce",
          articulo_origen_id: "art_con",
          articulo_destino_id: "art_sin",
          dias: 2,
        },
      },
      new Map(),
    );
    assert.equal(r.modalidad_64.codigo_origen, "64-A");
    assert.equal(r.modalidad_64.codigo_destino, "64-B");
    assert.equal(r.modalidad_64.de, "con_goce");
    assert.equal(r.modalidad_64.a, "sin_goce");
    assert.equal(r.modalidad_64.dias, 2);
  });

  it("vincula el 77-0 derivado en los dos sentidos", async () => {
    const padre = await trazabilidadResolucionSolicitud(
      fakeDb({}),
      { art_77_0_derivada_id: "sol_hija" },
      new Map(),
    );
    assert.equal(padre.art_77_0_derivada_id, "sol_hija");
    assert.equal(padre.origen_rechazo_sol_id, null);

    const hija = await trazabilidadResolucionSolicitud(
      fakeDb({}),
      { origen_rechazo_sol_id: "sol_padre" },
      new Map(),
    );
    assert.equal(hija.origen_rechazo_sol_id, "sol_padre");
    assert.equal(hija.art_77_0_derivada_id, null);
  });

  it("descarta ids que no son de solicitud", async () => {
    const r = await trazabilidadResolucionSolicitud(
      fakeDb({}),
      { art_77_0_derivada_id: "basura", art_77_0_derivacion_pendiente: true },
      new Map(),
    );
    assert.equal(r.art_77_0_derivada_id, null);
    assert.equal(r.art_77_0_derivacion_pendiente, true);
  });

  it("la derivación fallida se reporta con su código de error", async () => {
    const r = await trazabilidadResolucionSolicitud(
      fakeDb({}),
      { art_77_0_derivacion_pendiente: true, art_77_0_derivacion_error: "ART_77_0_NO_CONFIGURADO" },
      new Map(),
    );
    assert.equal(r.art_77_0_derivacion_error, "ART_77_0_NO_CONFIGURADO");
    assert.equal(r.modalidad_64, null);
  });

  it("reusa el caché de artículos entre trámites", async () => {
    let lecturas = 0;
    const db = {
      collection() {
        return {
          doc(id) {
            return {
              async get() {
                lecturas += 1;
                return { exists: true, data: () => ARTICULOS[id] || {} };
              },
            };
          },
        };
      },
    };
    const cache = new Map();
    const sol = {
      cruce_modalidad_64: {
        de: "con_goce",
        a: "sin_goce",
        articulo_origen_id: "art_con",
        articulo_destino_id: "art_sin",
        dias: 1,
      },
    };
    await trazabilidadResolucionSolicitud(db, sol, cache);
    await trazabilidadResolucionSolicitud(db, sol, cache);
    assert.equal(lecturas, 2);
  });
});
