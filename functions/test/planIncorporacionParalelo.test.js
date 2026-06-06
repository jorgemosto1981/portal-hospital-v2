"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  filtrarAgentesMaterializacionPorPersona,
  mergeAgentesEditorAlPadre,
  appendGrillaAprobadaParcial,
  assertPadreHabilitadoParaMerge,
} = require("../modules/asistencia/planIncorporacionParalelo");

describe("planIncorporacionParalelo", () => {
  it("filtrarAgentesMaterializacionPorPersona acota a CAMPOS/CHAPARRO", () => {
    const todos = [
      { personaId: "per_LOKITO", hlgId: "h1" },
      { personaId: "per_MOSTO", hlgId: "h2" },
      { personaId: "per_CAMPOS", hlgId: "h3" },
      { personaId: "per_CHAPARRO", hlgId: "h4" },
    ];
    const filtrado = filtrarAgentesMaterializacionPorPersona(todos, ["per_CAMPOS", "per_CHAPARRO"]);
    assert.equal(filtrado.length, 2);
    assert.deepEqual(
      filtrado.map((a) => a.personaId).sort(),
      ["per_CAMPOS", "per_CHAPARRO"],
    );
  });

  it("mergeAgentesEditorAlPadre append sin pisar existentes", () => {
    const padre = [{ persona_id: "per_A", dias: { "2026-06-01": {} } }];
    const hijo = [{ persona_id: "per_B", dias: { "2026-06-01": { tipo_dia: "laborable" } } }];
    const r = mergeAgentesEditorAlPadre(padre, hijo);
    assert.equal(r.ok, true);
    assert.equal(r.agentes.length, 2);
    assert.equal(r.agentes[0].persona_id, "per_A");
  });

  it("mergeAgentesEditorAlPadre rechaza duplicado", () => {
    const r = mergeAgentesEditorAlPadre([{ persona_id: "per_A" }], [{ persona_id: "per_A" }]);
    assert.equal(r.ok, false);
    assert.equal(r.code, "PLT-MRG-001");
  });

  it("appendGrillaAprobadaParcial solo agrega agentes nuevos", () => {
    const grilla = {
      version: 1,
      agentes: [{ persona_id: "per_A", dias: {} }],
    };
    const out = appendGrillaAprobadaParcial(grilla, [
      { persona_id: "per_A", dias: { x: 1 } },
      { persona_id: "per_B", dias: { y: 2 } },
    ]);
    assert.equal(out.agentes.length, 2);
    assert.equal(out.agentes[1].persona_id, "per_B");
  });

  it("assertPadreHabilitadoParaMerge exige HABILITADO principal", () => {
    assert.equal(assertPadreHabilitadoParaMerge({ estado: "EN_REVISION", plan_rol: "principal" }).ok, false);
    assert.equal(assertPadreHabilitadoParaMerge({ estado: "HABILITADO", plan_rol: "principal" }).ok, true);
  });
});
