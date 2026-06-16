import { describe, it, expect } from "vitest";

import {
  resultadoAnalisisFichadaJefe,
  toleranciasTextoDesdeAnalitica,
} from "./resumenCumplimientoFichadaJefe.js";

describe("resultadoAnalisisFichadaJefe", () => {
  it("RRHH resuelto → horario OK operativo", () => {
    const r = resultadoAnalisisFichadaJefe({
      resuelto_rrhh: true,
      validacion_fichada_dia: { estado_semaforo: "VERDE" },
      analitica_cumplimiento: {
        disciplina: { salida_anticipada_minutos: 45, fuera_de_margen: true },
      },
    });
    expect(r.titulo).toMatch(/RRHH/);
    expect(r.hayDesvioTecnico).toBe(true);
  });

  it("salida anticipada sin RRHH", () => {
    const r = resultadoAnalisisFichadaJefe({
      analitica_cumplimiento: {
        disciplina: { salida_anticipada_minutos: 45, fuera_de_margen: true },
        debito_tiempo: {
          incumplimiento_carga_horaria: false,
          tolerancia_debitohorario_minutos: 30,
        },
      },
    });
    expect(r.titulo).toMatch(/Fuera de margen/);
  });
});

describe("toleranciasTextoDesdeAnalitica", () => {
  it("expone límites nominal y con gracia", () => {
    const lines = toleranciasTextoDesdeAnalitica({
      disciplina: {
        ingreso_nominal_iso: "2026-06-13T09:00:00.000Z",
        ingreso_limite_con_gracia_iso: "2026-06-13T09:15:00.000Z",
        egreso_nominal_iso: "2026-06-13T17:00:00.000Z",
        egreso_limite_con_gracia_iso: "2026-06-13T16:45:00.000Z",
      },
      debito_tiempo: { tolerancia_debitohorario_minutos: 30 },
    });
    expect(lines.some((l) => l.includes("margen de cortesía"))).toBe(true);
    expect(lines.some((l) => l.includes("30 min"))).toBe(true);
  });
});
