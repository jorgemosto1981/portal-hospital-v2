"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  personaIdsEnPlan,
  detectarAgentesNuevosPlanificados,
  mergeAgentesIncorporacionPlanMensual,
  elegirPlanMensualCanonico,
  planHabilitadoDesdeQuerySnapshot,
} = require("../modules/asistencia/planGrupoAgentesNuevos");

describe("planGrupoAgentesNuevos", () => {
  it("personaIdsEnPlan extrae per_* del plan", () => {
    const ids = personaIdsEnPlan({
      agentes: [{ persona_id: "per_A" }, { persona_id: "per_B" }, { persona_id: "x" }],
    });
    assert.equal(ids.size, 2);
    assert.ok(ids.has("per_A"));
  });

  it("detecta tramo planificado no en plan por hlg_id", () => {
    const regimenes = { reg_plan: { tipo_patron: "planificado" } };
    const nuevos = detectarAgentesNuevosPlanificados({
      personasGrupo: [
        { persona_id: "per_A", hlg_id: "hlg_1", regimen_horario_id: "reg_plan", persona_label: "A" },
        { persona_id: "per_A", hlg_id: "hlg_2", regimen_horario_id: "reg_plan", persona_label: "A · 40 hs" },
      ],
      regimenes,
      personaIdsEnPlanMensual: new Set(["per_A"]),
      hlgIdsEnPlanMensual: new Set(["hlg_1"]),
    });
    assert.equal(nuevos.length, 1);
    assert.equal(nuevos[0].hlg_id, "hlg_2");
  });

  it("detecta agentes planificados vigentes no en plan", () => {
    const regimenes = {
      reg_plan: { tipo_patron: "planificado" },
      reg_fijo: { tipo_patron: "fijo" },
    };
    const nuevos = detectarAgentesNuevosPlanificados({
      personasGrupo: [
        { persona_id: "per_A", regimen_horario_id: "reg_plan", persona_label: "A" },
        { persona_id: "per_B", regimen_horario_id: "reg_plan", persona_label: "B" },
        { persona_id: "per_C", regimen_horario_id: "reg_fijo", persona_label: "C" },
      ],
      regimenes,
      personaIdsEnPlanMensual: new Set(["per_A"]),
    });
    assert.equal(nuevos.length, 1);
    assert.equal(nuevos[0].persona_id, "per_B");
  });

  it("merge solo agrega agentes nuevos permitidos", () => {
    const existentes = [{ persona_id: "per_A", dias: { "2026-07-01": {} } }];
    const payload = [
      { persona_id: "per_A", dias: { "2026-07-01": { tipo_dia: "franco" } } },
      { persona_id: "per_B", dias: { "2026-07-01": { tipo_dia: "laborable" } } },
    ];
    const merged = mergeAgentesIncorporacionPlanMensual(existentes, payload, new Set(["per_B"]));
    assert.equal(merged.ok, true);
    assert.equal(merged.agentes.length, 2);
    assert.equal(merged.agentes[0].persona_id, "per_A");
    assert.deepEqual(merged.agentes[0].dias, { "2026-07-01": {} });
    assert.equal(merged.agentes[1].persona_id, "per_B");
  });

  it("merge rechaza persona no incorporable", () => {
    const r = mergeAgentesIncorporacionPlanMensual([], [{ persona_id: "per_X" }], new Set(["per_B"]));
    assert.equal(r.ok, false);
    assert.equal(r.code, "PLT-INC-001");
  });

  it("elegirPlanMensualCanonico prioriza HABILITADO", () => {
    const p = elegirPlanMensualCanonico([
      { id: "1", estado: "BORRADOR" },
      { id: "2", estado: "HABILITADO" },
    ]);
    assert.equal(p.id, "2");
  });

  it("elegirPlanMensualCanonico ignora plan_rol incorporacion", () => {
    const p = elegirPlanMensualCanonico([
      { id: "inc", estado: "HABILITADO", plan_rol: "incorporacion" },
      { id: "base", estado: "EN_REVISION", plan_rol: "principal" },
    ]);
    assert.equal(p.id, "base");
  });

  it("planHabilitadoDesdeQuerySnapshot ignora eliminado", () => {
    const snap = {
      empty: false,
      docs: [
        { id: "borrado", data: () => ({ estado: "HABILITADO", eliminado: true, agentes: [] }) },
        { id: "vivo", data: () => ({ estado: "HABILITADO", eliminado: false, agentes: [{ persona_id: "per_A" }] }) },
      ],
    };
    const r = planHabilitadoDesdeQuerySnapshot(snap);
    assert.equal(r.planId, "vivo");
  });
});
