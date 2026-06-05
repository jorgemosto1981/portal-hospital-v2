import { describe, it, expect } from "vitest";
import {
  celdaTieneImputacionExterna,
  estiloVisualCelda,
  lineasTooltipCelda,
} from "./grillaMesCellUtils.js";

describe("grillaMesCellUtils imputación externa", () => {
  const eventos = [
    {
      solicitud_id: "sol_1",
      codigo_grilla: "68-B",
      estado_solicitud_id: "cfg_esa_en_revision_jefe",
      grupo_trabajo_id_ancla: "gdt_oficina",
    },
  ];

  it("detecta imputación en otro grupo", () => {
    expect(celdaTieneImputacionExterna(eventos, "gdt_sala")).toBe(true);
    expect(celdaTieneImputacionExterna(eventos, "gdt_oficina")).toBe(false);
  });

  it("aplica estilo gris en vista ajena", () => {
    const ext = estiloVisualCelda(eventos, { grupoVistaId: "gdt_sala" });
    expect(ext.className).toContain("slate");
  });

  it("tooltip indica grupo ancla", () => {
    const lines = lineasTooltipCelda(eventos, {
      grupoVistaId: "gdt_sala",
      etiquetasGrupo: { gdt_oficina: "Oficina PERSONAL" },
    });
    expect(lines.some((l) => l.includes("Imputada en: Oficina PERSONAL"))).toBe(true);
  });
});
