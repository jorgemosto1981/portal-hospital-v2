"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  buildMensajeConflictoSuperposicion,
  rangosYmdSeSolapan,
} = require("./patronBSuperposicionValidacion");

describe("patronBSuperposicionValidacion — mensaje agente", () => {
  it("solapa rangos YMD", () => {
    assert.equal(rangosYmdSeSolapan("2026-07-14", "2026-07-14", "2026-07-14", "2026-07-14"), true);
    assert.equal(rangosYmdSeSolapan("2026-07-10", "2026-07-12", "2026-07-13", "2026-07-15"), false);
  });

  it("enriquece mensaje con trámite y estado", async () => {
    const db = {
      collection() {
        return {
          doc() {
            return { get: async () => ({ exists: false }) };
          },
        };
      },
    };
    const msg = await buildMensajeConflictoSuperposicion(
      db,
      "sol_01TEST",
      {
        codigo_grilla: "64-A",
        fecha_desde: "2026-07-14",
        fecha_hasta: "2026-07-14",
        estado_solicitud_id: "cfg_esa_en_revision_jefe",
      },
    );
    assert.match(msg, /64-A/);
    assert.match(msg, /14-07-2026/);
    assert.match(msg, /Pendiente de autorización \(jefe\)/i);
    assert.match(msg, /Esperá la resolución/i);
  });
});
