import { describe, expect, it } from "vitest";

import { mergeCeldaNodoConFallback } from "./grillaDiaCeldaMerge.js";

describe("mergeCeldaNodoConFallback", () => {
  it("store gana sobre fallback cuando no hay pending (post-batch)", () => {
    const merged = mergeCeldaNodoConFallback({
      fromStore: { turno: "N", revision_vis: 5 },
      fallback: { turno: "M", revision_vis: 2 },
      pending: false,
    });
    expect(merged).toEqual({ turno: "N", revision_vis: 5 });
  });

  it("pending mezcla fallback base con overlay del store", () => {
    const merged = mergeCeldaNodoConFallback({
      fromStore: { preview: true },
      fallback: { turno: "M" },
      pending: true,
    });
    expect(merged).toEqual({ turno: "M", preview: true });
  });

  it("mostrarResultadoFinal prioriza store si existe", () => {
    const merged = mergeCeldaNodoConFallback({
      fromStore: { turno: "N" },
      fallback: { turno: "M" },
      mostrarResultadoFinal: true,
    });
    expect(merged).toEqual({ turno: "N" });
  });

  it("sin store usa fallback", () => {
    const merged = mergeCeldaNodoConFallback({
      fromStore: null,
      fallback: { turno: "T" },
      pending: false,
    });
    expect(merged).toEqual({ turno: "T" });
  });
});
