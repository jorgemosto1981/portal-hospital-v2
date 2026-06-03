"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  ymdAddDays,
  ymdFinMesSiguiente,
  findSiguienteHlgInicioTrasCorte,
} = require("../modules/asistencia/purgeCapaTeoricaGdtRango");

describe("ymdFinMesSiguiente / ymdAddDays (purge ventana)", () => {
  it("fin mes siguiente desde junio 2026", () => {
    assert.equal(ymdFinMesSiguiente("2026-06-01"), "2026-07-31");
  });

  it("día anterior al sucesor", () => {
    assert.equal(ymdAddDays("2026-06-14", -1), "2026-06-13");
  });
});

describe("findSiguienteHlgInicioTrasCorte", () => {
  it("detecta HLg sucesora con fecha_inicio Timestamp", () => {
    const rows = [
      { id: "hlg_vieja", activo: false, fecha_inicio: "2026-02-02", fecha_fin: "2026-06-10" },
      {
        id: "hlg_nueva",
        activo: true,
        fecha_inicio: { toDate: () => new Date("2026-06-11T15:00:00Z") },
      },
    ];
    assert.equal(
      findSiguienteHlgInicioTrasCorte(rows, { desdeCorteYmd: "2026-06-10", excludeHlgId: "hlg_vieja" }),
      "2026-06-11",
    );
  });

  it("ignora HLg con inicio anterior o igual al corte", () => {
    const rows = [{ id: "hlg_a", activo: true, fecha_inicio: "2026-06-10" }];
    assert.equal(
      findSiguienteHlgInicioTrasCorte(rows, { desdeCorteYmd: "2026-06-10" }),
      null,
    );
  });
});
