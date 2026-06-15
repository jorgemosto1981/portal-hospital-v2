/**
 * node --test functions/test/calcularDeltasCumplimiento.test.js
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
const { instanteMarcaInstitucionalMs } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/fichadasValidacionMarcas.js"),
);

const FECHA = "2026-06-12";

/** Slice enriquecido (turno 08:00–16:00, gracia ingreso +10 / egreso −10). */
const CAPA_ENRIQUECIDA = {
  tipo_dia: "laborable",
  carga_horaria_diaria_minutos: 480,
  tolerancia_debitohorario_minutos: 30,
  ingreso_nominal_iso: "2026-06-12T08:00:00-03:00",
  ingreso_limite_con_gracia_iso: "2026-06-12T08:10:00-03:00",
  egreso_nominal_iso: "2026-06-12T16:00:00-03:00",
  egreso_limite_con_gracia_iso: "2026-06-12T15:50:00-03:00",
};

function celdaConFichadas(filas) {
  return {
    tipo_dia: "laborable",
    fichadas_esperadas: 2,
    fichadas_reales: filas,
  };
}

describe("calcularDeltasCumplimiento (Fase 1 colisión)", () => {
  it("día limpio: dentro de gracia y sin déficit grave", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "08:05", egreso: "16:00", fecha_ymd: FECHA }]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA, ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "18:00") },
    );
    assert.equal(r.version, 1);
    assert.equal(r.disciplina.fuera_de_margen, false);
    assert.equal(r.disciplina.tardanza_minutos, 0);
    assert.equal(r.disciplina.salida_anticipada_minutos, 0);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, false);
    assert.equal(r.ausencia_automatica, false);
    assert.equal(r.alertas_activas.length, 0);
  });

  it("tardanza punitiva: un minuto después del límite con gracia", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "08:11", egreso: "16:00", fecha_ymd: FECHA }]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.fuera_de_margen, true);
    assert.equal(r.disciplina.tardanza_minutos, 11);
    assert.ok(r.alertas_activas.includes("TARDANZA_PUNITIVA"));
  });

  it("débito de tiempo: déficit por tramos cortos sin infracción de margen de fichada", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([
        { ingreso: "08:00", egreso: "12:00", fecha_ymd: FECHA },
        { ingreso: "13:00", egreso: "15:50", fecha_ymd: FECHA },
      ]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.tardanza_minutos, 0);
    assert.equal(r.disciplina.salida_anticipada_minutos, 0);
    assert.equal(r.debito_tiempo.carga_real_minutos, 410);
    assert.equal(r.debito_tiempo.deficit_minutos, 70);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, true);
    assert.ok(r.alertas_activas.includes("DEFICIT_HORARIO_GRAVE"));
  });

  it("débito de tiempo: marcas hora_hm sueltas (carga manual sin teoría)", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ hora_hm: "06:00" }, { hora_hm: "13:01" }]),
      {
        ...CAPA_ENRIQUECIDA,
        ingreso_nominal_iso: "2026-06-15T06:00:00-03:00",
        ingreso_limite_con_gracia_iso: "2026-06-15T06:15:00-03:00",
        egreso_nominal_iso: "2026-06-15T14:00:00-03:00",
        egreso_limite_con_gracia_iso: "2026-06-15T13:50:00-03:00",
      },
      { fecha_ymd: "2026-06-15" },
    );
    assert.equal(r.debito_tiempo.carga_real_minutos, 421);
    assert.equal(r.debito_tiempo.deficit_minutos, 59);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, true);
  });

  it("fichada fuera del turno teórico (N vs marcas diurnas)", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "05:35", egreso: "13:55", fecha_ymd: "2026-06-18" }]),
      {
        tipo_dia: "laborable",
        turno_id: "N",
        carga_horaria_diaria_minutos: 480,
        tolerancia_debitohorario_minutos: 30,
        ingreso_nominal_iso: "2026-06-19T01:00:00.000Z",
        ingreso_limite_con_gracia_iso: "2026-06-19T01:00:00.000Z",
        egreso_nominal_iso: "2026-06-19T09:00:00.000Z",
        egreso_limite_con_gracia_iso: "2026-06-19T09:00:00.000Z",
      },
      { fecha_ymd: "2026-06-18" },
    );
    assert.equal(r.fichada_fuera_turno_teorico, true);
    assert.equal(r.debito_tiempo.calculo_suspendido, true);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, false);
    assert.ok(r.alertas_activas.includes("FICHADA_FUERA_TURNO_TEORICO"));
  });

  it("ausencia automática en backfill cuando supera límite de ingreso + 120 min", () => {
    const umbralMs = instanteMarcaInstitucionalMs(FECHA, "10:10");
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA, ahora_evaluacion_ms: umbralMs },
    );
    assert.equal(r.ausencia_automatica, true);
    assert.ok(r.alertas_activas.includes("AUSENCIA_AUTOMATICA"));

    const antes = calcularDeltasCumplimiento(
      celdaConFichadas([]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA, ahora_evaluacion_ms: umbralMs - 60_000 },
    );
    assert.equal(antes.ausencia_automatica, false);
  });
});
