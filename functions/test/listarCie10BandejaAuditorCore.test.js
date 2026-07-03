"use strict";

/**
 * node --test functions/test/listarCie10BandejaAuditorCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { listarCie10BandejaAuditor } = require("../modules/shared/listarCie10BandejaAuditorCore");

function mockDb(rows) {
  return {
    collection(name) {
      if (name !== "cfg_cie10") throw new Error(name);
      return {
        limit() {
          return {
            async get() {
              return {
                docs: rows.map((row) => ({
                  id: row.id,
                  data: () => row.data,
                })),
              };
            },
          };
        },
      };
    },
  };
}

describe("listarCie10BandejaAuditor", () => {
  it("devuelve ítems activos con código y título", async () => {
    const r = await listarCie10BandejaAuditor(
      mockDb([
        {
          id: "cfg_cie10_j06_9",
          data: {
            codigo_interno: "J06.9",
            titulo_ui: "Infección aguda VAS",
            orden: 20,
            activo: true,
          },
        },
        {
          id: "cfg_cie10_off",
          data: { codigo_interno: "Z99", titulo_ui: "Inactivo", activo: false },
        },
      ]),
    );
    assert.equal(r.total, 1);
    assert.equal(r.items[0].codigo_interno, "J06.9");
  });
});
