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
  listarHuecosTurnoEnAgentes,
} = require("../modules/asistencia/validacionesPlanTurno.js");

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
    assert.equal(listarHuecosTurnoEnAgentes(agentes).length, 1);
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
    assert.equal(listarHuecosTurnoEnAgentes(agentes).length, 0);
    assert.doesNotThrow(() => assertPlanSinHuecosTurno(agentes));
  });
});
