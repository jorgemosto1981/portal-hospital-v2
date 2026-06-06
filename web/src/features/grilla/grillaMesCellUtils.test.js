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

  it("usa color_ui de imputación en cualquier calendario (mismo tono)", () => {
    const aprobada = [
      {
        ...eventos[0],
        estado_solicitud_id: "cfg_esa_aprobada",
        color_ui: "#3B82F6",
      },
    ];
    const ext = estiloVisualCelda(aprobada, { grupoVistaId: "gdt_sala" });
    expect(ext.style.backgroundColor).toBe("#3B82F6");
    expect(ext.className).toContain("text-white");
  });

  it("pendiente mantiene ámbar aunque sea imputación externa", () => {
    const ext = estiloVisualCelda(eventos, { grupoVistaId: "gdt_sala" });
    expect(ext.style.backgroundColor).toBe("#F59E0B");
  });

  it("tooltip indica grupo ancla", () => {
    const lines = lineasTooltipCelda(eventos, {
      grupoVistaId: "gdt_sala",
      etiquetasGrupo: { gdt_oficina: "Oficina PERSONAL" },
    });
    expect(lines.some((l) => l.includes("🔗 Licencia gestionada en otro sector (Oficina PERSONAL)"))).toBe(
      true,
    );
  });
});
