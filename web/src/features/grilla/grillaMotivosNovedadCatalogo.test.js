import { describe, expect, it } from "vitest";

import { componerMotivoNovedadGso } from "./grillaMotivosNovedadCatalogo.js";

describe("componerMotivoNovedadGso", () => {
  it("prefija código y label del catálogo", () => {
    expect(componerMotivoNovedadGso("urgencia_operativa", "pico de demanda")).toBe(
      "[URG_OPE] Urgencia operativa: pico de demanda",
    );
  });
});
