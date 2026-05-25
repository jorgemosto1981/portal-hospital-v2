"use strict";

/**
 * node --test functions/test/laoAltaMotorCompleto.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  runLaoAltaMotorCompleto,
  evaluatePreavisoWarnings,
  resolveCupoOperativoDesdeMotor,
} = require("../modules/shared/laoAltaMotorCompleto");

const OP_GTE = "op_GTE_TEST";
const operadorCodigoPorId = { [OP_GTE]: "GTE" };

function versionLaoMock(overrides = {}) {
  const topes = {
    matriz_antiguedad_reglas: [{ operador_id: OP_GTE, valor_anos: 0, dias_otorgados: 26 }],
    reinicio_ciclo_id: "cfg_rcc_nunca",
    origen_saldo_id: "cfg_os_interno",
    dias_minimos_por_evento: 5,
    ...overrides.topes,
  };
  return {
    bloque_identidad_naturaleza: {
      es_lao_anual: true,
      codigo: "LAO",
      nombre: "Licencia Anual Ordinaria",
    },
    bloque_topes_plazos_computo: topes,
    bloque_workflow_sla_cobertura: {
      plazo_preaviso_normativa_dias: 15,
      permite_retroactividad: true,
      ...overrides.workflow,
    },
    ...overrides.root,
  };
}

describe("runLaoAltaMotorCompleto — snapshot en rechazo", () => {
  it("incluye motor_snapshot RFC en ERROR_APERTURA_TEMPORADA", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock(),
      versionId: "ver_test",
      fechaDesdeYmd: "2025-06-15",
      fechaHastaYmd: "2025-06-20",
      anioOrigenBolsa: 2025,
      anioCalendarioActual: 2025,
      hlcArray: [{ fecha_inicio: "2025-01-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.eligible, false);
    assert.ok(r.motor_snapshot);
    assert.equal(r.motor_snapshot.motor_version, "lao-preview-v2");
    assert.equal(r.motor_snapshot.version_aplicada_id, "ver_test");
    assert.equal(r.motor_snapshot.eligible, false);
    assert.ok(Array.isArray(r.motor_snapshot.checks));
    assert.ok(r.motor_snapshot.checks.some((c) => c.codigo === "ERROR_APERTURA_TEMPORADA"));
    assert.ok(r.motor_snapshot.contexto_auditoria?.display?.codigo === "LAO");
    assert.ok(r.motor_snapshot.config_usada?.version_aplicada_id === "ver_test");
  });
});

describe("runLaoAltaMotorCompleto — preaviso R4", () => {
  it("advertencia PREAVISO_FUERA_NORMA sin bloquear", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock(),
      versionId: "ver_test",
      fechaDesdeYmd: "2026-07-20",
      fechaHastaYmd: "2026-07-30",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2010-01-01" }],
      operadorCodigoPorId,
      hoyYmd: "2026-07-10",
    });
    assert.equal(r.eligible, true);
    assert.ok(r.warnings.some((w) => w.codigo === "PREAVISO_FUERA_NORMA"));
    assert.ok(r.motor_snapshot.warnings.some((w) => w.codigo === "PREAVISO_FUERA_NORMA"));
  });

  it("evaluatePreavisoWarnings retroactividad", () => {
    const v = versionLaoMock();
    const { warnings } = evaluatePreavisoWarnings(v, "2025-12-01", "2026-01-15");
    assert.ok(warnings.some((w) => w.codigo === "PREAVISO_RETROACTIVIDAD"));
  });
});

describe("runLaoAltaMotorCompleto — éxito stock + legacy", () => {
  it("camino stock con snapshot completo", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock(),
      versionId: "ver_test",
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-20",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2015-01-01" }],
      operadorCodigoPorId,
      diasSolicitados: 10,
      disponibleBolsa: 20,
    });
    assert.equal(r.eligible, true);
    assert.equal(r.camino, "stock");
    assert.equal(r.motor_version, "lao-preview-v2");
    assert.ok(r.motor_snapshot.asignacion);
    assert.equal(r.motor_snapshot.asignacion.cupo, 26);
    assert.ok(r.motor_snapshot.checks.some((c) => c.codigo === "MINIMO_DIAS_OK"));
  });
});

describe("runLaoAltaMotorCompleto — R3 saldo", () => {
  it("rechaza si dias < minimo con saldo suficiente", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock(),
      versionId: "ver_test",
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-15",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2015-01-01" }],
      operadorCodigoPorId,
      diasSolicitados: 3,
      disponibleBolsa: 10,
    });
    assert.equal(r.eligible, false);
    assert.ok(r.motor_snapshot.checks.some((c) => c.codigo === "ERROR_DIAS_MINIMOS"));
  });
});

describe("runLaoAltaMotorCompleto — superposición fase E", () => {
  it("bloquea con SUPERPOSICION_FECHAS y snapshot parcial", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock({
        topes: { politica_superposicion_id: "cfg_ps_bloqueante" },
      }),
      versionId: "ver_test",
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-15",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2015-01-01" }],
      operadorCodigoPorId,
      superposicionVal: {
        ok: false,
        codigo: "SUPERPOSICION_FECHAS",
        mensaje: "Ya hay un trámite que ocupa esa fecha.",
        conflicto_solicitud_id: "sol_conflict",
      },
    });
    assert.equal(r.eligible, false);
    assert.ok(r.motor_snapshot);
    assert.ok(r.motor_snapshot.checks.some((c) => c.codigo === "SUPERPOSICION_FECHAS" && c.fase === "E"));
    assert.equal(r.motor_snapshot.eligible, false);
    assert.ok(!r.motor_snapshot.asignacion);
  });

  it("continúa con SUPERPOSICION_OK", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock({
        topes: { politica_superposicion_id: "cfg_ps_bloqueante" },
      }),
      versionId: "ver_test",
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-20",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2015-01-01" }],
      operadorCodigoPorId,
      superposicionVal: { ok: true },
    });
    assert.equal(r.eligible, true);
    assert.ok(r.motor_snapshot.checks.some((c) => c.codigo === "SUPERPOSICION_OK"));
  });
});

describe("resolveCupoOperativoDesdeMotor", () => {
  it("lee cupo de asignacion", () => {
    const r = runLaoAltaMotorCompleto({
      versionData: versionLaoMock(),
      versionId: "ver_test",
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-15",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2015-01-01" }],
      operadorCodigoPorId,
    });
    assert.equal(resolveCupoOperativoDesdeMotor(r), 26);
  });
});
