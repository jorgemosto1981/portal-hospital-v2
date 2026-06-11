import { describe, expect, it } from "vitest";

import {
  buildPaletaEditorPlanMensual,
  horarioPlanificadoPorTurnoRegimen,
  parseTurnoCompuestoIds,
  turnoPermitidoEnRegimenPlan,
} from "./planPaletaTurnosUtils.js";

const COLORES = [{ bg: "bg-a", text: "text-a" }];

describe("planPaletaTurnosUtils", () => {
  it("parseTurnoCompuestoIds separa por +", () => {
    expect(parseTurnoCompuestoIds("M+T+N")).toEqual(["M", "T", "N"]);
    expect(parseTurnoCompuestoIds(" cfg_a+cfg_b ")).toEqual(["cfg_a", "cfg_b"]);
  });

  it("horario compuesto concatena tramos del régimen", () => {
    const regimen = {
      tipo_patron: "planificado",
      turnos_disponibles: [
        { turno_id: "M", ingreso: "06:00", egreso: "14:00" },
        { turno_id: "T", ingreso: "14:00", egreso: "22:00" },
      ],
    };
    expect(horarioPlanificadoPorTurnoRegimen(regimen, "M+T")).toBe("06:00-14:00 · 14:00-22:00");
  });

  it("paleta por régimen: unión y permiso por fila", () => {
    const regimenes = {
      reg_a: {
        tipo_patron: "planificado",
        turnos_disponibles: [
          { turno_id: "M", etiqueta: "Mañana" },
          { turno_id: "M+T", etiqueta: "Doble" },
        ],
      },
      reg_b: {
        tipo_patron: "planificado",
        turnos_disponibles: [{ turno_id: "N", etiqueta: "Noche" }],
      },
    };
    const agentes = [
      { regimen_horario_id: "reg_a" },
      { regimen_horario_id: "reg_b" },
    ];
    const { turnosPaleta, permitidosPorRegimen } = buildPaletaEditorPlanMensual(
      regimenes,
      agentes,
      COLORES,
    );
    expect(Object.keys(turnosPaleta).sort()).toEqual(["M", "M+T", "N"]);
    expect(turnoPermitidoEnRegimenPlan(permitidosPorRegimen, "reg_a", "M+T")).toBe(true);
    expect(turnoPermitidoEnRegimenPlan(permitidosPorRegimen, "reg_b", "M+T")).toBe(false);
  });
});
