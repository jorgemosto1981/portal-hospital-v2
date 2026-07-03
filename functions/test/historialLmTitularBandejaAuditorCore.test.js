"use strict";

/**
 * node --test functions/test/historialLmTitularBandejaAuditorCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  obtenerHistorialLmTitularBandejaAuditor,
  categoriaEstadoHistorialLm,
} = require("../modules/shared/historialLmTitularBandejaAuditorCore");
const { SCHEMA_MED_AVISO } = require("../modules/shared/avisoMedicoCajaNegraCore");

const PER = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const ART14 = "art_01KWH4NM0BW4HKGGWV1NFD599K";
const SOL_ACTUAL = "sol_ACTUAL";

/** @param {Array<{ id: string, data: Record<string, unknown> }>} rows */
function mockDb(rows, articulos = {}) {
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
            const docs = rows.filter((row) =>
              filters.every(([field, value]) => row.data[field] === value),
            );
            return {
              docs: docs.map((row) => ({
                id: row.id,
                data: () => row.data,
              })),
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
                const core = articulos[id];
                return {
                  exists: Boolean(core),
                  data: () => core || {},
                };
              },
            };
          },
        };
      }
      throw new Error(`colección no mockeada: ${name}`);
    },
  };
}

const filas = [
  {
    id: "sol_APROB",
    data: {
      schema_version: SCHEMA_MED_AVISO,
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_aprobada",
      fecha_desde: "2026-05-01",
      fecha_hasta: "2026-05-10",
      articulo_id: ART14,
      creado_en: "2026-04-28T10:00:00.000Z",
      auditor_medico_clasificacion: {
        clasificado_en: "2026-04-29T12:00:00.000Z",
      },
    },
  },
  {
    id: "sol_RECH",
    data: {
      schema_version: SCHEMA_MED_AVISO,
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_rechazada",
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-05",
      articulo_id: ART14,
      creado_en: "2026-05-30T08:00:00.000Z",
      auditor_medico_clasificacion: {
        clasificado_en: "2026-05-31T09:00:00.000Z",
      },
    },
  },
  {
    id: "sol_JUNTA",
    data: {
      schema_version: SCHEMA_MED_AVISO,
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_esperando_dictamen_junta",
      fecha_desde: "2026-07-01",
      fecha_hasta: "2026-07-25",
      articulo_id: ART14,
      creado_en: "2026-06-28T08:00:00.000Z",
      auditor_medico_clasificacion: {
        clasificado_en: "2026-06-29T11:00:00.000Z",
      },
    },
  },
  {
    id: SOL_ACTUAL,
    data: {
      schema_version: SCHEMA_MED_AVISO,
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
      fecha_inicio_reposo_estimada: "2026-08-01",
      fecha_fin_reposo_estimada: "2026-08-05",
      articulo_id: ART14,
      creado_en: "2026-07-30T08:00:00.000Z",
    },
  },
  {
    id: "sol_PATRON_B",
    data: {
      schema_version: "patron_b_v2",
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_aprobada",
      fecha_desde: "2026-01-01",
      fecha_hasta: "2026-01-02",
      articulo_id: ART14,
      creado_en: "2026-01-01T08:00:00.000Z",
    },
  },
];

describe("historialLmTitularBandejaAuditorCore", () => {
  it("categoriza estados para badges UI", () => {
    assert.equal(categoriaEstadoHistorialLm("cfg_esa_aprobada"), "aprobada");
    assert.equal(categoriaEstadoHistorialLm("cfg_esa_rechazada"), "rechazada");
    assert.equal(categoriaEstadoHistorialLm("cfg_esa_esperando_dictamen_junta"), "junta");
  });

  it("excluye solicitud actual y patrones no LM", async () => {
    const db = mockDb(filas, {
      [ART14]: { codigo_grilla: "14", nombre: "Licencia médica" },
    });
    const r = await obtenerHistorialLmTitularBandejaAuditor(db, {
      titular_persona_id: PER,
      excluir_solicitud_id: SOL_ACTUAL,
    });
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 3);
    assert.equal(r.has_more, false);
    assert.ok(!r.items.some((row) => row.solicitud_id === SOL_ACTUAL));
    assert.equal(r.items[0].solicitud_id, "sol_JUNTA");
    assert.equal(r.items[0].estado_categoria, "junta");
    assert.equal(r.items[1].solicitud_id, "sol_RECH");
    assert.equal(r.items[2].solicitud_id, "sol_APROB");
  });

  it("marca has_more cuando hay más de 5 eventos", async () => {
    const extra = Array.from({ length: 4 }, (_, i) => ({
      id: `sol_EXTRA_${i}`,
      data: {
        schema_version: SCHEMA_MED_AVISO,
        titular_persona_id: PER,
        estado_solicitud_id: "cfg_esa_aprobada",
        fecha_desde: `2026-03-0${i + 1}`,
        fecha_hasta: `2026-03-0${i + 2}`,
        articulo_id: ART14,
        creado_en: `2026-03-0${i + 1}T08:00:00.000Z`,
        auditor_medico_clasificacion: {
          clasificado_en: `2026-03-0${i + 1}T10:00:00.000Z`,
        },
      },
    }));
    const db = mockDb([...filas, ...extra], {
      [ART14]: { codigo_grilla: "14", nombre: "Licencia médica" },
    });
    const r = await obtenerHistorialLmTitularBandejaAuditor(db, {
      titular_persona_id: PER,
      excluir_solicitud_id: SOL_ACTUAL,
    });
    assert.equal(r.ok, true);
    assert.equal(r.items.length, 5);
    assert.equal(r.has_more, true);
  });

  it("rechaza titular inválido", async () => {
    const db = mockDb([]);
    const r = await obtenerHistorialLmTitularBandejaAuditor(db, { titular_persona_id: "x" });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, "TITULAR_INVALIDO");
  });
});
