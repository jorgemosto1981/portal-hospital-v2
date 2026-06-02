"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ymdAddDays, ymdFinMesSiguiente } = require("../modules/asistencia/purgeCapaTeoricaGdtRango");

describe("ymdFinMesSiguiente / ymdAddDays (purge ventana)", () => {
  it("fin mes siguiente desde junio 2026", () => {
    assert.equal(ymdFinMesSiguiente("2026-06-01"), "2026-07-31");
  });

  it("día anterior al sucesor", () => {
    assert.equal(ymdAddDays("2026-06-14", -1), "2026-06-13");
  });
});
