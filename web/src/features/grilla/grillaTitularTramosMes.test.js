import { describe, it, expect } from "vitest";
import { hlgSegmentosTitularMes } from "./grillaTitularTramosMes.js";

describe("grillaTitularTramosMes", () => {
  it("genera dos tramos para mismo gdt en junio 2026", () => {
    const tramos = hlgSegmentosTitularMes(
      [
        {
          id: "hlg_a",
          persona_id: "per_m",
          grupo_de_trabajo_id: "gdt_sala",
          fecha_inicio: "2026-02-02",
          fecha_fin: "2026-06-10",
          activo: true,
        },
        {
          id: "hlg_b",
          persona_id: "per_m",
          grupo_de_trabajo_id: "gdt_sala",
          fecha_inicio: "2026-06-11",
          fecha_fin: null,
          activo: true,
        },
      ],
      2026,
      6,
    );
    expect(tramos).toHaveLength(2);
    expect(tramos[0].grupo_de_trabajo_id).toBe("gdt_sala");
    expect(tramos[0].vigente_hasta).toBe("2026-06-10");
    expect(tramos[1].vigente_desde).toBe("2026-06-11");
    expect(tramos[0].calendario_id).toBe("per_m__hlg_a");
    expect(tramos[1].calendario_id).toBe("per_m__hlg_b");
  });
});
