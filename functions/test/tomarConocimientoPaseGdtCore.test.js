"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  estadoAdmiteTc,
  tomarConocimientoPaseGdtRrhhCore,
  tomarConocimientoPaseGdtJefeCore,
} = require("../modules/organizacion/tomarConocimientoPaseGdtCore");

describe("estadoAdmiteTc", () => {
  it("admite APROBADO_INTERNO y APROBADO", () => {
    assert.equal(estadoAdmiteTc("APROBADO_INTERNO"), true);
    assert.equal(estadoAdmiteTc("APROBADO"), true);
  });

  it("rechaza pendientes y rechazados", () => {
    assert.equal(estadoAdmiteTc("PENDIENTE_RRHH"), false);
    assert.equal(estadoAdmiteTc("RECHAZADO"), false);
  });
});

describe("tomarConocimientoPaseGdtRrhhCore", () => {
  it("valida pase_id sin Firestore", async () => {
    const r = await tomarConocimientoPaseGdtRrhhCore(/** @type {any} */ (null), {
      paseId: "malo",
      actorPersonaId: "per_01TESTRRHH000000000000000",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid-argument");
  });

  it("estampa TC cuando corresponde", async () => {
    /** @type {Record<string, unknown>} */
    let updated = {};
    const db = {
      collection() {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    estado: "APROBADO_INTERNO",
                    requiere_conocimiento_rrhh: true,
                    rrhh_toma_conocimiento_en: null,
                    agente_persona_id: "per_01TESTAGENTE0000000000000",
                  }),
                };
              },
              async update(patch) {
                updated = patch;
              },
            };
          },
        };
      },
    };

    const r = await tomarConocimientoPaseGdtRrhhCore(/** @type {any} */ (db), {
      paseId: "spg_01TESTPASE0000000000000000",
      actorPersonaId: "per_01TESTRRHH000000000000000",
    });
    assert.equal(r.ok, true);
    assert.equal(r.actor, "rrhh");
    assert.equal(updated.rrhh_toma_conocimiento_por, "per_01TESTRRHH000000000000000");
    assert.ok(updated.rrhh_toma_conocimiento_en);
  });

  it("idempotencia: ya acusó", async () => {
    const db = {
      collection() {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    estado: "APROBADO_INTERNO",
                    requiere_conocimiento_rrhh: true,
                    rrhh_toma_conocimiento_en: { seconds: 1 },
                    agente_persona_id: "per_01TESTAGENTE0000000000000",
                  }),
                };
              },
            };
          },
        };
      },
    };
    const r = await tomarConocimientoPaseGdtRrhhCore(/** @type {any} */ (db), {
      paseId: "spg_01TESTPASE0000000000000000",
      actorPersonaId: "per_01TESTRRHH000000000000000",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "failed-precondition");
    assert.match(String(r.message || ""), /ya fue registrada/i);
  });
});

describe("tomarConocimientoPaseGdtJefeCore", () => {
  it("exige estar en pendientes", async () => {
    const db = {
      collection() {
        return {
          doc() {
            return {
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    estado: "APROBADO_INTERNO",
                    jefes_pendientes_conocimiento_ids: ["per_01OTROJEFE000000000000000"],
                    jefes_acuses: {},
                  }),
                };
              },
            };
          },
        };
      },
      async runTransaction(fn) {
        return fn({
          async get(ref) {
            return ref.get();
          },
          update() {},
        });
      },
    };

    // El core usa runTransaction; el mock de doc necesita ser la misma ref.
    const paseDoc = {
      async get() {
        return {
          exists: true,
          data: () => ({
            estado: "APROBADO_INTERNO",
            jefes_pendientes_conocimiento_ids: ["per_01OTROJEFE000000000000000"],
            jefes_acuses: {},
          }),
        };
      },
    };
    const db2 = {
      collection() {
        return {
          doc() {
            return paseDoc;
          },
        };
      },
      async runTransaction(fn) {
        return fn({
          async get() {
            return paseDoc.get();
          },
          update() {},
        });
      },
    };

    const r = await tomarConocimientoPaseGdtJefeCore(/** @type {any} */ (db2), {
      paseId: "spg_01TESTPASE0000000000000000",
      actorPersonaId: "per_01TESTJEFE000000000000000",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "permission-denied");
    // silenciar unused
    void db;
  });

  it("mueve de pendientes a jefes_acuses", async () => {
    /** @type {Record<string, unknown>} */
    let updated = {};
    const paseDoc = {
      async get() {
        return {
          exists: true,
          data: () => ({
            estado: "APROBADO",
            jefes_pendientes_conocimiento_ids: [
              "per_01TESTJEFE000000000000000",
              "per_01OTROJEFE000000000000000",
            ],
            jefes_acuses: {},
          }),
        };
      },
    };
    const db = {
      collection() {
        return {
          doc() {
            return paseDoc;
          },
        };
      },
      async runTransaction(fn) {
        return fn({
          async get() {
            return paseDoc.get();
          },
          update(_ref, patch) {
            updated = patch;
          },
        });
      },
    };

    const r = await tomarConocimientoPaseGdtJefeCore(/** @type {any} */ (db), {
      paseId: "spg_01TESTPASE0000000000000000",
      actorPersonaId: "per_01TESTJEFE000000000000000",
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.jefes_pendientes_restantes, ["per_01OTROJEFE000000000000000"]);
    assert.deepEqual(updated.jefes_pendientes_conocimiento_ids, ["per_01OTROJEFE000000000000000"]);
    assert.ok(updated["jefes_acuses.per_01TESTJEFE000000000000000"]);
    assert.ok(updated.jefes_acuses_ids);
  });
});
