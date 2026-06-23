"use strict";

/**
 * node --test functions/test/grillaSyncGrupoMesCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildGrillaSyncGrupoMesDocId,
  debeDispararReconciliacionSyncGrilla,
  ESTADO_IDLE,
  ESTADO_EN_CURSO,
  ESTADO_PENDIENTE,
} = require("../modules/shared/grillaSyncGrupoMesCore");

describe("buildGrillaSyncGrupoMesDocId", () => {
  it("arma id estable gdt + periodo", () => {
    assert.equal(
      buildGrillaSyncGrupoMesDocId("gdt_01ABC", 2026, 6),
      "gdt_01ABC_2026_06",
    );
  });
});

describe("debeDispararReconciliacionSyncGrilla", () => {
  it("dispara al pasar a pendiente desde idle", () => {
    assert.equal(
      debeDispararReconciliacionSyncGrilla({ estado: ESTADO_IDLE }, { estado: ESTADO_PENDIENTE }),
      true,
    );
  });

  it("no re-dispara si ya estaba pendiente", () => {
    assert.equal(
      debeDispararReconciliacionSyncGrilla({ estado: ESTADO_PENDIENTE }, { estado: ESTADO_PENDIENTE }),
      false,
    );
  });

  it("no dispara si en_curso", () => {
    assert.equal(
      debeDispararReconciliacionSyncGrilla({ estado: ESTADO_EN_CURSO }, { estado: ESTADO_PENDIENTE }),
      false,
    );
  });
});
