"use strict";

/**
 * node --test functions/test/laoMotorCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLaoMotorConfig,
  resolveFechaCorteAntiguedadLao,
  resolveMinimoDiasEfectivoLao,
  validarDiasMinimosR3,
  laoMotorError,
} = require("../modules/shared/laoMotorConfigResolver");
const { computeDiasTseServicioEfectivo } = require("../modules/shared/laoHlcIntervals");
const { runLaoAsignacionDiasCore } = require("../modules/shared/laoAsignacionDiasCore");

const OP_GTE = "op_GTE_TEST";
const operadorCodigoPorId = { [OP_GTE]: "GTE" };

function versionLaoMock(overrides = {}) {
  const topes = {
    matriz_antiguedad_reglas: [{ operador_id: OP_GTE, valor_anos: 0, dias_otorgados: 26 }],
    reinicio_ciclo_id: "cfg_rcc_nunca",
    origen_saldo_id: "cfg_os_interno",
    ...overrides.topes,
  };
  return {
    bloque_identidad_naturaleza: { es_lao_anual: true },
    bloque_topes_plazos_computo: topes,
  };
}

const HLC_HISTORICO = [
  { fecha_inicio: "2020-01-01", fecha_fin: "2022-12-31" },
  { fecha_inicio: "2025-03-01" },
];

describe("resolveLaoMotorConfig", () => {
  it("defaults TSE 180 y apertura 07-01", () => {
    const cfg = resolveLaoMotorConfig(versionLaoMock());
    assert.equal(cfg.tseMinimoDiasBase, 180);
    assert.equal(cfg.mesDiaApertura, "07-01");
    assert.equal(cfg.permiteProporcional, true);
  });

  it("lee tse_minimo_dias_base custom", () => {
    const cfg = resolveLaoMotorConfig(
      versionLaoMock({
        topes: {
          tse_minimo_dias_base: 90,
          matriz_antiguedad_reglas: [{ operador_id: OP_GTE, valor_anos: 0, dias_otorgados: 26 }],
        },
      }),
    );
    assert.equal(cfg.tseMinimoDiasBase, 90);
  });

  it("ERROR_NO_LAO si no es LAO", () => {
    assert.throws(
      () =>
        resolveLaoMotorConfig({
          bloque_identidad_naturaleza: { es_lao_anual: false },
          bloque_topes_plazos_computo: {},
        }),
      (e) => e.code === "ERROR_NO_LAO",
    );
  });
});

describe("resolveFechaCorteAntiguedadLao", () => {
  it("default 31/12 anio imputado", () => {
    assert.equal(resolveFechaCorteAntiguedadLao(versionLaoMock(), 2025), "2025-12-31");
  });

  it("corte explicito en versión", () => {
    const v = versionLaoMock({
      topes: { fecha_corte_antiguedad: "2025-06-30", matriz_antiguedad_reglas: [] },
    });
    assert.equal(resolveFechaCorteAntiguedadLao(v, 2025), "2025-06-30");
  });
});

describe("R3 dias minimos", () => {
  it("disp>=5 exige min 5", () => {
    const r = resolveMinimoDiasEfectivoLao({ minConfig: 5, disponibleBolsa: 10 });
    assert.equal(r.minEfectivo, 5);
    assert.equal(r.exigeTotalRemanente, false);
  });

  it("disp=4 exige total 4", () => {
    const r = resolveMinimoDiasEfectivoLao({ minConfig: 5, disponibleBolsa: 4 });
    assert.equal(r.exigeTotalRemanente, true);
    assert.equal(validarDiasMinimosR3(4, { minConfig: 5, disponibleBolsa: 4 }).ok, true);
    assert.equal(validarDiasMinimosR3(3, { minConfig: 5, disponibleBolsa: 4 }).ok, false);
  });
});

describe("computeDiasTseServicioEfectivo — hueco HLC (R1)", () => {
  it("no cuenta años sin vínculo entre tramos", () => {
    const { diasTse } = computeDiasTseServicioEfectivo({
      hlcArray: HLC_HISTORICO,
      anioActual: 2025,
      fechaHastaYmd: "2025-08-15",
      exclusionIntervals: [],
    });
    assert.ok(diasTse >= 160 && diasTse <= 170, `TSE esperado ~167, got ${diasTse}`);
    assert.ok(diasTse < 300, "no debe inflar desde 2020");
  });
});

describe("runLaoAsignacionDiasCore", () => {
  it("camino stock sin gates apertura/TSE", () => {
    const r = runLaoAsignacionDiasCore({
      versionData: versionLaoMock(),
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-20",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2015-01-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.camino_bolsa, "stock");
    assert.equal(r.camino_asignacion, "stock");
    assert.equal(r.eligible, true);
    assert.equal(r.asignacion.cupo, 26);
  });

  it("pleno cuando TSE >= umbral en año en curso", () => {
    const r = runLaoAsignacionDiasCore({
      versionData: versionLaoMock({ topes: { tse_minimo_dias_base: 90 } }),
      fechaDesdeYmd: "2025-07-14",
      fechaHastaYmd: "2025-07-25",
      anioOrigenBolsa: 2025,
      anioCalendarioActual: 2025,
      hlcArray: [{ fecha_inicio: "2025-01-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.camino_asignacion, "pleno");
    assert.equal(r.eligible, true);
    assert.equal(r.asignacion.cupo, 26);
  });

  it("proporcional cuando TSE < umbral y mismo ejercicio", () => {
    const r = runLaoAsignacionDiasCore({
      versionData: versionLaoMock({ topes: { tse_minimo_dias_base: 180 } }),
      fechaDesdeYmd: "2025-07-14",
      fechaHastaYmd: "2025-07-25",
      anioOrigenBolsa: 2025,
      anioCalendarioActual: 2025,
      hlcArray: [{ fecha_inicio: "2025-03-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.camino_asignacion, "proporcional");
    assert.equal(r.eligible, true);
    assert.ok(r.asignacion.cupo > 0 && r.asignacion.cupo < 26);
  });

  it("ERROR_TSE_INSUFICIENTE_ANIO_VENCIDO bolsa ejercicio anterior al año civil", () => {
    const r = runLaoAsignacionDiasCore({
      versionData: versionLaoMock({ topes: { tse_minimo_dias_base: 180 } }),
      fechaDesdeYmd: "2024-07-14",
      fechaHastaYmd: "2024-07-25",
      anioOrigenBolsa: 2024,
      anioCalendarioActual: 2025,
      hlcArray: [{ fecha_inicio: "2024-03-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.camino_bolsa, "proporcional");
    assert.equal(r.eligible, false);
    assert.ok(r.codigos.some((c) => c.codigo === "ERROR_TSE_INSUFICIENTE_ANIO_VENCIDO"));
  });

  it("ERROR_APERTURA_TEMPORADA antes de 07-01", () => {
    const r = runLaoAsignacionDiasCore({
      versionData: versionLaoMock(),
      fechaDesdeYmd: "2025-06-15",
      fechaHastaYmd: "2025-06-20",
      anioOrigenBolsa: 2025,
      anioCalendarioActual: 2025,
      hlcArray: [{ fecha_inicio: "2025-01-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.eligible, false);
    assert.ok(r.codigos.some((c) => c.codigo === "ERROR_APERTURA_TEMPORADA"));
  });

  it("motor_version lao-preview-v2", () => {
    const r = runLaoAsignacionDiasCore({
      versionData: versionLaoMock(),
      fechaDesdeYmd: "2026-05-10",
      fechaHastaYmd: "2026-05-15",
      anioOrigenBolsa: 2025,
      hlcArray: [{ fecha_inicio: "2010-01-01" }],
      operadorCodigoPorId,
    });
    assert.equal(r.motor_version, "lao-preview-v2");
  });
});

describe("laoMotorError", () => {
  it("expone code", () => {
    const e = laoMotorError("TEST", "msg");
    assert.equal(e.code, "TEST");
  });
});
