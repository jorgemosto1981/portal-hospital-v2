import { describe, it, expect } from "vitest";
import { celdaEsIncompletoPlanVis, celdaTieneJornadaVis, textoHorarioTurno } from "./grillaMesEquipoDisplay.js";
import { celdaTieneDesalineacionTeoria } from "./grillaMesCellUtils.js";
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

  it("franco materializado (motor) no es incompleto plan", () => {
    expect(
      celdaEsIncompletoPlanVis({
        tipo_dia: "franco",
        es_franco: true,
        rda_turno_id: null,
      }),
    ).toBe(false);
  });
});

describe("varianteCeldaOperativa US-6", () => {
  it("prioriza teoria pendiente sobre licencia fucsia", () => {
    expect(
      varianteCeldaOperativa({
        tieneLicencia: true,
        teoriaPendienteLazy: true,
      }),
    ).toBe("teoriaPendiente");
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

describe("varianteCeldaOperativa futuro gris", () => {
  it("día futuro sin licencia usa futuroGris", () => {
    expect(
      varianteCeldaOperativa({
        esFuturoGris: true,
        tieneLicencia: false,
        tieneTurno: true,
      }),
    ).toBe("futuroGris");
  });

  it("día futuro con licencia mantiene variante licencia (estado MDC)", () => {
    expect(
      varianteCeldaOperativa({
        esFuturoGris: true,
        tieneLicencia: true,
        tieneTurno: true,
      }),
    ).toBe("licencia");
  });
});

describe("varianteCeldaOperativa semáforo jefe", () => {
  it("licencia pisa color de semáforo", () => {
    expect(
      varianteCeldaOperativa({
        tieneLicencia: true,
        estadoSemaforoFichada: "ROJO",
        tieneTurno: true,
      }),
    ).toBe("licencia");
  });

  it("sin licencia usa variante semáforo", () => {
    expect(
      varianteCeldaOperativa({
        tieneLicencia: false,
        estadoSemaforoFichada: "VERDE",
        tieneTurno: true,
      }),
    ).toBe("semaforoVerde");
  });
});

describe("textoHorarioTurno hueco", () => {
  it("laborable sin jornada no produce texto turno", () => {
    const cell = { tipo_dia: "laborable" };
    expect(celdaTieneJornadaVis(cell)).toBe(false);
    expect(textoHorarioTurno(cell)).toBe("");
  });

  it("M+N con rda_horario_display muestra tramos reales", () => {
    expect(
      textoHorarioTurno({
        tipo_dia: "laborable",
        rda_turno_id: "M+N",
        rda_ingreso: "06:00",
        rda_egreso: "06:00",
        rda_horario_display: "06:00–14:00 · 22:00–06:00",
        rda_tiene_huecos: true,
      }),
    ).toBe("06:00–14:00 · 22:00–06:00");
  });

  it("M+T continuo usa sobre sin desglosar", () => {
    expect(
      textoHorarioTurno({
        tipo_dia: "laborable",
        rda_turno_id: "M+T",
        rda_ingreso: "06:00",
        rda_egreso: "22:00",
        rda_tiene_huecos: false,
      }),
    ).toBe("06:00–22:00");
  });

  it("M+T+N continuo ignora display antiguo si no hay huecos", () => {
    expect(
      textoHorarioTurno({
        tipo_dia: "laborable",
        rda_turno_id: "M+T+N",
        rda_ingreso: "06:00",
        rda_egreso: "06:00",
        rda_horario_display: "06:00–14:00 · 14:00–22:00 · 22:00–06:00",
        rda_tiene_huecos: false,
      }),
    ).toBe("06:00–06:00");
  });
});

describe("celdaTieneDesalineacionTeoria (US-3 A)", () => {
  it("marca desalineación si turno cambió post-licencia", () => {
    const eventos = [
      {
        teoria_ref: { tipo_dia: "laborable", rda_turno_id: "M", es_franco: false },
      },
    ];
    const cell = { tipo_dia: "laborable", rda_turno_id: "T", es_franco: false };
    expect(celdaTieneDesalineacionTeoria(eventos, cell).desalineado).toBe(true);
  });
});
