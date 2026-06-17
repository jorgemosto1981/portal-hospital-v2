import { describe, it, expect } from "vitest";
import {
  celdaEsDiaFuturoInstitucional,
  estadoSemaforoPinturaCeldaJefe,
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

describe("estadoSemaforoPinturaCeldaJefe", () => {
  const celdaAusente = {
    tipo_dia: "laborable",
    fichadas_esperadas: 2,
    fichadas_reales: [],
    rda_turno_id: "N",
    rda_ingreso: "22:00",
    rda_egreso: "06:00",
    capa_fichada_cargada: true,
  };

  it("ausente sin marcas: AMARILLO persistido → pintura ROJO", () => {
    expect(estadoSemaforoPinturaCeldaJefe("AMARILLO", celdaAusente, "2026-06-16")).toBe("ROJO");
  });

  it("con fichada parcial mantiene AMARILLO", () => {
    const celda = {
      ...celdaAusente,
      fichadas_reales: [{ ingreso: "14:15", egreso: "21:35", fecha_ymd: "2026-06-14" }],
    };
    expect(estadoSemaforoPinturaCeldaJefe("AMARILLO", celda, "2026-06-14")).toBe("AMARILLO");
  });
});
