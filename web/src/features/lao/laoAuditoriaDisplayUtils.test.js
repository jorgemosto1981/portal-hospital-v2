import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildResumenEjecutivo,
  esSnapshotMotorV2,
  faseAbiertaPorDefecto,
  groupChecksByFase,
  peorNivelDeLista,
  snapshotTieneAdvertencias,
} from "./laoAuditoriaDisplayUtils.js";

describe("groupChecksByFase", () => {
  it("ordena fases A→E→W→L→S", () => {
    const grupos = groupChecksByFase([
      { fase: "S", nivel: "ok", codigo: "SALDO_OK" },
      { fase: "A", nivel: "ok", codigo: "PATRON_SALDO_A" },
      { fase: "C", nivel: "ok", codigo: "FECHAS_OK" },
      { fase: "W", nivel: "advertencia", codigo: "PREAVISO_FUERA_NORMA" },
    ]);
    assert.deepEqual(grupos.map((g) => g.id), ["A", "C", "W", "S"]);
  });
});

describe("peorNivelDeLista", () => {
  it("prioriza bloqueante sobre ok", () => {
    assert.equal(
      peorNivelDeLista([
        { nivel: "ok" },
        { nivel: "bloqueante" },
      ]),
      "bloqueante",
    );
  });
});

describe("faseAbiertaPorDefecto", () => {
  it("abre advertencia y bloqueante", () => {
    assert.equal(faseAbiertaPorDefecto("advertencia"), true);
    assert.equal(faseAbiertaPorDefecto("bloqueante"), true);
    assert.equal(faseAbiertaPorDefecto("ok"), false);
  });
});

describe("buildResumenEjecutivo", () => {
  it("advertencia cuando hay warnings sin bloqueo", () => {
    const r = buildResumenEjecutivo(
      [{ fase: "A", nivel: "ok", codigo: "PATRON_SALDO_A" }],
      [{ codigo: "PREAVISO_FUERA_NORMA", copy: "Preaviso corto" }],
    );
    assert.equal(r.tipo, "advertencia");
  });
});

describe("snapshotTieneAdvertencias", () => {
  it("detecta warnings y checks advertencia", () => {
    assert.equal(snapshotTieneAdvertencias({ warnings: [{ codigo: "X" }] }), true);
    assert.equal(
      snapshotTieneAdvertencias({ checks: [{ nivel: "advertencia", codigo: "Y" }] }),
      true,
    );
    assert.equal(snapshotTieneAdvertencias({ checks: [{ nivel: "ok" }] }), false);
  });
});

describe("esSnapshotMotorV2", () => {
  it("acepta motor v2 o checks array", () => {
    assert.equal(esSnapshotMotorV2({ motor_version: "lao-preview-v2" }), true);
    assert.equal(esSnapshotMotorV2({ checks: [] }), true);
    assert.equal(esSnapshotMotorV2({ camino: "stock" }), false);
  });
});
