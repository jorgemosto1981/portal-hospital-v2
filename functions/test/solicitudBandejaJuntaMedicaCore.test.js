"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { resumenClasificacionAuditor } = require("../modules/shared/solicitudBandejaJuntaMedicaCore");

describe("solicitudBandejaJuntaMedicaCore", () => {
  it("resumenClasificacionAuditor expone requiere_junta", () => {
    const r = resumenClasificacionAuditor({
      auditor_medico_clasificacion: {
        requiere_junta_medica: true,
        observacion_auditor: "Derivo",
        auditor_persona_id: "per_x",
      },
    });
    assert.equal(r?.requiere_junta_medica, true);
    assert.equal(r?.observacion_auditor, "Derivo");
  });
});
