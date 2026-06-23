import { describe, expect, it } from "vitest";

import { turnoTeoricoDesdeCeldaVis } from "./grillaTurnoTeoricoDesdeVis.js";

describe("turnoTeoricoDesdeCeldaVis", () => {
  it("arma capa desde presentacion_compuesto y rda_*", () => {
    const tt = turnoTeoricoDesdeCeldaVis({
      rda_turno_id: "T",
      rda_ingreso: "14:00",
      rda_egreso: "22:00",
      fichadas_esperadas: 2,
      presentacion_compuesto: {
        turno_compuesto_id: "T",
        filas: [{ segmento_id: "seg-t", teoria_label: "T" }],
      },
    });
    expect(tt?.rda_turno_id).toBe("T");
    expect(tt?.capa_teorica?.turno_compuesto_id).toBe("T");
    expect(tt?.capa_teorica?.segmentos).toHaveLength(1);
    expect(tt?.presentacion_compuesto?.filas).toHaveLength(1);
  });

  it("saldo cero tras traslados: presentación fantasma T → franco en modal", () => {
    const tt = turnoTeoricoDesdeCeldaVis({
      tipo_dia: "laborable",
      es_franco: false,
      presentacion_compuesto: { turno_compuesto_id: "T", filas: [] },
    });
    expect(tt?.es_franco).toBe(true);
    expect(tt?.capa_teorica?.tipo_dia).toBe("franco");
    expect(tt?.capa_teorica?.turno_compuesto_id).toBeNull();
  });
});
