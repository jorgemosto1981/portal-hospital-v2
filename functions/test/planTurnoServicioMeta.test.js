"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAgentesIndicesDenormalizados,
  buildPlanMetaPayload,
  PLAN_ROL_PRINCIPAL,
} = require("../modules/asistencia/planTurnoServicioMeta");

describe("planTurnoServicioMeta", () => {
  it("buildAgentesIndicesDenormalizados ordena y filtra ids", () => {
    const r = buildAgentesIndicesDenormalizados([
      { persona_id: "per_B", hlg_id: "hlg_2" },
      { persona_id: "per_A", hlg_id: "hlg_1" },
      { persona_id: "x", hlg_id: "bad" },
    ]);
    assert.deepEqual(r.agentes_persona_ids, ["per_A", "per_B"]);
    assert.deepEqual(r.agentes_hlg_ids, ["hlg_1", "hlg_2"]);
  });

  it("buildPlanMetaPayload principal limpia plan_padre_id", () => {
    const r = buildPlanMetaPayload({
      agentes: [{ persona_id: "per_A", hlg_id: "hlg_1" }],
      plan_rol: PLAN_ROL_PRINCIPAL,
      plan_padre_id: "plt_old",
    });
    assert.equal(r.plan_rol, "principal");
    assert.equal(r.plan_padre_id, null);
    assert.equal(r.agentes_persona_ids.length, 1);
  });
});
