import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularAntiguedad,
  normalizarAcarreoAmd,
  obtenerFechaCorteLao,
} from "../shared/utils/antiguedadCalculator.js";

test("fusiona solapes y evita doble conteo", () => {
  const hlc = [
    { fecha_inicio: "2020-01-01", fecha_fin: "2020-12-31" },
    { fecha_inicio: "2020-07-01", fecha_fin: "2021-06-30" },
  ];

  const result = calcularAntiguedad(hlc, "2021-12-31", 0);
  assert.equal(result.detalleCalculo.resumen.diasHlcFusionados, 547);
  assert.equal(result.detalleCalculo.resumen.diasSuperpuestosDescartados, 184);
  assert.equal(result.totalDiasCalculados, 547);
});

test("topa cargo vigente contra fecha de corte", () => {
  const hlc = [{ fecha_inicio: "2023-05-10", fecha_fin: null }];
  const result = calcularAntiguedad(hlc, "2024-12-31", 0);

  assert.equal(result.detalleCalculo.intervalosFusionados.length, 1);
  assert.equal(result.detalleCalculo.intervalosFusionados[0].fecha_fin, "2024-12-31");
});

test("externos con fecha_impacto futura no aplican", () => {
  const hlc = [{ fecha_inicio: "2024-01-01", fecha_fin: "2024-12-31" }];
  const externos = [
    {
      dias_reconocidos: 365,
      normativa: "RES-123",
      fecha_impacto: "2026-07-01",
      estado: "vigente",
    },
    {
      dias_reconocidos: 120,
      normativa: "RES-100",
      fecha_impacto: "2025-01-01",
      estado: "vigente",
    },
  ];

  const result = calcularAntiguedad(hlc, "2026-06-30", externos);
  assert.equal(result.detalleCalculo.diasExternosAplicados, 120);
  assert.equal(result.detalleCalculo.externosConsiderados.length, 1);
  assert.equal(result.detalleCalculo.externosExcluidosPorCorte.length, 1);
});

test("externo sin dias_reconocidos usa desglose anios/meses/dias (365/30)", () => {
  const hlc = [{ fecha_inicio: "2024-01-01", fecha_fin: "2024-12-31" }];
  const externos = [
    {
      anios: 1,
      meses: 0,
      dias: 0,
      normativa: "RES-SIN-DR",
      fecha_impacto: "2024-06-01",
      estado: "vigente",
    },
  ];
  const result = calcularAntiguedad(hlc, "2024-12-31", externos);
  assert.deepEqual(result.detalleCalculo.externosConsiderados[0].amd_aportado, { años: 1, meses: 0, dias: 0 });
  assert.equal(result.detalleCalculo.diasExternosAplicados, 365);
  assert.equal(result.detalleCalculo.externosConsiderados[0].dias_reconocidos, 365);
  assert.equal(result.detalleCalculo.externosConsiderados[0].dias_desglose_normativo, 0);
  assert.deepEqual(result.detalleCalculo.amdHlc, { años: 1, meses: 0, dias: 1 });
  assert.deepEqual(result.detalleCalculo.amdFinal, { años: 2, meses: 0, dias: 1 });
  assert.equal(result.totalDiasCalculados, 731);
});

test("externos se suman como crédito adicional por fecha", () => {
  const hlc = [{ fecha_inicio: "2020-01-01", fecha_fin: "2020-12-31" }];
  const externos = [
    {
      dias_reconocidos: 60,
      normativa: "RES-200",
      fecha_impacto: "2020-06-01",
      estado: "vigente",
    },
  ];

  const result = calcularAntiguedad(hlc, "2020-12-31", externos);
  assert.equal(result.detalleCalculo.resumen.diasHlcFusionados, 366);
  assert.equal(result.detalleCalculo.resumen.diasExternosReconocidos, 60);
  assert.equal(result.detalleCalculo.resumen.diasExternosNetosAplicados, 60);
  assert.deepEqual(result.detalleCalculo.amdFinal, { años: 1, meses: 2, dias: 1 });
  assert.equal(result.totalDiasCalculados, 426);
});

test("acarreo: dias > 29 suma un mes; meses > 11 suma un año", () => {
  assert.deepEqual(normalizarAcarreoAmd(0, 0, 30), { años: 0, meses: 1, dias: 0 });
  assert.deepEqual(normalizarAcarreoAmd(0, 12, 0), { años: 1, meses: 0, dias: 0 });
  const hlc = [{ fecha_inicio: "2024-01-01", fecha_fin: "2024-02-28" }];
  const result = calcularAntiguedad(hlc, "2024-12-31", [
    { anios: 0, meses: 0, dias: 2, normativa: "X", fecha_impacto: "2024-06-01", estado: "vigente" },
  ]);
  assert.equal(result.detalleCalculo.resumen.diasHlcFusionados, 59);
  assert.deepEqual(result.detalleCalculo.amdHlc, { años: 0, meses: 1, dias: 29 });
  assert.deepEqual(result.detalleCalculo.amdExternoSumadoRaw, { años: 0, meses: 0, dias: 2 });
  assert.deepEqual(result.detalleCalculo.amdFinal, { años: 0, meses: 2, dias: 1 });
  assert.equal(result.totalDiasCalculados, 61);
});

test("fecha corte LAO devuelve 31/12 del año anterior", () => {
  assert.equal(obtenerFechaCorteLao(2026), "2025-12-31");
});
