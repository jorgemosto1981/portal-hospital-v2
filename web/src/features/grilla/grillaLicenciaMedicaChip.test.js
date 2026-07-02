import { describe, it, expect } from "vitest";
import {
  renderChipLicenciaMedica,
  FASE_MOTOR_S_MED_LARGA,
  COLOR_CHIP_LM_LARGA,
} from "./grillaLicenciaMedicaChip.js";
import { etiquetaCelda, estiloVisualCelda, lineasTooltipCelda } from "./grillaMesCellUtils.js";

describe("renderChipLicenciaMedica", () => {
  it("devuelve LM-L y tooltip con CIE-10 cuando fase_motor es S_MED_LARGA", () => {
    const chip = renderChipLicenciaMedica({
      codigo_grilla: "LM",
      fase_motor: FASE_MOTOR_S_MED_LARGA,
      cie10_codigo: "J06.9",
    });
    expect(chip?.esLarga).toBe(true);
    expect(chip?.label).toBe("LM-L");
    expect(chip?.tooltip).toContain("J06.9");
    expect(chip?.colorUi).toBe(COLOR_CHIP_LM_LARGA);
  });

  it("mantiene LM corta sin fase_motor larga", () => {
    const chip = renderChipLicenciaMedica({
      codigo_grilla: "LM",
      estado_solicitud_id: "cfg_esa_aprobada",
    });
    expect(chip?.esLarga).toBe(false);
    expect(chip?.label).toBe("LM");
    expect(chip?.tooltip).toContain("Art. 14");
  });

  it("no altera códigos no LM", () => {
    expect(renderChipLicenciaMedica({ codigo_grilla: "64-A" })).toBe(null);
  });
});

describe("grillaMesCellUtils integración LM larga", () => {
  const eventosLargaPendiente = [
    {
      solicitud_id: "sol_larga",
      codigo_grilla: "LM-L",
      fase_motor: FASE_MOTOR_S_MED_LARGA,
      cie10_codigo: "J06.9",
      estado_solicitud_id: "cfg_esa_en_revision_jefe",
      color_ui: "#F59E0B",
    },
  ];

  it("etiquetaCelda muestra LM-L", () => {
    expect(etiquetaCelda(eventosLargaPendiente)).toBe("LM-L");
  });

  it("estilo pendiente larga usa borde violeta", () => {
    const est = estiloVisualCelda(eventosLargaPendiente);
    expect(est.className).toContain("border-violet");
  });

  it("estilo aprobada larga usa fondo violeta institucional", () => {
    const eventos = [
      {
        ...eventosLargaPendiente[0],
        estado_solicitud_id: "cfg_esa_aprobada",
        color_ui: "#3B82F6",
      },
    ];
    const est = estiloVisualCelda(eventos);
    expect(est.style.backgroundColor).toBe(COLOR_CHIP_LM_LARGA);
  });

  it("estilo en junta médica larga usa borde violeta transicional", () => {
    const eventos = [
      {
        solicitud_id: "sol_junta",
        codigo_grilla: "LM-L",
        fase_motor: FASE_MOTOR_S_MED_LARGA,
        estado_solicitud_id: "cfg_esa_esperando_dictamen_junta",
        color_ui: "#F59E0B",
      },
    ];
    const est = estiloVisualCelda(eventos);
    expect(est.style.backgroundColor).toBe("#F59E0B");
    expect(est.className).toContain("border-violet");
  });
});
