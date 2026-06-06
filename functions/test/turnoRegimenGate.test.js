"use strict";

/**
 * QA Bloque D: Motor V2 Stress Test — turnoRegimenGate
 * node --test functions/test/turnoRegimenGate.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  validarSuperposicionIntraDia,
  hhmmToMin,
  rangosHorariosSeSolapan,
  CODIGO_SIN_REGIMEN,
  CODIGO_SIN_TURNO,
  CODIGO_HORARIO_FUERA,
  CODIGO_HORARIO_EXCEDE,
} = require("../modules/shared/turnoRegimenGate");

describe("hhmmToMin", () => {
  it("00:00 = 0", () => assert.equal(hhmmToMin("00:00"), 0));
  it("07:00 = 420", () => assert.equal(hhmmToMin("07:00"), 420));
  it("14:00 = 840", () => assert.equal(hhmmToMin("14:00"), 840));
  it("23:59 = 1439", () => assert.equal(hhmmToMin("23:59"), 1439));
  it("null = -1", () => assert.equal(hhmmToMin(null), -1));
  it("empty = -1", () => assert.equal(hhmmToMin(""), -1));
});

describe("rangosHorariosSeSolapan", () => {
  it("08-10 y 12-14 no solapan", () => {
    assert.equal(rangosHorariosSeSolapan(480, 600, 720, 840), false);
  });
  it("08-11 y 10-13 solapan", () => {
    assert.equal(rangosHorariosSeSolapan(480, 660, 600, 780), true);
  });
  it("08-10 y 10-12 no solapan (limítrofe)", () => {
    assert.equal(rangosHorariosSeSolapan(480, 600, 600, 720), false);
  });
  it("07-14 y 10-12 solapan (parcial dentro de turno)", () => {
    assert.equal(rangosHorariosSeSolapan(420, 840, 600, 720), true);
  });
  it("07-14 y 15-17 no solapan (parcial fuera de turno)", () => {
    assert.equal(rangosHorariosSeSolapan(420, 840, 900, 1020), false);
  });
});

describe("D6: validarSuperposicionIntraDia — dos parciales no solapados", () => {
  it("08-10 y 12-14 mismo día NO colisionan", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-15",
      hora_inicio_a: "08:00",
      hora_fin_a: "10:00",
      es_jornada_completa_a: false,
      fecha_desde_b: "2026-06-15",
      fecha_hasta_b: "2026-06-15",
      hora_inicio_b: "12:00",
      hora_fin_b: "14:00",
      es_jornada_completa_b: false,
    });
    assert.equal(r.colisiona, false);
  });
});

describe("D7: validarSuperposicionIntraDia — dos parciales solapados", () => {
  it("08-11 y 10-13 mismo día SÍ colisionan", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-15",
      hora_inicio_a: "08:00",
      hora_fin_a: "11:00",
      es_jornada_completa_a: false,
      fecha_desde_b: "2026-06-15",
      fecha_hasta_b: "2026-06-15",
      hora_inicio_b: "10:00",
      hora_fin_b: "13:00",
      es_jornada_completa_b: false,
    });
    assert.equal(r.colisiona, true);
    assert.equal(r.fecha_colision, "2026-06-15");
  });
});

describe("D8: validarSuperposicionIntraDia — parcial + completa", () => {
  it("parcial 08-10 + completa mismo día SÍ colisionan", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-15",
      hora_inicio_a: "08:00",
      hora_fin_a: "10:00",
      es_jornada_completa_a: false,
      fecha_desde_b: "2026-06-15",
      fecha_hasta_b: "2026-06-15",
      es_jornada_completa_b: true,
    });
    assert.equal(r.colisiona, true);
    assert.equal(r.fecha_colision, "2026-06-15");
  });

  it("completa + parcial mismo día SÍ colisionan (orden inverso)", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-15",
      es_jornada_completa_a: true,
      fecha_desde_b: "2026-06-15",
      fecha_hasta_b: "2026-06-15",
      hora_inicio_b: "08:00",
      hora_fin_b: "10:00",
      es_jornada_completa_b: false,
    });
    assert.equal(r.colisiona, true);
    assert.equal(r.fecha_colision, "2026-06-15");
  });

  it("dos completas mismo día SÍ colisionan", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-15",
      es_jornada_completa_a: true,
      fecha_desde_b: "2026-06-15",
      fecha_hasta_b: "2026-06-15",
      es_jornada_completa_b: true,
    });
    assert.equal(r.colisiona, true);
  });
});

describe("validarSuperposicionIntraDia — sin solapamiento de fechas", () => {
  it("días distintos no colisionan (parciales o completas)", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-15",
      es_jornada_completa_a: true,
      fecha_desde_b: "2026-06-16",
      fecha_hasta_b: "2026-06-16",
      es_jornada_completa_b: true,
    });
    assert.equal(r.colisiona, false);
  });

  it("rangos multi-día parciales no solapados no colisionan", () => {
    const r = validarSuperposicionIntraDia({
      fecha_desde_a: "2026-06-15",
      fecha_hasta_a: "2026-06-17",
      hora_inicio_a: "08:00",
      hora_fin_a: "10:00",
      es_jornada_completa_a: false,
      fecha_desde_b: "2026-06-16",
      fecha_hasta_b: "2026-06-18",
      hora_inicio_b: "12:00",
      hora_fin_b: "14:00",
      es_jornada_completa_b: false,
    });
    assert.equal(r.colisiona, false);
  });
});

describe("Códigos de error exportados", () => {
  it("SIN_REGIMEN_HORARIO", () => assert.equal(CODIGO_SIN_REGIMEN, "SIN_REGIMEN_HORARIO"));
  it("SIN_TURNO_DIA", () => assert.equal(CODIGO_SIN_TURNO, "SIN_TURNO_DIA"));
  it("HORARIO_FUERA_DE_TURNO", () => assert.equal(CODIGO_HORARIO_FUERA, "HORARIO_FUERA_DE_TURNO"));
  it("HORARIO_EXCEDE_TURNO", () => assert.equal(CODIGO_HORARIO_EXCEDE, "HORARIO_EXCEDE_TURNO"));
});
