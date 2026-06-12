import { describe, it, expect } from "vitest";

import {
  analiticaCumplimientoDesdeCelda,
  analiticaTieneContenidoVisible,
  microBadgesAnalitica,
  tarjetasAuditoriaCumplimientoJefe,
} from "./grillaAnaliticaCumplimientoUi.js";

describe("grillaAnaliticaCumplimientoUi", () => {
  it("tolera celda sin analitica (meses viejos)", () => {
    expect(analiticaCumplimientoDesdeCelda(null)).toBeNull();
    expect(analiticaCumplimientoDesdeCelda({ rda_ingreso: "08:00" })).toBeNull();
    expect(analiticaTieneContenidoVisible(null)).toBe(false);
    expect(microBadgesAnalitica(null).disciplina).toBeNull();
  });

  it("micro-badge disciplina tardanza", () => {
    const a = {
      disciplina: { fuera_de_margen: true, tardanza_minutos: 15 },
      debito_tiempo: { incumplimiento_carga_horaria: false },
    };
    expect(microBadgesAnalitica(a).disciplina).toBe("▲ 15m");
  });

  it("micro-badge débito contractual", () => {
    const a = {
      disciplina: { fuera_de_margen: false },
      debito_tiempo: { incumplimiento_carga_horaria: true, deficit_minutos: 45 },
    };
    expect(microBadgesAnalitica(a).debito).toBe("-45m");
  });

  it("tarjeta jefe traduce déficit con tolerancia", () => {
    const t = tarjetasAuditoriaCumplimientoJefe({
      disciplina: { fuera_de_margen: false },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        carga_teorica_minutos: 480,
        carga_real_minutos: 435,
        deficit_minutos: 45,
        tolerancia_debitohorario_minutos: 30,
      },
    });
    expect(t.debito).toMatch(/45 minutos/);
    expect(t.debito).toMatch(/30 min/);
  });
});
