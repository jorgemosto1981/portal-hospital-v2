"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  listarPasesGdtPendientesTcRrhhCore,
  listarPasesGdtPendientesTcJefeCore,
  ordenarItems,
  paginarItems,
  parseListOpts,
} = require("../modules/organizacion/listarPasesGdtPendientesTcCore");

/**
 * @param {Array<{ id: string, data: () => Record<string, unknown> }>} docs
 */
function makeDb(docs) {
  return {
    collection(name) {
      if (name === "sol_pases_gdt") {
        return {
          where() {
            return {
              limit() {
                return {
                  async get() {
                    return { docs };
                  },
                };
              },
            };
          },
        };
      }
      if (name === "personas") {
        return {
          doc(id) {
            return { id, path: `personas/${id}` };
          },
        };
      }
      if (name === "grupos_de_trabajo") {
        return {
          doc(id) {
            return {
              async get() {
                return {
                  exists: true,
                  id,
                  data: () => ({ nombre: `Grupo ${id}`, activo: true }),
                };
              },
            };
          },
        };
      }
      return {
        doc(id) {
          return {
            async get() {
              return { exists: false, id };
            },
          };
        },
      };
    },
    async getAll(...refs) {
      return refs.map((ref) => ({
        exists: true,
        id: ref.id,
        data: () => {
          if (String(ref.id).includes("ZETA")) {
            return { apellido: "Zeta", nombre: "Ana", dni: "1" };
          }
          if (String(ref.id).includes("ALFA")) {
            return { apellido: "Alfa", nombre: "Bea", dni: "2" };
          }
          return { apellido: "Test", nombre: "Agente", dni: "123" };
        },
      }));
    },
  };
}

describe("parseListOpts / paginarItems / ordenarItems", () => {
  it("defaults page_size 10 y orden creado_en desc", () => {
    const o = parseListOpts({});
    assert.equal(o.pageSize, 10);
    assert.equal(o.orden, "creado_en");
    assert.equal(o.direccion, "desc");
    assert.equal(o.vista, "pendiente");
  });

  it("pagina de a 10", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ pase_id: `spg_${i}` }));
    const p1 = paginarItems(items, 1, 10);
    assert.equal(p1.items.length, 10);
    assert.equal(p1.total, 25);
    assert.equal(p1.total_pages, 3);
    assert.equal(p1.has_next, true);
    const p3 = paginarItems(items, 3, 10);
    assert.equal(p3.items.length, 5);
    assert.equal(p3.has_next, false);
  });

  it("ordena por agente", () => {
    const sorted = ordenarItems(
      [
        { pase_id: "b", agente_sort: "zeta, ana", creado_en_ms: 1 },
        { pase_id: "a", agente_sort: "alfa, bea", creado_en_ms: 2 },
      ],
      "agente",
      "asc",
    );
    assert.equal(sorted[0].pase_id, "a");
  });
});

