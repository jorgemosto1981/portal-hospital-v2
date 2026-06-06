"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  diaFueraVigenciaHlgPlan,
  sanitizarDiasPlanSegunVigenciaHlg,
} = require("../modules/asistencia/planVigenciaHlg");

describe("planVigenciaHlg", () => {
  const hlg = { fecha_inicio: "2026-06-11", fecha_fin: null };

  it("marca fuera de vigencia antes del inicio", () => {
    assert.equal(diaFueraVigenciaHlgPlan("2026-06-10", hlg), true);
    assert.equal(diaFueraVigenciaHlgPlan("2026-06-11", hlg), false);
  });

  it("convierte turnos previos al inicio en franco", () => {
    const dias = sanitizarDiasPlanSegunVigenciaHlg(
      {
        "2026-06-10": { tipo_dia: "laborable", turno_id: "tco_1" },
        "2026-06-11": { tipo_dia: "laborable", turno_id: "tco_2" },
      },
      hlg,
    );
    assert.equal(dias["2026-06-10"].tipo_dia, "franco");
    assert.equal(dias["2026-06-10"].turno_id, null);
    assert.equal(dias["2026-06-11"].turno_id, "tco_2");
  });
});
