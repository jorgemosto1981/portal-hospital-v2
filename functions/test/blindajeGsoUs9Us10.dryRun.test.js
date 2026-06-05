"use strict";

/**
 * Dry run E2E lógico: mismo payload que el editor (laborable sin turno_id)
 * → contador US-10 > 0 → assert US-9 rechaza con PLT-US9-001.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertPlanSinHuecosTurno,
  CODIGO_US9,
} = require("../modules/asistencia/validacionesPlanTurno.js");

function contarHuecosComoEditor(agentes) {
  let n = 0;
  for (const ag of agentes || []) {
    const dias = ag.dias && typeof ag.dias === "object" ? ag.dias : {};
    for (const cel of Object.values(dias)) {
      if (!cel || typeof cel !== "object") continue;
      const tipo = cel.tipo_dia;
      if (tipo !== "laborable" && tipo !== "guardia") continue;
      const tid = cel.turno_id;
      if (tid == null || String(tid).trim() === "") n += 1;
    }
  }
  return n;
}

describe("blindaje GSO dry run (US-10 → US-9)", () => {
  it("plan con hueco: banner contaría > 0 y habilitar rebota PLT-US9-001", () => {
    const agentes = [
      {
        persona_id: "per_ejemplo",
        dias: {
          "2026-06-01": { tipo_dia: "laborable", turno_id: "M" },
          "2026-06-02": { tipo_dia: "laborable", turno_id: null },
        },
      },
    ];
    assert.equal(contarHuecosComoEditor(agentes), 1);
    assert.throws(
      () => assertPlanSinHuecosTurno(agentes),
      (err) => {
        assert.match(String(err.message), new RegExp(CODIGO_US9));
        assert.match(String(err.message), /per_ejemplo/);
        assert.match(String(err.message), /2026-06-02/);
        return true;
      },
    );
  });

  it("plan completo: contador 0 y assert no lanza", () => {
    const agentes = [
      {
        persona_id: "per_ok",
        dias: {
          "2026-06-01": { tipo_dia: "laborable", turno_id: "T" },
          "2026-06-02": { tipo_dia: "franco", turno_id: null },
        },
      },
    ];
    assert.equal(contarHuecosComoEditor(agentes), 0);
    assert.doesNotThrow(() => assertPlanSinHuecosTurno(agentes));
  });
});
