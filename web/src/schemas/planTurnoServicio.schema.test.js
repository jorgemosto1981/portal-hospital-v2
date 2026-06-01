import { describe, expect, it } from "vitest";
import { guardarPlanMensualDatosSchema } from "./planTurnoServicio.schema.js";

describe("guardarPlanMensualDatosSchema", () => {
  it("acepta intención mínima por día", () => {
    const r = guardarPlanMensualDatosSchema.safeParse({
      grupo_id: "gdt_01",
      tipo_plan: "mensual",
      periodo: "2026-06",
      agentes: [
        {
          persona_id: "per_1",
          regimen_horario_id: "rh_1",
          hlg_id: "hlg_1",
          dias: { "2026-06-01": { tipo_dia: "laborable", turno_id: "M" } },
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza más de 50 agentes", () => {
    const agentes = Array.from({ length: 51 }, (_, i) => ({
      persona_id: `per_${i}`,
      regimen_horario_id: "rh_1",
      hlg_id: "hlg_1",
      dias: {},
    }));
    const r = guardarPlanMensualDatosSchema.safeParse({
      grupo_id: "gdt_01",
      tipo_plan: "mensual",
      periodo: "2026-06",
      agentes,
    });
    expect(r.success).toBe(false);
  });
});
