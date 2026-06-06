"use strict";

/**
 * node --test functions/test/horarioInstitucionalDisplay.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  isoToHhmmInstitucional,
  toHhmmInstitucionalDisplay,
  rangoHhmmLabel,
  resolverHorarioCelda,
  horarioDisplayDesdeSegmentos,
  horarioDisplayDesdeCapaTeorica,
  horarioOperativoDesdeCeldaVis,
} = require("../modules/shared/horarioInstitucionalDisplay");

describe("horarioInstitucionalDisplay", () => {
  it("ISO UTC mañana BA → 06:00", () => {
    assert.equal(isoToHhmmInstitucional("2026-06-01T09:00:00.000Z"), "06:00");
  });

  it("no deja ISO en display string", () => {
    assert.equal(toHhmmInstitucionalDisplay("2026-06-01T09:00:00.000Z"), "06:00");
  });

  it("rango compacto 08-14", () => {
    assert.equal(rangoHhmmLabel("08:00", "14:00"), "08-14");
  });

  it("resolverHorarioCelda prioriza HH:mm sobre ISO", () => {
    const r = resolverHorarioCelda({
      ingreso: "06:00",
      egreso: "14:00",
      ingreso_iso: "2026-06-01T09:00:00.000Z",
      egreso_iso: "2026-06-01T17:00:00.000Z",
    });
    assert.equal(r.ingreso, "06:00");
    assert.equal(r.egreso, "14:00");
  });

  it("M+N con huecos → horario por tramos", () => {
    const capa = {
      tiene_huecos: true,
      ingreso_teorico_final: "2026-06-05T09:00:00.000Z",
      egreso_teorico_final: "2026-06-06T09:00:00.000Z",
      segmentos: [
        {
          segmento_id: "M",
          ingreso_iso: "2026-06-05T09:00:00.000Z",
          egreso_iso: "2026-06-05T17:00:00.000Z",
        },
        {
          segmento_id: "N",
          ingreso_iso: "2026-06-06T01:00:00.000Z",
          egreso_iso: "2026-06-06T09:00:00.000Z",
        },
      ],
    };
    assert.equal(
      horarioDisplayDesdeCapaTeorica(capa, "06:00", "06:00"),
      "06:00–14:00 · 22:00–06:00",
    );
  });

  it("vis celda usa rda_horario_display", () => {
    assert.equal(
      horarioOperativoDesdeCeldaVis({
        rda_ingreso: "06:00",
        rda_egreso: "06:00",
        rda_horario_display: "06:00–14:00 · 22:00–06:00",
        rda_tiene_huecos: true,
      }),
      "06:00–14:00 · 22:00–06:00",
    );
  });

  it("display antiguo ignorado si no hay huecos (compuesto continuo)", () => {
    assert.equal(
      horarioOperativoDesdeCeldaVis({
        rda_turno_id: "M+T+N",
        rda_ingreso: "06:00",
        rda_egreso: "06:00",
        rda_horario_display: "06:00–14:00 · 14:00–22:00 · 22:00–06:00",
        rda_tiene_huecos: false,
      }),
      "06:00–06:00",
    );
  });

  it("M+N discontinuo (tiene_huecos) muestra tramos", () => {
    assert.equal(
      horarioDisplayDesdeSegmentos({
        tiene_huecos: true,
        segmentos: [
          { ingreso: "06:00", egreso: "14:00" },
          { ingreso: "22:00", egreso: "06:00" },
        ],
      }),
      "06:00–14:00 · 22:00–06:00",
    );
  });

  it("compuesto continuo M+T no desglosa tramos", () => {
    const seg = horarioDisplayDesdeSegmentos({
      segmentos: [
        { ingreso: "06:00", egreso: "14:00" },
        { ingreso: "14:00", egreso: "22:00" },
      ],
      tiene_huecos: false,
    });
    assert.equal(seg, null);
  });

  it("mismo ingreso/egreso sin huecos no desglosa (sobre continuo)", () => {
    assert.equal(
      horarioDisplayDesdeSegmentos({
        segmentos: [
          { ingreso: "06:00", egreso: "14:00" },
          { ingreso: "14:00", egreso: "22:00" },
        ],
        tiene_huecos: false,
      }),
      null,
    );
  });
});
