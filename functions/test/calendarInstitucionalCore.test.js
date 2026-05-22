"use strict";

/**
 * node --test functions/test/calendarInstitucionalCore.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildIndiceEventosCalendario,
  contarDiasHabilesDesdeIndice,
  esDiaHabilDesdeIndice,
  getInfoDiaDesdeIndice,
  obtenerProximoDiaHabilDesdeIndice,
} = require("../modules/shared/calendarInstitucionalCore");

describe("calendarInstitucionalCore", () => {
  it("fin de semana no es hábil", () => {
    const indice = buildIndiceEventosCalendario([]);
    assert.equal(esDiaHabilDesdeIndice("2026-05-23", indice), false);
    assert.equal(esDiaHabilDesdeIndice("2026-05-24", indice), false);
    assert.equal(esDiaHabilDesdeIndice("2026-05-22", indice), true);
  });

  it("feriado puntual bloquea y aplica multiplicador", () => {
    const indice = buildIndiceEventosCalendario([
      {
        id: "2026-05-25",
        data: { tipo: "feriado", descripcion: "Test", multiplicador: 2, anual: false },
      },
    ]);
    const info = getInfoDiaDesdeIndice("2026-05-25", indice);
    assert.equal(info.esHabil, false);
    assert.equal(info.multiplicador, 2);
  });

  it("evento anual aplica por mes-día", () => {
    const indice = buildIndiceEventosCalendario([
      {
        id: "2000-07-09",
        data: { tipo: "asueto", descripcion: "Anual", multiplicador: 1.5, anual: true },
      },
    ]);
    assert.equal(esDiaHabilDesdeIndice("2027-07-09", indice), false);
    assert.equal(getInfoDiaDesdeIndice("2027-07-09", indice).multiplicador, 1.5);
  });

  it("contar días hábiles en rango", () => {
    const indice = buildIndiceEventosCalendario([
      { id: "2026-05-25", data: { tipo: "feriado", descripcion: "F", multiplicador: 1, anual: false } },
    ]);
    const n = contarDiasHabilesDesdeIndice("2026-05-22", "2026-05-26", indice);
    assert.equal(n, 2);
  });

  it("obtener próximo día hábil", () => {
    const indice = buildIndiceEventosCalendario([]);
    assert.equal(obtenerProximoDiaHabilDesdeIndice("2026-05-23", indice), "2026-05-25");
  });
});
