/**
 * Fase B — alineación teórica y nocturnidad.
 * node --test functions/test/fichadasFaseB.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharedDir = join(dirname(fileURLToPath(import.meta.url)), "../modules/shared");

const {
  celdaTeoriaCruzaMedianoche,
  construirAnclasTeoricasCelda,
  resolverImputacionNocturnaMarca,
  alinearMarcasConTeoriaDia,
  CODIGO_NOCTURNIDAD_AMBIGUA,
} = require(join(sharedDir, "fichadasAlineacionTeoria.js"));

const { parseLineaRelojBiometrico, instanteMarcaInstitucionalMs } = require(join(sharedDir, "fichadasValidacionMarcas.js"));

describe("celdaTeoriaCruzaMedianoche", () => {
  it("detecta turno noche 22:00–06:00", () => {
    assert.equal(
      celdaTeoriaCruzaMedianoche({ rda_ingreso: "22:00", rda_egreso: "06:00" }),
      true,
    );
  });
});

describe("alinearMarcasConTeoriaDia — diurno M", () => {
  it("empareja ingreso y egreso por proximidad a anclas 06:00–14:00", () => {
    const celda = { tipo_dia: "laborable", rda_ingreso: "06:00", rda_egreso: "14:00", fichadas_esperadas: 2 };
    const ing = parseLineaRelojBiometrico("00123 13/06/26 06:05 001 01");
    const egr = parseLineaRelojBiometrico("00123 13/06/26 14:02 001 02");
    assert.equal(ing.ok, true);
    assert.equal(egr.ok, true);
    const r = alinearMarcasConTeoriaDia({
      marcas: [ing, egr],
      celda_teoria: celda,
      fecha_ymd: "2026-06-13",
    });
    assert.equal(r.fichadas_reales.length, 1);
    assert.equal(r.fichadas_reales[0].ingreso, "06:05");
    assert.equal(r.fichadas_reales[0].egreso, "14:02");
  });
});

describe("nocturnidad D+1 → D", () => {
  it("imputa egreso 06:05 del día 14 al turno nocturno del día 13", () => {
    const celdaD = { rda_ingreso: "22:00", rda_egreso: "06:00", tipo_dia: "laborable" };
    const celdaDplus = { rda_ingreso: "08:00", rda_egreso: "16:00", tipo_dia: "laborable" };
    const egresoManana = parseLineaRelojBiometrico("00123 14/06/26 06:05 001 02");
    assert.equal(egresoManana.ok, true);

    const imp = resolverImputacionNocturnaMarca(egresoManana, {
      celda_d: celdaD,
      celda_d_plus: celdaDplus,
      fecha_ymd_d: "2026-06-13",
    });
    assert.equal(imp.fecha_imputacion_ymd, "2026-06-13");

    const ingNoche = parseLineaRelojBiometrico("00123 13/06/26 22:02 001 01");
    const r = alinearMarcasConTeoriaDia({
      marcas: [ingNoche, imp.marca],
      celda_teoria: celdaD,
      celda_teoria_dia_siguiente: celdaDplus,
      fecha_ymd: "2026-06-13",
    });
    assert.equal(r.fichadas_reales[0].ingreso, "22:02");
    assert.equal(r.fichadas_reales[0].egreso, "06:05");
  });
});

describe("alinearMarcasConTeoriaDia — manual noche mismo día", () => {
  it("interpreta 21:00 y 05:05 como ingreso noche y egreso madrugada D+1", () => {
    const celda = { tipo_dia: "laborable", rda_ingreso: "22:00", rda_egreso: "06:00", fichadas_esperadas: 2 };
    const marcas = [
      { fecha_ymd: "2026-06-13", hora_hm: "21:00", instante_ms: instanteMarcaInstitucionalMs("2026-06-13", "21:00") },
      { fecha_ymd: "2026-06-13", hora_hm: "05:05", instante_ms: instanteMarcaInstitucionalMs("2026-06-13", "05:05") },
    ];
    const r = alinearMarcasConTeoriaDia({
      marcas,
      celda_teoria: celda,
      fecha_ymd: "2026-06-13",
    });
    assert.equal(r.fichadas_reales.length, 1);
    assert.equal(r.fichadas_reales[0].ingreso, "21:00");
    assert.equal(r.fichadas_reales[0].egreso, "05:05");
    assert.equal(r.fichadas_reales[0].fecha_egreso_ymd, "2026-06-14");
  });

  it("interpreta 05:35 y 06:38 mismo día como ingreso/egreso cronológico (M+T+N 06–06)", () => {
    const celda = { tipo_dia: "laborable", rda_ingreso: "06:00", rda_egreso: "06:00", fichadas_esperadas: 2 };
    const marcas = [
      { fecha_ymd: "2026-06-13", hora_hm: "05:35", instante_ms: instanteMarcaInstitucionalMs("2026-06-13", "05:35") },
      { fecha_ymd: "2026-06-13", hora_hm: "06:38", instante_ms: instanteMarcaInstitucionalMs("2026-06-13", "06:38") },
    ];
    const r = alinearMarcasConTeoriaDia({
      marcas,
      celda_teoria: celda,
      fecha_ymd: "2026-06-13",
    });
    assert.equal(r.fichadas_reales[0].ingreso, "05:35");
    assert.equal(r.fichadas_reales[0].egreso, "06:38");
    assert.equal(r.fichadas_reales[0].fecha_egreso_ymd, undefined);
  });
});

describe("construirAnclasTeoricasCelda", () => {
  it("coloca ancla de egreso nocturno en D+1", () => {
    const anclas = construirAnclasTeoricasCelda(
      { rda_ingreso: "22:00", rda_egreso: "06:00" },
      "2026-06-13",
    );
    assert.equal(anclas.length, 2);
    const egr = anclas.find((a) => a.rol === "egreso");
    assert.ok(egr);
    assert.ok(egr.instante_ms > anclas.find((a) => a.rol === "ingreso").instante_ms);
  });
});

describe("NOCTURNIDAD_AMBIGUA", () => {
  it("puede etiquetar equidistancia insalvable (política: igual aplica proximidad)", () => {
    const celdaD = { rda_ingreso: "22:00", rda_egreso: "06:00" };
    const celdaDplus = { rda_ingreso: "06:00", rda_egreso: "14:00" };
    const marca = parseLineaRelojBiometrico("00123 14/06/26 06:00 001 01");
    const imp = resolverImputacionNocturnaMarca(marca, {
      celda_d: celdaD,
      celda_d_plus: celdaDplus,
      fecha_ymd_d: "2026-06-13",
    });
    if (imp.advertencias.includes(CODIGO_NOCTURNIDAD_AMBIGUA)) {
      assert.ok(true);
    } else {
      assert.ok(imp.fecha_imputacion_ymd === "2026-06-13" || imp.fecha_imputacion_ymd === "2026-06-14");
    }
  });
});
