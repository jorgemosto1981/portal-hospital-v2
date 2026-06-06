import { describe, it, expect } from "vitest";
import {
  agentesGrillaNecesitanTramos,
  enriquecerGrillaAprobadaConPersonasGrupo,
} from "./planGrillaTramosUtils.js";

describe("planGrillaTramosUtils", () => {
  it("agentesGrillaNecesitanTramos cuando falta vigencia", () => {
    expect(agentesGrillaNecesitanTramos([{ hlg_id: "h1", persona_id: "p1" }])).toBe(true);
    expect(
      agentesGrillaNecesitanTramos([
        { hlg_id: "h1", vigente_desde: "2026-06-01", vigente_hasta: "2026-06-10" },
      ]),
    ).toBe(false);
  });

  it("enriquecerGrillaAprobadaConPersonasGrupo por fila_id/hlg_id", () => {
    const grilla = {
      periodo: "2026-06",
      agentes: [
        { persona_id: "per_m", hlg_id: "hlg_a", dias: {} },
        { persona_id: "per_m", hlg_id: "hlg_b", dias: {} },
      ],
    };
    const personasGrupo = [
      {
        persona_id: "per_m",
        hlg_id: "hlg_a",
        fila_id: "per_m__hlg_a",
        vigente_desde: "2026-06-01",
        vigente_hasta: "2026-06-10",
        regimen_horario_id: "reg_12",
      },
      {
        persona_id: "per_m",
        hlg_id: "hlg_b",
        fila_id: "per_m__hlg_b",
        vigente_desde: "2026-06-11",
        vigente_hasta: "2026-06-30",
        regimen_horario_id: "reg_40",
      },
    ];
    const regimenes = {
      reg_12: { tipo_patron: "planificado", carga_horaria_semanal_teorica: 12 },
      reg_40: { tipo_patron: "planificado", carga_horaria_semanal_teorica: 40 },
    };

    const out = enriquecerGrillaAprobadaConPersonasGrupo(grilla, personasGrupo, regimenes);
    expect(out.agentes).toHaveLength(2);
    expect(out.agentes[0].vigente_desde).toBe("2026-06-01");
    expect(out.agentes[0].carga_horaria_semanal).toBe(12);
    expect(out.agentes[1].vigente_hasta).toBe("2026-06-30");
    expect(out.agentes[1].carga_horaria_semanal).toBe(40);
  });
});
