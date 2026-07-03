"use strict";

/**
 * node --test functions/test/licenciaMedicaConsumoCortaAnual.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  sumarConsumoCortaAnualAprobado,
  listarHistorialConsumoCortaAnualAprobado,
} = require("../modules/shared/licenciaMedicaConsumoCortaAnual");
const { CFG_MLM_CORTA_ANUAL } = require("../modules/shared/licenciaMedicaTramosCore");

const PER = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const ART14 = "art_01KWH4NM0BW4HKGGWV1NFD599K";

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

const filasPiloto2026 = [
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
  {
    id: "sol_PENDIENTE",
    data: {
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
      fecha_desde: "2026-08-01",
      fecha_hasta: "2026-08-10",
      licencia_medica: {
        modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
        dias_solicitud_total: 10,
      },
    },
  },
  {
    id: "sol_LARGA",
    data: {
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_aprobada",
      fecha_desde: "2026-05-01",
      fecha_hasta: "2026-06-01",
      licencia_medica: {
        modo_licencia_medica_id: "cfg_mlm_larga_episodio",
        dias_solicitud_total: 32,
      },
    },
  },
  {
    id: "sol_OTRO_ANIO",
    data: {
      titular_persona_id: PER,
      estado_solicitud_id: "cfg_esa_aprobada",
      fecha_desde: "2025-12-20",
      fecha_hasta: "2025-12-25",
      licencia_medica: {
        modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
        dias_solicitud_total: 6,
      },
    },
  },
];

describe("listarHistorialConsumoCortaAnualAprobado", () => {
  it("devuelve filas ordenadas por fecha_desde con codigo_grilla", async () => {
    const db = mockDb(filasPiloto2026, {
      [ART14]: { codigo: "14", nombre: "ENFERMEDAD DE CORTA DURACION" },
    });
    const rows = await listarHistorialConsumoCortaAnualAprobado(db, {
      titular_persona_id: PER,
      anio_calendario: 2026,
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].sol_id, "sol_013EE8A16E710808627AC4DBA2");
    assert.equal(rows[0].dias, 18);
    assert.equal(rows[0].codigo_grilla, "14");
    assert.equal(rows[1].sol_id, "sol_01KW9RZAH9ZP3MXMSNYPC1CYS6");
    assert.equal(rows[1].dias, 1);
  });

  it("excluye solicitud_id si se pasa excluir_solicitud_id", async () => {
    const db = mockDb(filasPiloto2026, {
      [ART14]: { codigo: "14", nombre: "ENFERMEDAD DE CORTA DURACION" },
    });
    const rows = await listarHistorialConsumoCortaAnualAprobado(db, {
      titular_persona_id: PER,
      anio_calendario: 2026,
      excluir_solicitud_id: "sol_013EE8A16E710808627AC4DBA2",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sol_id, "sol_01KW9RZAH9ZP3MXMSNYPC1CYS6");
  });

  it("retorna [] con parámetros inválidos", async () => {
    const db = mockDb(filasPiloto2026);
    assert.deepEqual(
      await listarHistorialConsumoCortaAnualAprobado(db, {
        titular_persona_id: "",
        anio_calendario: 2026,
      }),
      [],
    );
  });
});

describe("sumarConsumoCortaAnualAprobado", () => {
  it("coincide con la suma del historial", async () => {
    const db = mockDb(filasPiloto2026, {
      [ART14]: { codigo: "14", nombre: "ENFERMEDAD DE CORTA DURACION" },
    });
    const historial = await listarHistorialConsumoCortaAnualAprobado(db, {
      titular_persona_id: PER,
      anio_calendario: 2026,
    });
    const total = await sumarConsumoCortaAnualAprobado(db, {
      titular_persona_id: PER,
      anio_calendario: 2026,
    });
    assert.equal(total, 19);
    assert.equal(
      historial.reduce((acc, row) => acc + row.dias, 0),
      total,
    );
  });
});
