"use strict";

/**
 * node --test functions/test/resolverTurnoDia.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolverFijo,
  resolverRotativo,
  cruzaMedianoche,
  isoWeekday,
  diffDays,
  ymdToDate,
  buildTurnoResponse,
} = require("../modules/asistencia/resolverTurnoDia");

describe("ymdToDate", () => {
  it("parsea fecha correctamente", () => {
    const d = ymdToDate("2026-06-15");
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 5);
    assert.equal(d.getUTCDate(), 15);
  });
});

describe("isoWeekday", () => {
  it("lunes = 1", () => {
    assert.equal(isoWeekday(ymdToDate("2026-05-25")), 1);
  });
  it("domingo = 7", () => {
    assert.equal(isoWeekday(ymdToDate("2026-05-31")), 7);
  });
  it("viernes = 5", () => {
    assert.equal(isoWeekday(ymdToDate("2026-05-29")), 5);
  });
  it("sabado = 6", () => {
    assert.equal(isoWeekday(ymdToDate("2026-05-30")), 6);
  });
});

describe("diffDays", () => {
  it("mismo dia = 0", () => {
    assert.equal(diffDays(ymdToDate("2026-06-01"), ymdToDate("2026-06-01")), 0);
  });
  it("un dia adelante = 1", () => {
    assert.equal(diffDays(ymdToDate("2026-06-01"), ymdToDate("2026-06-02")), 1);
  });
  it("un dia atras = -1", () => {
    assert.equal(diffDays(ymdToDate("2026-06-02"), ymdToDate("2026-06-01")), -1);
  });
  it("30 dias = 30", () => {
    assert.equal(diffDays(ymdToDate("2026-06-01"), ymdToDate("2026-07-01")), 30);
  });
});

describe("cruzaMedianoche", () => {
  it("turno diurno no cruza", () => {
    assert.equal(cruzaMedianoche({ ingreso: "07:00", egreso: "14:00" }), false);
  });
  it("turno nocturno cruza", () => {
    assert.equal(cruzaMedianoche({ ingreso: "22:00", egreso: "06:00" }), true);
  });
  it("guardia 24h cruza (08-08)", () => {
    assert.equal(cruzaMedianoche({ ingreso: "08:00", egreso: "08:00" }), true);
  });
  it("null no cruza", () => {
    assert.equal(cruzaMedianoche(null), false);
  });
});

describe("buildTurnoResponse", () => {
  it("null -> null", () => {
    assert.equal(buildTurnoResponse(null), null);
  });
  it("enriquece turno con defaults", () => {
    const r = buildTurnoResponse({ ingreso: "08:00", egreso: "14:00", horas_efectivas: 6 });
    assert.equal(r.ingreso, "08:00");
    assert.equal(r.egreso, "14:00");
    assert.equal(r.horas_efectivas, 6);
    assert.equal(r.es_nocturno, false);
    assert.equal(r.cruza_medianoche, false);
    assert.equal(r.tolerancia_ingreso_min, 0);
    assert.equal(r.tolerancia_egreso_min, 0);
    assert.equal(r.banda_ingreso, null);
    assert.equal(r.descanso, null);
  });
  it("conserva es_nocturno=true", () => {
    const r = buildTurnoResponse({ ingreso: "22:00", egreso: "06:00", horas_efectivas: 8, es_nocturno: true });
    assert.equal(r.es_nocturno, true);
    assert.equal(r.cruza_medianoche, true);
  });
});

describe("resolverFijo", () => {
  const regimen = {
    tipo_patron: "fijo",
    dias: [
      { dia_semana: 1, tipo_dia: "laborable", turno: { ingreso: "07:00", egreso: "14:00", horas_efectivas: 7 } },
      { dia_semana: 2, tipo_dia: "laborable", turno: { ingreso: "07:00", egreso: "14:00", horas_efectivas: 7 } },
      { dia_semana: 3, tipo_dia: "laborable", turno: { ingreso: "07:00", egreso: "14:00", horas_efectivas: 7 } },
      { dia_semana: 4, tipo_dia: "guardia", turno: { ingreso: "08:00", egreso: "08:00", horas_efectivas: 24 } },
      { dia_semana: 5, tipo_dia: "laborable", turno: { ingreso: "07:00", egreso: "14:00", horas_efectivas: 7 } },
      { dia_semana: 6, tipo_dia: "franco", turno: null },
      { dia_semana: 7, tipo_dia: "franco", turno: null },
    ],
  };

  it("lunes = laborable 7hs", () => {
    const r = resolverFijo(regimen, ymdToDate("2026-05-25"));
    assert.equal(r.tipo_dia, "laborable");
    assert.equal(r.turno_teorico.horas_efectivas, 7);
  });

  it("jueves = guardia 24hs", () => {
    const r = resolverFijo(regimen, ymdToDate("2026-05-28"));
    assert.equal(r.tipo_dia, "guardia");
    assert.equal(r.turno_teorico.horas_efectivas, 24);
  });

  it("sabado = franco", () => {
    const r = resolverFijo(regimen, ymdToDate("2026-05-30"));
    assert.equal(r.tipo_dia, "franco");
    assert.equal(r.turno_teorico, null);
  });

  it("domingo = franco", () => {
    const r = resolverFijo(regimen, ymdToDate("2026-05-31"));
    assert.equal(r.tipo_dia, "franco");
    assert.equal(r.turno_teorico, null);
  });
});

describe("resolverRotativo", () => {
  const regimen = {
    tipo_patron: "rotativo",
    ciclo_total: 4,
    ciclo: [
      { posicion: 1, tipo_dia: "laborable", turno: { ingreso: "22:00", egreso: "06:00", horas_efectivas: 8, es_nocturno: true } },
      { posicion: 2, tipo_dia: "laborable", turno: { ingreso: "22:00", egreso: "06:00", horas_efectivas: 8, es_nocturno: true } },
      { posicion: 3, tipo_dia: "franco", turno: null },
      { posicion: 4, tipo_dia: "franco", turno: null },
    ],
  };

  it("dia ancla = posicion 1", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-01"), "2026-06-01");
    assert.equal(r.tipo_dia, "laborable");
    assert.equal(r.posicion_ciclo, 1);
    assert.equal(r.turno_teorico.horas_efectivas, 8);
  });

  it("ancla +1 = posicion 2", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-02"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 2);
    assert.equal(r.tipo_dia, "laborable");
  });

  it("ancla +2 = posicion 3 (franco)", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-03"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 3);
    assert.equal(r.tipo_dia, "franco");
    assert.equal(r.turno_teorico, null);
  });

  it("ancla +3 = posicion 4 (franco)", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-04"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 4);
    assert.equal(r.tipo_dia, "franco");
  });

  it("ancla +4 = posicion 1 (ciclo se repite)", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-05"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 1);
    assert.equal(r.tipo_dia, "laborable");
  });

  it("ancla +8 = posicion 1 (dos ciclos completos)", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-09"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 1);
    assert.equal(r.tipo_dia, "laborable");
  });

  it("ancla +100 calcula correctamente", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-09-09"), "2026-06-01");
    assert.equal(r.posicion_ciclo, ((100 % 4) + 1));
    assert.equal(r.posicion_ciclo, 1);
  });

  it("fecha ANTES del ancla calcula correctamente (modulo negativo)", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-05-31"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 4);
    assert.equal(r.tipo_dia, "franco");
  });

  it("fecha 2 dias antes del ancla", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-05-30"), "2026-06-01");
    assert.equal(r.posicion_ciclo, 3);
    assert.equal(r.tipo_dia, "franco");
  });

  it("sin fecha ancla = no_laborable", () => {
    const r = resolverRotativo(regimen, ymdToDate("2026-06-01"), null);
    assert.equal(r.tipo_dia, "no_laborable");
  });
});
