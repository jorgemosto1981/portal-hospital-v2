import { describe, expect, it } from "vitest";

import {
  formatearMarcasCrudasFichada,
  lineasAlertaAuditoriaModal,
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
});
