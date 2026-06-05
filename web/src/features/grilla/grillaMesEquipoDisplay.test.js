import { describe, it, expect } from "vitest";
import { celdaEsIncompletoPlanVis, celdaTieneJornadaVis, textoHorarioTurno } from "./grillaMesEquipoDisplay.js";
import { varianteCeldaOperativa } from "./grillaTurnosVisual.js";

describe("celdaEsIncompletoPlanVis (US-1)", () => {
  it("laborable sin rda_* es incompleto", () => {
    expect(
      celdaEsIncompletoPlanVis({
        tipo_dia: "laborable",
        es_franco: false,
      }),
    ).toBe(true);
  });

  it("laborable con horario no es incompleto", () => {
    expect(
      celdaEsIncompletoPlanVis({
        tipo_dia: "laborable",
        rda_ingreso: "08:00",
        rda_egreso: "16:00",
      }),
    ).toBe(false);
  });

  it("franco sin turno no es incompleto plan", () => {
    expect(
      celdaEsIncompletoPlanVis({
        tipo_dia: "franco",
        es_franco: true,
      }),
    ).toBe(false);
  });
});

describe("varianteCeldaOperativa incompleto", () => {
  it("no devuelve vacio si es incompleto plan", () => {
    expect(
      varianteCeldaOperativa({
        esIncompletoPlan: true,
        tieneLicencia: false,
        tieneTurno: false,
      }),
    ).toBe("incompletoPlan");
  });
});

describe("textoHorarioTurno hueco", () => {
  it("laborable sin jornada no produce texto turno", () => {
    const cell = { tipo_dia: "laborable" };
    expect(celdaTieneJornadaVis(cell)).toBe(false);
    expect(textoHorarioTurno(cell)).toBe("");
  });
});
