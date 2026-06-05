"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizarDiasVisGso,
  sanitizarVistaGrillaMesAgenteGso,
} = require("../modules/asistencia/grillaVisSanitizeGso.js");

describe("grillaVisSanitizeGso (UX-6)", () => {
  it("elimina fichadas_reales y capa_realidad de celdas vis", () => {
    const dias = sanitizarDiasVisGso({
      "09": {
        rda_ingreso: "06:00",
        fichadas_esperadas: 2,
        fichadas_reales: [{ hora: "06:05" }],
        fichadas: [{ tipo: "ingreso" }],
        capa_realidad: { ok: true },
        divergencias: [{ codigo: "X" }],
      },
    });
    assert.equal(dias["09"].fichadas_esperadas, 2);
    assert.equal(dias["09"].rda_ingreso, "06:00");
    assert.equal("fichadas_reales" in dias["09"], false);
    assert.equal("fichadas" in dias["09"], false);
    assert.equal("capa_realidad" in dias["09"], false);
    assert.equal("divergencias" in dias["09"], false);
  });

  it("preserva metadata de vista", () => {
    const v = sanitizarVistaGrillaMesAgenteGso({
      ok: true,
      vis_id: "vis_2026_06_per_x_gdt_y",
      dias: { "01": { fichadas_reales: [] } },
    });
    assert.equal(v.vis_id, "vis_2026_06_per_x_gdt_y");
    assert.equal("fichadas_reales" in v.dias["01"], false);
  });
});
