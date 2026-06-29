"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  clasificarSolicitudMedicaAuditor,
  diasCorridosInclusive,
} = require("../modules/shared/clasificarSolicitudMedicaAuditorCore");

describe("diasCorridosInclusive", () => {
  it("cuenta días corridos", () => {
    assert.equal(diasCorridosInclusive("2026-06-10", "2026-06-12"), 3);
  });
});

describe("clasificarSolicitudMedicaAuditor", () => {
  it("rechaza aviso incompleto", async () => {
    const db = {
      collection() {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    schema_version: "SOL_MED_AVISO_V1",
                    estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
                    titular_persona_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
                    ingreso_medico: { es_licencia_incompleta: true, adjuntos: [] },
                  }),
                };
              },
            };
          },
        };
      },
    };
    const r = await clasificarSolicitudMedicaAuditor(db, {
      solicitudId: "sol_01KQN9WXFXF69Z9DCT5YNJ3TS0",
      auditorPersonaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      articuloId: "art_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      versionIdAplicada: "ver_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      fechaDesde: "2026-06-10",
      fechaHasta: "2026-06-12",
      dictamenFavorable: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "AVISO_INCOMPLETO");
  });
});
