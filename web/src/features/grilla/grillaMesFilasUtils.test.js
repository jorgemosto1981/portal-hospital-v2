import { describe, it, expect } from "vitest";
import { normalizarFilasGrillaEquipo, diaFueraTramoHlg, diaFueraVigenciaTramo, formatearRangoTramoMes, etiquetaCargaTramo } from "./grillaMesFilasUtils.js";

describe("grillaMesFilasUtils", () => {
  it("genera fila_id cuando falta en payload legacy", () => {
    const [fila] = normalizarFilasGrillaEquipo([
      { persona_id: "per_1", hlg_id: "hlg_a", persona_label: "Agente · 12 hs", dias: { "01": {} } },
    ]);
    expect(fila.fila_id).toBe("per_1__hlg_a");
    expect(fila.carga_horaria_semanal).toBeNull();
  });

  it("diaFueraTramoHlg cuando la clave no existe en dias", () => {
    expect(diaFueraTramoHlg({ "10": {}, "11": {} }, "09")).toBe(true);
    expect(diaFueraTramoHlg({ "10": {}, "11": {} }, "10")).toBe(false);
  });

  it("diaFueraVigenciaTramo acota por vigente_desde/hasta", () => {
    expect(diaFueraVigenciaTramo("2026-06-09", "2026-06-01", "2026-06-10")).toBe(false);
    expect(diaFueraVigenciaTramo("2026-06-11", "2026-06-01", "2026-06-10")).toBe(true);
    expect(diaFueraVigenciaTramo("2026-06-11", "2026-06-11", "2026-06-30")).toBe(false);
  });

  it("formatearRangoTramoMes y etiquetaCargaTramo", () => {
    expect(formatearRangoTramoMes("2026-06-01", "2026-06-10")).toBe("01/06–10/06");
    expect(etiquetaCargaTramo(12)).toBe("12 hs");
  });
});
