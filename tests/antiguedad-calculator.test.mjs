import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularAntiguedad,
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

test("externos solapados con HLC no duplican días", () => {
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
  assert.equal(result.detalleCalculo.resumen.diasExternosNetosAplicados, 0);
  assert.equal(result.totalDiasCalculados, 366);
});

test("fecha corte LAO devuelve 31/12 del año anterior", () => {
  assert.equal(obtenerFechaCorteLao(2026), "2025-12-31");
});
