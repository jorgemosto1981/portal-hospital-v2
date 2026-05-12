import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { civilDateInZonaToUtcAnchorMs } = require("../functions/modules/shared/fechaInstitucionalBa.js");
const {
  computeTseYMeses,
  runLaoPreviewSimulacion,
} = require("../functions/modules/shared/laoPreviewMotor.js");

test("TSE: enero 1–10 sin exclusiones = 10 días y 1 mes efectivo", () => {
  const r = computeTseYMeses({
    year: 2026,
    fechaDesdeYmd: "2026-01-10",
    exclusionIntervals: [],
  });
  assert.equal(r.diasTse, 10);
  assert.equal(r.mesesConDiaEfectivo, 1);
});

test("TSE: exclusión marzo 2026 reduce días en ventana hasta 15-may", () => {
  const mar = {
    inicioUtc: civilDateInZonaToUtcAnchorMs(2026, 3, 1),
    finUtc: civilDateInZonaToUtcAnchorMs(2026, 3, 31),
  };
  const r = computeTseYMeses({
    year: 2026,
    fechaDesdeYmd: "2026-05-15",
    exclusionIntervals: [mar],
  });
  const sinExcl = computeTseYMeses({
    year: 2026,
    fechaDesdeYmd: "2026-05-15",
    exclusionIntervals: [],
  });
  assert.ok(r.diasTse < sinExcl.diasTse);
  assert.equal(sinExcl.diasTse - r.diasTse, 31);
});

test("runLaoPreviewSimulacion: proporcional con matriz y guardas", () => {
  const versionData = {
    bloque_identidad_naturaleza: { es_lao_anual: true },
    bloque_topes_plazos_computo: {
      matriz_antiguedad_reglas: [
        { operador_id: "cfg_oc_gte", valor_anos: 0, dias_otorgados: 25 },
        { operador_id: "cfg_oc_gte", valor_anos: 10, dias_otorgados: 25 },
      ],
    },
  };
  const hlc = [{ fecha_inicio: "2010-01-01", fecha_fin: "2026-12-31" }];
  const out = runLaoPreviewSimulacion({
    fechaDesdeYmd: "2026-10-15",
    anioOrigenBolsa: 2026,
    hlcArray: hlc,
    diasExternos: 0,
    exclusionIntervals: [],
    versionData,
    operadorCodigoPorId: { cfg_oc_gte: "GTE" },
  });
  assert.equal(out.camino, "proporcional");
  assert.equal(out.eligible, true);
  assert.equal(out.guardas.julio_primero.ok, true);
  assert.equal(out.guardas.tse_180.ok, true);
  assert.ok(out.matriz.dias_base != null);
  assert.ok(out.proporcional.dias_proporcionales_piso != null);
});

test("runLaoPreviewSimulacion: error año no eligible", () => {
  const versionData = {
    bloque_identidad_naturaleza: { es_lao_anual: true },
    bloque_topes_plazos_computo: { matriz_antiguedad_reglas: [] },
  };
  const out = runLaoPreviewSimulacion({
    fechaDesdeYmd: "2026-10-15",
    anioOrigenBolsa: 2027,
    hlcArray: [],
    diasExternos: 0,
    exclusionIntervals: [],
    versionData,
    operadorCodigoPorId: {},
  });
  assert.equal(out.camino, "error_ano");
  assert.equal(out.eligible, false);
  assert.ok(out.motivos_ineligibilidad.length > 0);
});
