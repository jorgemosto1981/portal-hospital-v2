import { describe, expect, it } from "vitest";

import {
  feriadoAplicaAlAgente,
  getVencimientoDocumental,
} from "./plazos.js";

describe("getVencimientoDocumental", () => {
  it("caso base: 2 días laborables, 0 feriados → mismos 2 días", () => {
    const laborables = ["2026-05-10", "2026-05-11"];
    const out = getVencimientoDocumental(laborables, [], ["efx_demo"]);
    expect(out).toEqual(laborables);
  });

  it("feriado global: 3 laborables, 1 feriado global en el medio → 2 días", () => {
    const laborables = ["2026-05-10", "2026-05-11", "2026-05-12"];
    const feriados = [{ fecha: "2026-05-11", alcance_efector_id: null }];
    const out = getVencimientoDocumental(laborables, feriados, ["efx_1"]);
    expect(out).toEqual(["2026-05-10", "2026-05-12"]);
  });

  it("feriado por efector (match): solo efector_A → resta el día", () => {
    const laborables = ["2026-06-02", "2026-06-03"];
    const feriados = [
      { fecha: "2026-06-02", alcance_efector_id: "efector_A" },
    ];
    const out = getVencimientoDocumental(laborables, feriados, ["efector_A"]);
    expect(out).toEqual(["2026-06-03"]);
  });

  it("feriado por efector (no match): agente efector_A, feriado efector_B → no resta", () => {
    const laborables = ["2026-06-09"];
    const feriados = [
      { fecha: "2026-06-09", alcance_efector_id: "efector_B" },
    ];
    const out = getVencimientoDocumental(laborables, feriados, ["efector_A"]);
    expect(out).toEqual(["2026-06-09"]);
  });

  it("multi-efector (OR): feriado en efector_B con agente [A,B] → resta el día", () => {
    const laborables = ["2026-07-01", "2026-07-02"];
    const feriados = [
      { fecha: "2026-07-01", alcance_efector_id: "efector_B" },
    ];
    const out = getVencimientoDocumental(laborables, feriados, [
      "efector_A",
      "efector_B",
    ]);
    expect(out).toEqual(["2026-07-02"]);
  });

  it("robustez: null/undefined en listas no rompe y devuelve array seguro", () => {
    expect(getVencimientoDocumental(null, null, null)).toEqual([]);
    expect(getVencimientoDocumental(undefined, [], undefined)).toEqual([]);
    expect(getVencimientoDocumental([], null, ["e"])).toEqual([]);
    expect(() =>
      getVencimientoDocumental(["2026-01-01"], [{ fecha: "2026-01-01" }], []),
    ).not.toThrow();
    expect(
      getVencimientoDocumental(["2026-01-01"], [{ fecha: "2026-01-01" }], []),
    ).toEqual(["2026-01-01"]);
  });
});

describe("feriadoAplicaAlAgente", () => {
  it("global sin efectores del agente → no aplica feriado global", () => {
    expect(
      feriadoAplicaAlAgente({ fecha: "2026-01-01", alcance_efector_id: null }, []),
    ).toBe(false);
  });
});
