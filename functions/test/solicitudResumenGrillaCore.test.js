"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { resolveMedAvisoArtDisplay, obtenerResumenSolicitudArticuloGrilla } = require("../modules/shared/solicitudResumenGrillaCore");

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

describe("obtenerResumenSolicitudArticuloGrilla — P2b fechas efectivas", () => {
  it("aprobada con dictamen acortado expone rango efectivo y original del agente", async () => {
    const db = {
      collection: (name) => ({
        doc: (id) => ({
          get: async () => {
            if (name === "solicitudes_articulo" && id === "sol_01KWKVW4SED7ETGKPDMB61ES8Q") {
              return {
                exists: true,
                data: () => ({
                  schema_version: "SOL_MED_AVISO_V1",
                  estado_solicitud_id: "cfg_esa_aprobada",
                  titular_persona_id: "per_titular",
                  articulo_id: "art_test",
                  fecha_desde: "2026-07-20",
                  fecha_hasta: "2026-07-21",
                  dias_solicitados: 2,
                  fecha_inicio_reposo_estimada: "2026-07-20",
                  fecha_fin_reposo_estimada: "2026-07-30",
                  ingreso_medico: { es_licencia_incompleta: false },
                  auditor_medico_clasificacion: {
                    fecha_desde: "2026-07-20",
                    fecha_hasta: "2026-07-21",
                    fechas_corregidas_por_auditor: true,
                  },
                }),
              };
            }
            if (name === "personas") {
              return { exists: true, data: () => ({ nombre: "Test", apellido: "Titular" }) };
            }
            return { exists: false, data: () => ({}) };
          },
        }),
      }),
    };

    const res = await obtenerResumenSolicitudArticuloGrilla(
      db,
      "sol_01KWKVW4SED7ETGKPDMB61ES8Q",
      "per_titular",
    );
    assert.equal(res.ok, true);
    assert.equal(res.fecha_desde, "2026-07-20");
    assert.equal(res.fecha_hasta, "2026-07-21");
    assert.equal(res.fecha_desde_original, "2026-07-20");
    assert.equal(res.fecha_hasta_original, "2026-07-30");
    assert.equal(res.fechas_corregidas_por_auditor, true);
    assert.equal(res.dias_solicitados, 2);
  });
});