describe("listarPasesGdtPendientesTcJefeCore", () => {
  it("exige persona del actor", async () => {
    const r = await listarPasesGdtPendientesTcJefeCore(/** @type {any} */ (null), {
      actorPersonaId: "",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "permission-denied");
  });

  it("lista pendientes donde el actor está pendiente", async () => {
    const docs = [
      {
        id: "spg_01JEFE00000000000000000000",
        data: () => ({
          estado: "APROBADO_INTERNO",
          requiere_conocimiento_rrhh: true,
          agente_persona_id: "per_01TESTAGENTE0000000000000",
          gdt_origen_id: "gdt_01ORIGEN00000000000000000",
          gdt_destino_id: "gdt_01DEST000000000000000000",
          motivo: "pase",
          fecha_efectiva: "2026-07-24",
          jefes_pendientes_conocimiento_ids: ["per_01TESTJEFE000000000000000"],
          jefes_acuses_ids: [],
        }),
      },
    ];
    const r = await listarPasesGdtPendientesTcJefeCore(/** @type {any} */ (makeDb(docs)), {
      actorPersonaId: "per_01TESTJEFE000000000000000",
      vista: "pendiente",
      pageSize: 10,
    });
    assert.equal(r.ok, true);
    assert.equal(r.total, 1);
    assert.equal(r.page_size, 10);
  });

  it("lista histórico por jefes_acuses_ids", async () => {
    const docs = [
      {
        id: "spg_01HIST00000000000000000000",
        data: () => ({
          estado: "APROBADO_INTERNO",
          requiere_conocimiento_rrhh: true,
          agente_persona_id: "per_01TESTAGENTE0000000000000",
          gdt_origen_id: "gdt_01ORIGEN00000000000000000",
          motivo: "pase",
          fecha_efectiva: "2026-07-24",
          jefes_pendientes_conocimiento_ids: [],
          jefes_acuses_ids: ["per_01TESTJEFE000000000000000"],
          jefes_acuses: {
            per_01TESTJEFE000000000000000: { en: { toMillis: () => 1_700_000_000_000 }, por: "per_01TESTJEFE000000000000000" },
          },
        }),
      },
    ];
    const r = await listarPasesGdtPendientesTcJefeCore(/** @type {any} */ (makeDb(docs)), {
      actorPersonaId: "per_01TESTJEFE000000000000000",
      vista: "historico",
    });
    assert.equal(r.ok, true);
    assert.equal(r.total, 1);
    assert.equal(r.items[0].pase_id, "spg_01HIST00000000000000000000");
    assert.ok(r.items[0].jefe_toma_conocimiento_en_ms);
  });
});

describe("listarPasesGdtPendientesTcRrhhCore", () => {
  it("histórico solo con acuse RRHH", async () => {
    const docs = [
      {
        id: "spg_01KEEP00000000000000000000",
        data: () => ({
          estado: "APROBADO_INTERNO",
          requiere_conocimiento_rrhh: true,
          rrhh_toma_conocimiento_en: { toMillis: () => 9 },
          rrhh_toma_conocimiento_por: "per_01TESTRRHH000000000000000",
          agente_persona_id: "per_01TESTAGENTE0000000000000",
          gdt_origen_id: "gdt_01ORIGEN00000000000000000",
          motivo: "acusado",
          fecha_efectiva: "2026-07-24",
          jefes_pendientes_conocimiento_ids: [],
        }),
      },
      {
        id: "spg_01SKIP00000000000000000000",
        data: () => ({
          estado: "APROBADO_INTERNO",
          requiere_conocimiento_rrhh: true,
          rrhh_toma_conocimiento_en: null,
          agente_persona_id: "per_01TESTAGENTE0000000000000",
          gdt_origen_id: "gdt_01ORIGEN00000000000000000",
          motivo: "pendiente",
          fecha_efectiva: "2026-07-20",
          jefes_pendientes_conocimiento_ids: [],
        }),
      },
    ];
    const r = await listarPasesGdtPendientesTcRrhhCore(/** @type {any} */ (makeDb(docs)), {
      vista: "historico",
      pageSize: 10,
    });
    assert.equal(r.ok, true);
    assert.equal(r.total, 1);
    assert.equal(r.items[0].pase_id, "spg_01KEEP00000000000000000000");
  });

  it("pendiente omite ya acusados", async () => {
    const docs = [
      {
        id: "spg_01KEEP00000000000000000000",
        data: () => ({
          estado: "APROBADO_INTERNO",
          requiere_conocimiento_rrhh: true,
          rrhh_toma_conocimiento_en: null,
          agente_persona_id: "per_01TESTAGENTE0000000000000",
          gdt_origen_id: "gdt_01ORIGEN00000000000000000",
          motivo: "pase",
          fecha_efectiva: "2026-07-24",
          jefes_pendientes_conocimiento_ids: [],
        }),
      },
      {
        id: "spg_01SKIP00000000000000000000",
        data: () => ({
          estado: "APROBADO_INTERNO",
          requiere_conocimiento_rrhh: true,
          rrhh_toma_conocimiento_en: { toMillis: () => 1 },
          agente_persona_id: "per_01TESTAGENTE0000000000000",
          gdt_origen_id: "gdt_01ORIGEN00000000000000000",
          motivo: "ya acusó",
          fecha_efectiva: "2026-07-20",
          jefes_pendientes_conocimiento_ids: [],
        }),
      },
    ];
    const r = await listarPasesGdtPendientesTcRrhhCore(/** @type {any} */ (makeDb(docs)), {
      vista: "pendiente",
    });
    assert.equal(r.ok, true);
    assert.equal(r.total, 1);
    assert.equal(r.items[0].pase_id, "spg_01KEEP00000000000000000000");
  });
});
