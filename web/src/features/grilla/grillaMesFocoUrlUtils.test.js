import { describe, expect, it } from "vitest";

import {
  buildGrillaFocoSearchParams,
  GRILLA_FOCO_MODO_URL,
  parseModoFocoUrl,
  parsePeriodoFocoUrl,
} from "./grillaMesFocoUrlUtils.js";

describe("grillaMesFocoUrlUtils", () => {
  it("parsePeriodoFocoUrl acepta YYYY-MM válido", () => {
    expect(parsePeriodoFocoUrl("2026-06")).toBe("2026-06");
    expect(parsePeriodoFocoUrl("2026-13")).toBeNull();
    expect(parsePeriodoFocoUrl("")).toBeNull();
  });

  it("buildGrillaFocoSearchParams escribe y limpia query", () => {
    const q = buildGrillaFocoSearchParams({
      grupoId: "gdt_abc",
      periodo: "2026-06",
    });
    expect(q.get("grupo_id")).toBe("gdt_abc");
    expect(q.get("periodo")).toBe("2026-06");

    const vacio = buildGrillaFocoSearchParams({ grupoId: "", periodo: "2026-06" }, q);
    expect(vacio.get("grupo_id")).toBeNull();
    expect(vacio.get("periodo")).toBe("2026-06");
  });

  it("modo titular sin grupo_id y se elimina al fijar grupo", () => {
    const titular = buildGrillaFocoSearchParams({
      modo: GRILLA_FOCO_MODO_URL.TITULAR,
      periodo: "2026-06",
    });
    expect(titular.get("modo")).toBe("titular");
    expect(titular.get("grupo_id")).toBeNull();

    const equipo = buildGrillaFocoSearchParams(
      { grupoId: "gdt_x", periodo: "2026-06" },
      titular,
    );
    expect(equipo.get("grupo_id")).toBe("gdt_x");
    expect(equipo.get("modo")).toBeNull();
  });

  it("parseModoFocoUrl", () => {
    expect(parseModoFocoUrl("titular")).toBe("titular");
    expect(parseModoFocoUrl("equipo")).toBeNull();
  });
});
