"use strict";

/**
 * Regresión US-9 (R1): laborable/guardia sin turno_id → PLT-US9-001
 * node --test functions/test/validacionesPlanTurno.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");
const {
  CODIGO_US9,
  assertPlanSinHuecosTurno,
  listarHuecosTurnoEnAgentes,
} = require("../modules/asistencia/validacionesPlanTurno");

function expectUs9(fn) {
  assert.throws(fn, (e) => {
    assert.ok(e instanceof HttpsError);
    assert.equal(e.code, "failed-precondition");
    assert.match(String(e.message), new RegExp(`\\[${CODIGO_US9}\\]`));
    return true;
  });
}

describe("assertPlanSinHuecosTurno (US-9)", () => {
  it("R1: laborable sin turno_id lanza PLT-US9-001", () => {
    const agentes = [
      {
        persona_id: "per_MOSTO",
        dias: {
          "2026-06-18": { tipo_dia: "laborable", turno_id: null, es_feriado: false },
        },
      },
    ];
    expectUs9(() => assertPlanSinHuecosTurno(agentes));
  });

  it("guardia sin turno_id lanza PLT-US9-001", () => {
    const agentes = [
      {
        persona_id: "per_A",
        dias: {
          "2026-06-01": { tipo_dia: "guardia", turno_id: "", es_feriado: false },
        },
      },
    ];
    expectUs9(() => assertPlanSinHuecosTurno(agentes));
  });

  it("laborable con turno_id válido no lanza", () => {
    const agentes = [
      {
        persona_id: "per_A",
        dias: {
          "2026-06-01": { tipo_dia: "laborable", turno_id: "turno_01", es_feriado: false },
        },
      },
    ];
    assert.doesNotThrow(() => assertPlanSinHuecosTurno(agentes));
  });

  it("franco sin turno_id no lanza", () => {
    const agentes = [
      {
        persona_id: "per_A",
        dias: {
          "2026-06-01": { tipo_dia: "franco", turno_id: null, es_feriado: false },
        },
      },
    ];
    assert.doesNotThrow(() => assertPlanSinHuecosTurno(agentes));
  });
});

describe("listarHuecosTurnoEnAgentes (US-17)", () => {
  it("lista todos los huecos sin detenerse en el primero", () => {
    const agentes = [
      {
        persona_id: "per_A",
        dias: {
          "2026-06-01": { tipo_dia: "laborable", turno_id: "M" },
          "2026-06-02": { tipo_dia: "laborable", turno_id: null },
          "2026-06-03": { tipo_dia: "guardia", turno_id: "" },
        },
      },
      {
        persona_id: "per_B",
        dias: {
          "2026-06-10": { tipo_dia: "franco", turno_id: null },
          "2026-06-11": { tipo_dia: "laborable", turno_id: null },
        },
      },
    ];
    const huecos = listarHuecosTurnoEnAgentes(agentes);
    assert.equal(huecos.length, 3);
    assert.deepEqual(huecos[0], {
      persona_id: "per_A",
      ymd: "2026-06-02",
      tipo_dia: "laborable",
    });
    assert.deepEqual(huecos[2], {
      persona_id: "per_B",
      ymd: "2026-06-11",
      tipo_dia: "laborable",
    });
  });

  it("plan sin huecos devuelve array vacío", () => {
    assert.deepEqual(
      listarHuecosTurnoEnAgentes([
        {
          persona_id: "per_OK",
          dias: { "2026-06-01": { tipo_dia: "laborable", turno_id: "T" } },
        },
      ]),
      [],
    );
  });

  it("assert US-9 y listar coinciden en el primer hueco", () => {
    const agentes = [
      {
        persona_id: "per_X",
        dias: { "2026-06-05": { tipo_dia: "laborable", turno_id: null } },
      },
    ];
    const huecos = listarHuecosTurnoEnAgentes(agentes);
    assert.equal(huecos.length, 1);
    expectUs9(() => assertPlanSinHuecosTurno(agentes));
  });
});
