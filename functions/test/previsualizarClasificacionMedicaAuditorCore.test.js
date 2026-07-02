"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  previsualizarClasificacionMedicaAuditor,
} = require("../modules/shared/previsualizarClasificacionMedicaAuditorCore");

describe("previsualizarClasificacionMedicaAuditor", () => {
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
                    fecha_inicio_reposo_estimada: "2026-08-02",
                    fecha_fin_reposo_estimada: "2026-08-05",
                  }),
                };
              },
            };
          },
        };
      },
    };
    const r = await previsualizarClasificacionMedicaAuditor(db, {
      solicitudId: "sol_01KQN9WXFXF69Z9DCT5YNJ3TS0",
    });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "AVISO_INCOMPLETO");
  });
});
