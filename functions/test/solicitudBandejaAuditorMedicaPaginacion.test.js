"use strict";

/**
 * node --test functions/test/solicitudBandejaAuditorMedicaPaginacion.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { SCHEMA_MED_AVISO } = require("../modules/shared/avisoMedicoCajaNegraCore");
const {
  encodeAuditorBandejaCursor,
  parseAuditorBandejaCursor,
  escanearBandejaAuditorPaginada,
  ORDER_FIELD,
} = require("../modules/shared/solicitudBandejaAuditorPaginacionCore");
const {
  listarSolicitudesBandejaAuditorMedica,
} = require("../modules/shared/solicitudBandejaAuditorMedicaCore");

const EST_PEND = "cfg_esa_pendiente_clasificacion_medica";
const PER_A = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const PER_B = "per_OTRA_PERSONA_001";

/**
 * @param {Array<{ id: string, data: Record<string, unknown> }>} rows
 * @param {Record<string, { label?: string, dni?: string }>} personas
 */
function mockDb(rows, personas = {}) {
  return {
    collection(name) {
      if (name === "personas") {
        return {
          where(field, _op, value) {
            return {
              limit() {
                return {
                  async get() {
                    const docs = Object.entries(personas)
                      .filter(([, p]) => p.dni === value)
                      .map(([id, p]) => ({
                        id,
                        data: () => ({ dni: p.dni, apellido: p.label, nombre: "" }),
                      }));
                    return { docs };
                  },
                };
              },
            };
          },
          doc(id) {
            const p = personas[id];
            return {
              async get() {
                return {
                  exists: Boolean(p),
                  data: () =>
                    p
                      ? { dni: p.dni, apellido: p.label, nombre: "" }
                      : {},
                };
              },
            };
          },
        };
      }
      if (name === "cfg_articulos") {
        return {
          doc() {
            return {
              async get() {
                return { exists: false, data: () => ({}) };
              },
            };
          },
        };
      }
      if (name !== "solicitudes_articulo") throw new Error(`colección no mockeada: ${name}`);

      const filters = [];
      const order = [];
      let startAfterValues = null;
      let lim = Infinity;

      const apply = () => {
        let list = rows.map((r) => ({ id: r.id, data: { ...r.data } }));
        for (const [field, value] of filters) {
          if (field === "titular_persona_id" && Array.isArray(value)) {
            list = list.filter((r) => value.includes(r.data.titular_persona_id));
          } else {
            list = list.filter((r) => r.data[field] === value);
          }
        }
        for (const [field, dir] of order) {
          if (field === "__name__") {
            list.sort((a, b) => (dir === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)));
          } else {
            list.sort((a, b) => {
              const av = String(a.data[field] || "");
              const bv = String(b.data[field] || "");
              if (av !== bv) return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
              return a.id.localeCompare(b.id);
            });
          }
        }
        if (startAfterValues) {
          const [fYmd, docId] = startAfterValues;
          const idx = list.findIndex(
            (r) =>
              String(r.data[ORDER_FIELD] || "") === fYmd && (docId ? r.id === docId : true),
          );
          list = idx >= 0 ? list.slice(idx + 1) : list;
        }
        if (Number.isFinite(lim)) list = list.slice(0, lim);
        return list;
      };

      const chain = {
        where(field, _op, value) {
          if (field === "titular_persona_id" && _op === "in") {
            filters.push([field, value]);
          } else {
            filters.push([field, value]);
          }
          return chain;
        },
        orderBy(field, dir = "asc") {
          order.push([field === "__name__" ? "__name__" : field, dir]);
          return chain;
        },
        startAfter(...values) {
          startAfterValues = values;
          return chain;
        },
        limit(n) {
          lim = n;
          return chain;
        },
        async get() {
          const list = apply();
          return {
            docs: list.map((r) => ({
              id: r.id,
              data: () => r.data,
            })),
          };
        },
      };
      return chain;
    },
  };
}

/** @param {number} i */
function solRow(i, titular = PER_A) {
  const day = String(i).padStart(2, "0");
  return {
    id: `sol_PAG_${String(i).padStart(3, "0")}`,
    data: {
      schema_version: SCHEMA_MED_AVISO,
      titular_persona_id: titular,
      estado_solicitud_id: EST_PEND,
      fecha_inicio_reposo_estimada: `2026-07-${day}`,
      fecha_fin_reposo_estimada: `2026-07-${day}`,
      ingreso_medico: { es_licencia_incompleta: false },
    },
  };
}

describe("solicitudBandejaAuditorPaginacionCore", () => {
  it("codifica y parsea cursor compuesto", () => {
    const c = encodeAuditorBandejaCursor("2026-07-15", "sol_ABC");
    assert.equal(c, "2026-07-15|sol_ABC");
    const p = parseAuditorBandejaCursor(c);
    assert.deepEqual(p, { fecha_ymd: "2026-07-15", solicitud_id: "sol_ABC" });
  });

  it("pagina listado general sin techo 400", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => solRow(i + 1));
    rows.push({
      id: "sol_NO_LM",
      data: {
        schema_version: "patron_b_v2",
        titular_persona_id: PER_A,
        estado_solicitud_id: EST_PEND,
        fecha_inicio_reposo_estimada: "2026-07-99",
      },
    });

    const db = mockDb(rows, { [PER_A]: { label: "MOSTO", dni: "28914247" } });

    const p1 = await listarSolicitudesBandejaAuditorMedica(db, {
      filtro_vista: "completas",
      page_size: 10,
    });
    assert.equal(p1.solicitudes.length, 10);
    assert.equal(p1.page_info.has_more, true);
    assert.ok(p1.page_info.next_cursor);

    const p2 = await listarSolicitudesBandejaAuditorMedica(db, {
      filtro_vista: "completas",
      page_size: 10,
      cursor: p1.page_info.next_cursor,
    });
    assert.equal(p2.solicitudes.length, 10);
    assert.equal(p2.page_info.has_more, true);

    const p3 = await listarSolicitudesBandejaAuditorMedica(db, {
      filtro_vista: "completas",
      page_size: 10,
      cursor: p2.page_info.next_cursor,
    });
    assert.equal(p3.solicitudes.length, 5);
    assert.equal(p3.page_info.has_more, false);
    assert.equal(p1.solicitudes[0].solicitud_id, "sol_PAG_001");
    assert.equal(p3.solicitudes[4].solicitud_id, "sol_PAG_025");
  });

  it("path DNI usa titular y no mezcla otras personas", async () => {
    const rows = [
      solRow(1, PER_A),
      solRow(2, PER_B),
      solRow(3, PER_A),
    ];
    const db = mockDb(rows, {
      [PER_A]: { label: "MOSTO", dni: "28914247" },
      [PER_B]: { label: "OTRO", dni: "11111111" },
    });

    const r = await listarSolicitudesBandejaAuditorMedica(db, {
      dni: "28914247",
      filtro_vista: "todas",
      page_size: 10,
    });
    assert.equal(r.solicitudes.length, 2);
    assert.ok(r.solicitudes.every((s) => s.titular_persona_id === PER_A));
  });

  it("escanear marca exhausted cuando no hay más docs", async () => {
    const rows = [solRow(1), solRow(2)];
    const db = mockDb(rows);
    const r = await escanearBandejaAuditorPaginada(db, {
      estadoPendiente: EST_PEND,
      titularIds: null,
      cursor: "",
      pageSize: 10,
      mapDoc: async (doc) => ({ solicitud_id: doc.id, fecha_desde: doc.data()[ORDER_FIELD] }),
    });
    assert.equal(r.items.length, 2);
    assert.equal(r.has_more, false);
  });
});
