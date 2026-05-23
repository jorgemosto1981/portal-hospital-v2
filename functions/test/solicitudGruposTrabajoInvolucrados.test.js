"use strict";

/**
 * Snapshot multigrupo — lógica pura.
 * Ejecutar: node --test functions/test/solicitudGruposTrabajoInvolucrados.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildGruposTrabajoInvolucradosIdsFromVigentes,
  assertGrupoAnclaEnGruposInvolucrados,
} = require("../modules/shared/solicitudGrupoTrabajoAncla");

describe("buildGruposTrabajoInvolucradosIdsFromVigentes", () => {
  it("deduplica y ordena gdt_*", () => {
    const ids = buildGruposTrabajoInvolucradosIdsFromVigentes([
      { grupo_de_trabajo_id: "gdt_01KR3H81ENQK84ZK21EQWEQQXG" },
      { grupo_de_trabajo_id: "gdt_01KR3H81ENQK84ZK21EQWEQQXG" },
      { grupo_de_trabajo_id: "gdt_01KR3H82BBBBBBBBBBBBBBBBBB" },
      { grupo_de_trabajo_id: "invalid" },
      {},
    ]);
    assert.deepEqual(ids, [
      "gdt_01KR3H81ENQK84ZK21EQWEQQXG",
      "gdt_01KR3H82BBBBBBBBBBBBBBBBBB",
    ]);
  });

  it("array vacío si no hay vigentes válidos", () => {
    assert.deepEqual(buildGruposTrabajoInvolucradosIdsFromVigentes([]), []);
  });
});

describe("assertGrupoAnclaEnGruposInvolucrados", () => {
  const snapshot = ["gdt_A", "gdt_B"];

  it("ok cuando ancla pertenece al snapshot", () => {
    assert.equal(assertGrupoAnclaEnGruposInvolucrados("gdt_B", snapshot).ok, true);
  });

  it("falla si ancla no está en snapshot", () => {
    const r = assertGrupoAnclaEnGruposInvolucrados("gdt_Z", snapshot);
    assert.equal(r.ok, false);
  });
});
