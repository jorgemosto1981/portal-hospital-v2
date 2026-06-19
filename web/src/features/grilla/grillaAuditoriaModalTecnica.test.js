import { describe, expect, it } from "vitest";

import {
  formatearMarcasCrudasFichada,
  lineasAlertaAuditoriaModal,
  resumenTeoricoParaAuditoria,
} from "./grillaAuditoriaModalTecnica.js";

describe("grillaAuditoriaModalTecnica", () => {
  it("formatea marcas crudas del reloj", () => {
    const marcas = formatearMarcasCrudasFichada({
      fichadas_reales: [{ tipo: "E", ingreso: "08:01", egreso: "" }],
    });
    expect(marcas).toHaveLength(1);
    expect(marcas[0].ingreso).toBe("08:01");
    expect(marcas[0].egreso).toBe("—");
  });

  it("arma alertas de auditoría con fichada impar", () => {
    const lineas = lineasAlertaAuditoriaModal({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      fichadas_reales: [{ ingreso: "08:00" }],
    });
    expect(lineas.some((l) => l.codigo === "fichada_impar")).toBe(true);
  });

  it("prioriza vis de celda sobre capa_teorica obsoleta del modal", () => {
    const celda = {
      rda_turno_id: "M",
      rda_ingreso: "06:00",
      rda_egreso: "14:00",
      fichadas_esperadas: 2,
      presentacion_compuesto: {
        turno_compuesto_id: "M",
        filas: [{ segmento_id: "s1", teoria_label: "M" }],
      },
    };
    const turnoTeorico = {
      rda_turno_id: "M+T",
      capa_teorica: {
        tipo_dia: "laborable",
        ingreso: "06:00",
        egreso: "22:00",
        fichadas_esperadas: 4,
      },
    };
    const res = resumenTeoricoParaAuditoria(celda, turnoTeorico);
    expect(res.turnoId).toBe("M");
    expect(res.horario).toContain("06:00");
    expect(res.horario).toContain("14:00");
    expect(res.fichadasEsperadas).toBe("2");
  });
});
