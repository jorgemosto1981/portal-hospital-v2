"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
  esSolicitudCarril64Unificado,
  resolverRutaFamilia64Alta,
} = require("../modules/shared/solicitudPatronBCruceModalidad64");

describe("solicitudPatronBCruceModalidad64", () => {
  it("detecta carril 64 por articulo_id o codigo", () => {
    assert.equal(esSolicitudCarril64Unificado({ articulo_id: ARTICULO_64A_ETAPA1_ID }), true);
    assert.equal(esSolicitudCarril64Unificado({ articulo_id: ARTICULO_64B_ETAPA1_ID }), true);
    assert.equal(esSolicitudCarril64Unificado({ codigo_grilla: "64" }), true);
    assert.equal(esSolicitudCarril64Unificado({ codigo_grilla: "64-A" }), true);
    assert.equal(esSolicitudCarril64Unificado({ articulo_id: "art_otro", codigo_grilla: "63-C" }), false);
  });

  it("sin trámites en el mes → ruta con_goce (64-A)", async () => {
    const db = {
      collection(name) {
        if (name === "solicitudes_articulo") {
          return {
            where() {
              return this;
            },
            async get() {
              return { docs: [] };
            },
          };
        }
        throw new Error(`col inesperada ${name}`);
      },
    };
    const libre = await resolverRutaFamilia64Alta(db, {
      persona_id: "per_01TESTPERSONAXXXXXXXXXXXXXX",
      articulo_id: ARTICULO_64A_ETAPA1_ID,
      fecha_desde: "2026-07-20",
      tope_mes: 1,
    });
    assert.equal(libre.ok, true);
    assert.equal(libre.modalidad, "con_goce");
    assert.equal(libre.redirigido, false);
    assert.equal(libre.articulo_id, ARTICULO_64A_ETAPA1_ID);
  });
});
