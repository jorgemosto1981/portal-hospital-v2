import { describe, expect, it } from "vitest";

import {
  overrideAfectaCelda,
  tarjetaResumenOverride,
} from "./grillaGestionTurnoHistorial.js";

describe("grillaGestionTurnoHistorial", () => {
  it("reemplazo v2 sin persona_id en override afecta origen y destino del mismo agente", () => {
    const ovOrigen = {
      tipo: "reemplazo",
      reemplazo_traslado_v2: "origen",
      fecha_origen: "2026-06-10",
      fecha_destino: "2026-06-12",
      segmentos_a_trasladar: ["cfg_reg_turno_t"],
      franco_en_origen: true,
      grupo_de_trabajo_id: "gdt_x",
    };
    const ovDestino = {
      tipo: "reemplazo",
      reemplazo_traslado_v2: "destino",
      fecha_origen: "2026-06-10",
      fecha_destino: "2026-06-12",
      segmentos_incorporados_destino: ["cfg_reg_turno_t"],
      turno_id: "cfg_reg_turno_t",
      grupo_de_trabajo_id: "gdt_x",
    };
    const pid = "per_campo";
    expect(overrideAfectaCelda(ovOrigen, pid, "2026-06-10")).toBe(true);
    expect(overrideAfectaCelda(ovDestino, pid, "2026-06-12")).toBe(true);
    expect(overrideAfectaCelda(ovOrigen, pid, "2026-06-11")).toBe(false);
  });

  it("tarjetaResumenOverride reemplazo origen con franco", () => {
    const card = tarjetaResumenOverride(
      {
        tipo: "reemplazo",
        fecha_origen: "2026-06-10",
        fecha_destino: "2026-06-12",
        segmentos_a_trasladar: ["cfg_reg_turno_t"],
        franco_en_origen: true,
        creado_en: "2026-06-17T12:00:00.000Z",
      },
      "per_campo",
      "2026-06-10",
      { turnosPorId: { cfg_reg_turno_t: { codigo_interno: "T" } } },
    );
    expect(card.quePaso).toMatch(/trasladó/i);
    expect(card.quePaso).toMatch(/franco/i);
    expect(card.enCaracterDe).toBe("Cambio de turno propio");
  });
});
