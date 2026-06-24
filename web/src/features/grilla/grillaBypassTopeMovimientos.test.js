import { describe, expect, it } from "vitest";

import {
  batchCtxDesdeBypass,
  validarBypassTopeMovimientos,
} from "./grillaBypassTopeMovimientos.js";

describe("validarBypassTopeMovimientos", () => {
  it("inactivo no envía bypass", () => {
    const r = validarBypassTopeMovimientos({ activo: false, motivo: "" });
    expect(r.ok).toBe(true);
    expect(r.bypassTopeMovimientos).toBe(false);
    expect(batchCtxDesdeBypass(r)).toEqual({});
  });

  it("activo exige motivo mínimo 3 caracteres", () => {
    expect(validarBypassTopeMovimientos({ activo: true, motivo: "ab" }).ok).toBe(false);
    const r = validarBypassTopeMovimientos({ activo: true, motivo: "  abc  " });
    expect(r.ok).toBe(true);
    expect(r.motivoBypassTope).toBe("abc");
    expect(batchCtxDesdeBypass(r)).toEqual({
      bypassTopeMovimientos: true,
      motivoBypassTope: "abc",
    });
  });
});
