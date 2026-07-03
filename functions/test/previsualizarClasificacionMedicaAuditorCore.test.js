"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  previsualizarClasificacionMedicaAuditor,
} = require("../modules/shared/previsualizarClasificacionMedicaAuditorCore");
const {
  CFG_MLM_CORTA_ANUAL,
  CFG_MLM_LARGA_EPISODIO,
} = require("../modules/shared/licenciaMedicaTramosCore");

const PER = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const ART14 = "art_01KWH4NM0BW4HKGGWV1NFD599K";
const VER14 = "ver_01KWH4NM0CZWTQQMHKKPGBNRDP";
const SOL_PEND = "sol_01TEST_PENDIENTE_PREVIEW";

const versionCorta = {
  bloque_identidad_naturaleza: {
    es_licencia_medica: true,
    modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
    visualizacion: { codigo_grilla: "LM" },
  },
};

const versionLarga = {
  bloque_identidad_naturaleza: {
    es_licencia_medica: true,
    modo_licencia_medica_id: CFG_MLM_LARGA_EPISODIO,
    visualizacion: { codigo_grilla: "LM-L" },
  },
};

const historialRows = [
  {
    id: "sol_013EE8A16E710808627AC4DBA2",
    data: {
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_aprobada",
      fecha_desde: "2026-06-10",
      fecha_hasta: "2026-06-27",
      articulo_id: ART14,
      licencia_medica: {
        modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
        dias_solicitud_total: 18,
      },
    },
  },
  {
    id: "sol_01KW9RZAH9ZP3MXMSNYPC1CYS6",
    data: {
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_aprobada",
      fecha_desde: "2026-07-01",
      fecha_hasta: "2026-07-01",
      articulo_id: ART14,
      licencia_medica: {
        modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
        dias_solicitud_total: 1,
      },
    },
  },
];

/** @param {{ pendiente?: Record<string, unknown>, versionData?: Record<string, unknown> }} opts */
function mockDb(opts = {}) {
  const pendiente = opts.pendiente || {
    schema_version: "SOL_MED_AVISO_V1",
    estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
    titular_persona_id: PER,
    ingreso_medico: { es_licencia_incompleta: false },
    fecha_inicio_reposo_estimada: "2026-08-02",
    fecha_fin_reposo_estimada: "2026-08-10",
    articulo_id: ART14,
    version_id_aplicada: VER14,
  };
  const versionData = opts.versionData || versionCorta;

  return {
    collection(name) {
      if (name === "solicitudes_articulo") {
        const filters = [];
        const chain = {
          where(field, _op, value) {
            filters.push([field, value]);
            return chain;
          },
          async get() {
            const docs = historialRows.filter((row) =>
              filters.every(([field, value]) => row.data[field] === value),
            );
            return {
              docs: docs.map((row) => ({ id: row.id, data: () => row.data })),
            };
          },
          doc(id) {
            return {
              async get() {
                if (id === SOL_PEND) {
                  return { exists: true, data: () => pendiente };
                }
                return { exists: false, data: () => ({}) };
              },
            };
          },
        };
        return chain;
      }
      if (name === "cfg_articulos") {
        return {
          doc(id) {
            return {
              async get() {
                if (id !== ART14) return { exists: false, data: () => ({}) };
                return { exists: true, data: () => ({ codigo: "14", nombre: "ENFERMEDAD DE CORTA DURACION" }) };
              },
              collection(sub) {
                if (sub !== "versiones") throw new Error(sub);
                return {
                  doc(verId) {
                    return {
                      async get() {
                        if (verId !== VER14) return { exists: false, data: () => ({}) };
                        return { exists: true, data: () => versionData };
                      },
                    };
                  },
                };
              },
            };
          },
          where() {
            return { limit: () => ({ async get() { return { docs: [] }; } }) };
          },
          limit() {
            return { async get() { return { docs: [] }; } };
          },
        };
      }
      throw new Error(`colección no mockeada: ${name}`);
    },
  };
}

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
                    titular_persona_id: PER,
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

  it("inyecta historial_consumo_corta en modo corta_anual", async () => {
    const r = await previsualizarClasificacionMedicaAuditor(mockDb(), {
      solicitudId: SOL_PEND,
    });
    assert.equal(r.ok, true);
    assert.equal(r.modo_preview, "corta_anual");
    assert.equal(r.historial_consumo_corta.length, 2);
    assert.equal(r.historial_consumo_corta[0].sol_id, "sol_013EE8A16E710808627AC4DBA2");
    assert.equal(r.historial_consumo_corta[0].dias, 18);
    assert.equal(r.preview.dias_acumulados_previos, 19);
    assert.ok(!r.historial_consumo_corta.some((row) => row.sol_id === SOL_PEND));
  });

  it("retorna historial_consumo_corta vacío en modo larga_episodio", async () => {
    const r = await previsualizarClasificacionMedicaAuditor(
      mockDb({
        versionData: versionLarga,
        pendiente: {
          schema_version: "SOL_MED_AVISO_V1",
          estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
          titular_persona_id: PER,
          ingreso_medico: { es_licencia_incompleta: false },
          fecha_inicio_reposo_estimada: "2026-08-02",
          fecha_fin_reposo_estimada: "2026-08-10",
          articulo_id: ART14,
          version_id_aplicada: VER14,
          cie10: { codigo: "J06.9", descripcion: "IRA" },
          causal_larga_duracion_id: "cfg_cld_enfermedad",
        },
      }),
      { solicitudId: SOL_PEND, articuloId: ART14, versionIdAplicada: VER14 },
    );
    assert.equal(r.ok, true);
    assert.equal(r.modo_preview, "larga_episodio");
    assert.deepEqual(r.historial_consumo_corta, []);
  });
});
