"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { actualizarAvisoMedicoIncompleto } = require("../modules/shared/avisoMedicoCajaNegraCore");

function makeDb(docData) {
  const store = { ...docData };
  return {
    collection(name) {
      if (name !== "solicitudes_articulo") throw new Error("unexpected collection");
      return {
        doc(id) {
          return {
            async get() {
              if (!store[id]) return { exists: false };
              return { exists: true, data: () => store[id], id };
            },
            async update(patch) {
              if (!store[id]) throw new Error("missing");
              const cur = store[id];
              if (patch.ingreso_medico) {
                cur.ingreso_medico = patch.ingreso_medico;
              }
              if (patch.fecha_inicio_reposo_estimada) {
                cur.fecha_inicio_reposo_estimada = patch.fecha_inicio_reposo_estimada;
              }
            },
          };
        },
      };
    },
  };
}

describe("actualizarAvisoMedicoIncompleto", () => {
  const vencFuture = {
    toDate() {
      return new Date(Date.now() + 60_000);
    },
  };

  it("rechaza si venció el plazo", async () => {
    const db = makeDb({
      sol_01KQN9WXFXF69Z9DCT5YNJ3TS0: {
        titular_persona_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
        schema_version: "SOL_MED_AVISO_V1",
        ingreso_medico: { es_licencia_incompleta: true, adjuntos: [] },
        vencimiento_plazo_certificado: {
          toDate() {
            return new Date(Date.now() - 1000);
          },
        },
      },
    });
    const r = await actualizarAvisoMedicoIncompleto(db, {
      solicitudId: "sol_01KQN9WXFXF69Z9DCT5YNJ3TS0",
      titularPersonaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      adjuntos: [{ storage_path: "avisos-med/x.pdf" }],
    });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "LICENCIA_INCOMPLETA_VENCIDA");
  });

  it("completa aviso vigente", async () => {
    const db = makeDb({
      sol_01KQN9WXFXF69Z9DCT5YNJ3TS0: {
        titular_persona_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
        schema_version: "SOL_MED_AVISO_V1",
        ingreso_medico: { modo: "caja_negra", es_licencia_incompleta: true, adjuntos: [] },
        vencimiento_plazo_certificado: vencFuture,
      },
    });
    const r = await actualizarAvisoMedicoIncompleto(db, {
      solicitudId: "sol_01KQN9WXFXF69Z9DCT5YNJ3TS0",
      titularPersonaId: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
      adjuntos: [{ storage_path: "avisos-med/x.pdf" }],
      fechaInicioReposoEstimada: "2026-06-25",
    });
    assert.equal(r.ok, true);
    assert.equal(r.estado_solicitud_id, "cfg_esa_pendiente_clasificacion_medica");
  });
});
