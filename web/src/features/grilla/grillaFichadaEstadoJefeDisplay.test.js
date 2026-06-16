import { describe, it, expect } from "vitest";
import {
  celdaEsDiaFuturoInstitucional,
  semaforoFichadaDesdeCelda,
} from "./grillaFichadaEstadoJefeDisplay.js";

describe("semaforoFichadaDesdeCelda", () => {
  it("lee validacion_fichada_dia compacta", () => {
    const r = semaforoFichadaDesdeCelda(
      {
        validacion_fichada_dia: {
          estado_semaforo: "AMARILLO",
          texto_resumen: "Sin marcas registradas",
        },
      },
      { fechaYmd: "2026-06-12" },
    );
    expect(r?.estado).toBe("AMARILLO");
    expect(r?.tooltip).toContain("marcas");
  });

  it("no semáforo en día futuro", () => {
    expect(celdaEsDiaFuturoInstitucional("2099-01-01")).toBe(true);
    expect(semaforoFichadaDesdeCelda({ validacion_fichada_dia: { estado_semaforo: "VERDE" } }, { fechaYmd: "2099-01-01" })).toBeNull();
  });
});
