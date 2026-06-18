import { describe, expect, it } from "vitest";

import {
  agruparFetchVistaDesdeOps,
  agruparFetchVistaDesdeReferencias,
  parchesVisDesdeRespuestaBatch,
  patchFilasGrillaDesdeParchesVis,
} from "./grillaMesNodosBatchParches.js";

const GDT = "gdt_01";
const P1 = "per_a";
const P2 = "per_b";

describe("agruparFetchVistaDesdeOps", () => {
  it("agrupa intercambio en dos fechas misma persona-mes", () => {
    const ops = [
      {
        tipo: "cobertura_parcial",
        schema_version: 2,
        grupo_trabajo_id: GDT,
        persona_origen_id: P1,
        persona_cobertura_id: P2,
        fecha: "2026-06-10",
        fecha_destino: "2026-06-11",
      },
    ];
    const grupos = agruparFetchVistaDesdeOps(ops);
    expect(grupos).toHaveLength(2);
    const g1 = grupos.find((g) => g.persona_id === P1);
    expect(g1?.fechas.has("2026-06-10")).toBe(true);
    const g2 = grupos.find((g) => g.persona_id === P2);
    expect(g2?.fechas.has("2026-06-11")).toBe(true);
  });

  it("deduplica misma celda en varias ops", () => {
    const ops = [
      {
        tipo: "adicional",
        grupo_trabajo_id: GDT,
        persona_id: P1,
        fechaYmd: "2026-06-05",
      },
      {
        tipo: "adicional",
        grupo_trabajo_id: GDT,
        persona_id: P1,
        fecha: "2026-06-05",
      },
    ];
    const grupos = agruparFetchVistaDesdeOps(ops);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fechas.size).toBe(1);
  });
});

describe("agruparFetchVistaDesdeReferencias", () => {
  it("agrupa refs explícitas por persona-mes", () => {
    const grupos = agruparFetchVistaDesdeReferencias([
      { gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-10" },
      { gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-11" },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fechas.has("2026-06-10")).toBe(true);
    expect(grupos[0].fechas.has("2026-06-11")).toBe(true);
  });
});

describe("patchFilasGrillaDesdeParchesVis", () => {
  it("actualiza dias de la persona afectada", () => {
    const filas = [
      {
        persona_id: P1,
        dias: { "10": { a: 1 }, "11": { b: 2 } },
      },
    ];
    const next = patchFilasGrillaDesdeParchesVis(filas, [
      {
        persona_id: P1,
        fecha_ymd: "2026-06-11",
        gdt: GDT,
        celda: { turno: "N" },
      },
    ]);
    expect(next[0].dias["11"]).toEqual({ b: 2, turno: "N" });
    expect(next[0].dias["10"]).toEqual({ a: 1 });
  });

  it("conserva fichadas_reales si el parche no trae el campo", () => {
    const filas = [
      {
        persona_id: P1,
        dias: {
          "17": {
            rda_turno_id: "M+N",
            fichadas_reales: [{ ingreso: "06:05", egreso: "14:02" }],
          },
        },
      },
    ];
    const next = patchFilasGrillaDesdeParchesVis(filas, [
      {
        persona_id: P1,
        fecha_ymd: "2026-06-17",
        gdt: GDT,
        celda: { rda_turno_id: "M", fichadas_esperadas: 2 },
      },
    ]);
    expect(next[0].dias["17"].rda_turno_id).toBe("M");
    expect(next[0].dias["17"].fichadas_reales).toEqual([{ ingreso: "06:05", egreso: "14:02" }]);
  });

  it("respeta fichadas_reales vacías explícitas en el parche", () => {
    const filas = [
      {
        persona_id: P1,
        dias: {
          "17": {
            fichadas_reales: [{ ingreso: "06:05", egreso: "14:02" }],
          },
        },
      },
    ];
    const next = patchFilasGrillaDesdeParchesVis(filas, [
      {
        persona_id: P1,
        fecha_ymd: "2026-06-17",
        gdt: GDT,
        celda: { fichadas_reales: [] },
      },
    ]);
    expect(next[0].dias["17"].fichadas_reales).toEqual([]);
  });
});

describe("parchesVisDesdeRespuestaBatch", () => {
  it("mapea dias_actualizados al contrato del store", () => {
    const parches = parchesVisDesdeRespuestaBatch({
      ok: true,
      dias_actualizados: [
        {
          persona_id: P1,
          fecha_ymd: "2026-06-10",
          grupo_trabajo_id: GDT,
          celda: { turno: "M" },
        },
      ],
    });
    expect(parches).toHaveLength(1);
    expect(parches[0]).toMatchObject({
      persona_id: P1,
      fecha_ymd: "2026-06-10",
      gdt: GDT,
      celda: { turno: "M" },
    });
  });
});
