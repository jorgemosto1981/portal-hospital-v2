import { describe, expect, it } from "vitest";
import { etiquetaCeldaAprobada } from "./planGrillaAprobadaDisplay.js";

describe("etiquetaCeldaAprobada", () => {
  it("fijo: muestra horario compacto sin turno_id técnico", () => {
    expect(
      etiquetaCeldaAprobada({
        tipo_dia: "laborable",
        turno_id: "cfg_reg_turno_01_manana",
        ingreso: "08:00",
        egreso: "14:00",
      }),
    ).toBe("08-14");
  });

  it("no_laborable y franco", () => {
    expect(etiquetaCeldaAprobada({ tipo_dia: "no_laborable" })).toBe("NL");
    expect(etiquetaCeldaAprobada({ tipo_dia: "franco", es_franco: true })).toBe("F");
  });

  it("sin horario: etiqueta corta desde turno_id cfg", () => {
    expect(
      etiquetaCeldaAprobada({
        tipo_dia: "laborable",
        turno_id: "cfg_reg_turno_02_tarde",
      }),
    ).toBe("Tarde");
  });
});
