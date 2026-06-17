/**
 * node --test functions/test/resolverPresentacionCompuestoCelda.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { calcularDeltasCumplimiento } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/calcularDeltasCumplimiento.js"),
);
const { resolverPresentacionCompuestoCelda } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/resolverPresentacionCompuestoCelda.js"),
);
const { enriquecerLimitesCumplimientoEnCapa } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/capaTeoricaLimitesCumplimiento.js"),
);

const TOL_REGIMEN = {
  tolerancia_debitohorario_minutos: 30,
  turnos_disponibles: [
    { turno_id: "M", tolerancia_ingreso_min: 25, tolerancia_egreso_min: 25 },
    { turno_id: "T", tolerancia_ingreso_min: 25, tolerancia_egreso_min: 25 },
    { turno_id: "N", tolerancia_ingreso_min: 25, tolerancia_egreso_min: 25 },
  ],
};

function celdaConFichadas(filas) {
  return {
    tipo_dia: "laborable",
    fichadas_esperadas: 2,
    fichadas_reales: filas,
  };
}

function capaMtnContinuaEnriquecida(fechaYmd) {
  const f = String(fechaYmd).slice(0, 10);
  const [y, m, d] = f.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return enriquecerLimitesCumplimientoEnCapa(
    {
      tipo_dia: "laborable",
      tiene_huecos: false,
      turno_compuesto_id: "M+T+N",
      horas_teoricas_totales: 24,
      segmentos: [
        {
          segmento_id: "M",
          ingreso_iso: `${f}T09:00:00.000Z`,
          egreso_iso: `${f}T17:00:00.000Z`,
        },
        {
          segmento_id: "T",
          ingreso_iso: `${f}T17:00:00.000Z`,
          egreso_iso: `${next}T01:00:00.000Z`,
        },
        {
          segmento_id: "N",
          ingreso_iso: `${next}T01:00:00.000Z`,
          egreso_iso: `${next}T09:00:00.000Z`,
        },
      ],
      ingreso_teorico_final: `${f}T09:00:00.000Z`,
      egreso_teorico_final: `${next}T09:00:00.000Z`,
    },
    TOL_REGIMEN,
  );
}

function resolverDesdeFichadas(fechaYmd, fichadas) {
  const capa = capaMtnContinuaEnriquecida(fechaYmd);
  const celda = celdaConFichadas(fichadas);
  const analitica = calcularDeltasCumplimiento(celda, capa, { fecha_ymd: fechaYmd });
  return resolverPresentacionCompuestoCelda(celda, capa, analitica, { fecha_ymd: fechaYmd });
}

describe("resolverPresentacionCompuestoCelda", () => {
  it("retorna null si no hay compuesto (un solo segmento)", () => {
    const capa = enriquecerLimitesCumplimientoEnCapa(
      {
        tipo_dia: "laborable",
        segmentos: [{ segmento_id: "M", ingreso_iso: "2026-06-13T09:00:00.000Z", egreso_iso: "2026-06-13T17:00:00.000Z" }],
      },
      TOL_REGIMEN,
    );
    const r = resolverPresentacionCompuestoCelda(celdaConFichadas([]), capa, { calculo_por_segmentos: true }, {
      fecha_ymd: "2026-06-13",
    });
    assert.equal(r, null);
  });

  it("QA-C5: tres filas — M presente, T parcial con ▼ 3h 30m, N ausente", () => {
    const FECHA = "2026-06-13";
    const pres = resolverDesdeFichadas(FECHA, [
      { ingreso: "06:00", egreso: "18:30", fecha_ymd: FECHA, fecha_egreso_ymd: FECHA },
    ]);
    assert.equal(pres?.version, 1);
    assert.equal(pres?.filas?.length, 3);

    const m = pres.filas.find((f) => f.segmento_id === "M");
    const t = pres.filas.find((f) => f.segmento_id === "T");
    const n = pres.filas.find((f) => f.segmento_id === "N");

    assert.equal(m?.estado_tramo, "presente");
    assert.equal(m?.fichada_label, "06-14");
    assert.equal(m?.badge_label, null);

    assert.equal(t?.estado_tramo, "parcial");
    assert.equal(t?.fichada_label, "14:00-18:30");
    assert.equal(t?.badge_label, "▼ 3h 30m");
    assert.equal(t?.badge_tipo, "salida");

    assert.equal(n?.estado_tramo, "ausente");
    assert.equal(n?.fichada_label, null);
    assert.equal(n?.badge_label, "AUSENTE");
  });

  it("QA-C1: fichada 24h — N presente dentro de cortesía (salida 25m, tol 30)", () => {
    const FECHA = "2026-06-13";
    const pres = resolverDesdeFichadas(FECHA, [
      {
        ingreso: "06:38",
        egreso: "05:35",
        fecha_ymd: FECHA,
        fecha_egreso_ymd: "2026-06-14",
      },
    ]);
    const n = pres.filas.find((f) => f.segmento_id === "N");
    assert.equal(n?.estado_tramo, "presente");
    assert.equal(n?.badge_label, null);
  });

  it("QA-C1: fichada 24h — tres filas con proyección, sin AUSENTE en M/T/N", () => {
    const FECHA = "2026-06-13";
    const pres = resolverDesdeFichadas(FECHA, [
      {
        ingreso: "06:38",
        egreso: "05:35",
        fecha_ymd: FECHA,
        fecha_egreso_ymd: "2026-06-14",
      },
    ]);
    assert.equal(pres?.filas?.length, 3);
    for (const id of ["M", "T", "N"]) {
      const fila = pres.filas.find((f) => f.segmento_id === id);
      assert.notEqual(fila?.estado_tramo, "ausente", id);
      assert.ok(fila?.fichada_label, `${id} debe tener fichada proyectada`);
      assert.notEqual(fila?.badge_label, "AUSENTE", id);
    }
    assert.equal(pres.filas.find((f) => f.segmento_id === "M")?.fichada_label, "06:38-14:00");
  });

  it("QA-C4: ABM M y N — fila T AUSENTE sin fichada", () => {
    const FECHA = "2026-06-16";
    const capa = enriquecerLimitesCumplimientoEnCapa(
      {
        tipo_dia: "laborable",
        tiene_huecos: false,
        turno_compuesto_id: "M+T+N",
        horas_teoricas_totales: 24,
        segmentos: [
          {
            segmento_id: "M",
            ingreso_iso: "2026-06-16T09:00:00.000Z",
            egreso_iso: "2026-06-16T17:00:00.000Z",
          },
          {
            segmento_id: "T",
            ingreso_iso: "2026-06-16T17:00:00.000Z",
            egreso_iso: "2026-06-17T01:00:00.000Z",
          },
          {
            segmento_id: "N",
            ingreso_iso: "2026-06-17T01:00:00.000Z",
            egreso_iso: "2026-06-17T09:00:00.000Z",
          },
        ],
        ingreso_teorico_final: "2026-06-16T09:00:00.000Z",
        egreso_teorico_final: "2026-06-17T09:00:00.000Z",
      },
      TOL_REGIMEN,
    );
    const celda = celdaConFichadas([
      { ingreso: "05:54", egreso: "14:10", fecha_ymd: FECHA },
      {
        ingreso: "21:50",
        egreso: "05:55",
        fecha_ymd: FECHA,
        fecha_egreso_ymd: "2026-06-17",
      },
    ]);
    const analitica = calcularDeltasCumplimiento(celda, capa, { fecha_ymd: FECHA });
    const pres = resolverPresentacionCompuestoCelda(celda, capa, analitica, { fecha_ymd: FECHA });

    const t = pres.filas.find((f) => f.segmento_id === "T");
    assert.equal(t?.estado_tramo, "ausente");
    assert.equal(t?.fichada_label, null);
    assert.equal(t?.badge_label, "AUSENTE");
    assert.ok(pres.filas.find((f) => f.segmento_id === "M")?.fichada_label);
    assert.ok(pres.filas.find((f) => f.segmento_id === "N")?.fichada_label);
  });
});
