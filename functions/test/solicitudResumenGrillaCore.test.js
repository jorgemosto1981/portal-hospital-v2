"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { resolveMedAvisoArtDisplay } = require("../modules/shared/solicitudResumenGrillaCore");

describe("resolveMedAvisoArtDisplay", () => {
  it("aprobada con articulo_id usa ficha Art. 14", async () => {
    const artCache = new Map();
    const db = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({
              codigo: "14",
              nombre: "ENFERMEDAD DE CORTA DURACION",
            }),
          }),
        }),
      }),
    };
    const row = await resolveMedAvisoArtDisplay(
      db,
      {
        schema_version: "SOL_MED_AVISO_V1",
        estado_solicitud_id: "cfg_esa_aprobada",
        articulo_id: "art_test",
        ingreso_medico: { es_licencia_incompleta: false },
      },
      artCache,
    );
    assert.match(row.articulo_label, /14/);
    assert.equal(row.articulo_label.includes("pendiente clasificación"), false);
    assert.equal(row.codigo_grilla, "14");
  });
});
