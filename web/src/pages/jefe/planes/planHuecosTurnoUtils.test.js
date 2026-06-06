import { describe, expect, it } from "vitest";

import {
  celdaEsHuecoTurnoPlan,
  contarHuecosEnPlanMensual,
  contarHuecosTurnoPlan,
} from "./planHuecosTurnoUtils.js";

describe("celdaEsHuecoTurnoPlan (US-10)", () => {
  it("laborable sin turno_id es hueco", () => {
    expect(celdaEsHuecoTurnoPlan({ tipo_dia: "laborable", turno_id: null })).toBe(true);
    expect(celdaEsHuecoTurnoPlan({ tipo_dia: "guardia", turno_id: "" })).toBe(true);
  });

  it("franco o con turno no es hueco", () => {
    expect(celdaEsHuecoTurnoPlan({ tipo_dia: "franco", turno_id: null })).toBe(false);
    expect(celdaEsHuecoTurnoPlan({ tipo_dia: "laborable", turno_id: "T1" })).toBe(false);
  });
});

describe("contarHuecosTurnoPlan", () => {
  it("suma celdas incompletas por agente", () => {
    const agentes = [{ persona_id: "p1" }];
    const grilla = {
      p1: {
        "2026-06-01": { tipo_dia: "laborable", turno_id: "M" },
        "2026-06-02": { tipo_dia: "laborable", turno_id: null },
      },
    };
    expect(contarHuecosTurnoPlan(agentes, grilla)).toBe(1);
  });
});

describe("contarHuecosEnPlanMensual", () => {
  it("lee agentes[].dias del plan", () => {
    expect(
      contarHuecosEnPlanMensual({
        agentes: [
          {
            persona_id: "p1",
            dias: { "2026-06-03": { tipo_dia: "guardia", turno_id: null } },
          },
        ],
      }),
    ).toBe(1);
  });
});
