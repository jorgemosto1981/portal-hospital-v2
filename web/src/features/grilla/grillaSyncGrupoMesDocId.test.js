import { describe, expect, it } from "vitest";

import { buildGrillaSyncGrupoMesDocId } from "./grillaSyncGrupoMesDocId.js";

describe("buildGrillaSyncGrupoMesDocId", () => {
  it("arma doc id alineado al backend", () => {
    expect(buildGrillaSyncGrupoMesDocId("gdt_01ABC", "2026-06")).toBe("gdt_01ABC_2026_06");
  });

  it("rechaza params inválidos", () => {
    expect(buildGrillaSyncGrupoMesDocId("", "2026-06")).toBe("");
    expect(buildGrillaSyncGrupoMesDocId("gdt_x", "invalid")).toBe("");
  });
});
