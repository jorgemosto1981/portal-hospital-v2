"use strict";

/**
 * Flujo resolver RRHH — huérfana vs legacy.
 * node --test functions/test/solicitudBandejaRrhhResolver.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { tipoFlujoResolverDecisionRrhh } = require("../modules/shared/solicitudBandejaRrhhCore");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
} = require("../modules/shared/solicitudesArticuloEstados");

describe("tipoFlujoResolverDecisionRrhh", () => {
  it("huérfana en_revision_jefe + flag sustituta", () => {
    assert.equal(
      tipoFlujoResolverDecisionRrhh({
        estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
        autorizacion_rrhh_sustituta: true,
      }),
      "cierre_sustituta",
    );
  });

  it("en_revision_jefe sin flag → invalido (no legacy)", () => {
    assert.equal(
      tipoFlujoResolverDecisionRrhh({
        estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
        autorizacion_rrhh_sustituta: false,
      }),
      "invalido",
    );
  });

  it("legacy en_revision_rrhh", () => {
    assert.equal(
      tipoFlujoResolverDecisionRrhh({
        estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_RRHH,
      }),
      "legacy_rrhh",
    );
  });
});
