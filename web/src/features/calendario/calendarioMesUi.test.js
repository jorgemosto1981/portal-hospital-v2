import { describe, expect, it } from "vitest";

import {
  OFFSETS_MES_CONSULTA,
  labelMesCorto,
  mesActualBa,
  sumarMeses,
  ventanaMesesConsulta,
} from "./calendarioMesUi.js";

describe("calendarioMesUi ventana consulta", () => {
  it("tiene 5 offsets -2..+2", () => {
    expect([...OFFSETS_MES_CONSULTA]).toEqual([-2, -1, 0, 1, 2]);
  });

  it("suma meses cruzando año", () => {
    expect(sumarMeses(2026, 1, -2)).toEqual({ year: 2025, month: 11 });
    expect(sumarMeses(2025, 12, 2)).toEqual({ year: 2026, month: 2 });
  });

  it("ventana relativa a ancla fija", () => {
    const rows = ventanaMesesConsulta(2026, 7);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => `${r.year}-${r.month}`)).toEqual([
      "2026-5",
      "2026-6",
      "2026-7",
      "2026-8",
      "2026-9",
    ]);
    expect(rows[2].offset).toBe(0);
    expect(labelMesCorto(2026, 7)).toMatch(/jul/i);
  });

  it("mesActualBa parsea ymd", () => {
    expect(mesActualBa("2026-07-14")).toEqual({ year: 2026, month: 7 });
  });
});
