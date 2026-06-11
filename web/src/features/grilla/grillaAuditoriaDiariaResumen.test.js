import { describe, expect, it } from "vitest";

import {
  calcularAuditoriaDiariaSector,
  celdaTieneFichadaImpar,
} from "./grillaAuditoriaDiariaResumen.js";

const PERIODO = { anio: 2026, mes: 6, grupoSeleccionado: "gdt_porteria" };

describe("celdaTieneFichadaImpar", () => {
  it("detecta entrada sin salida", () => {
    expect(
      celdaTieneFichadaImpar({
        tipo_dia: "laborable",
        fichadas_esperadas: 2,
        fichadas_reales: [{ ingreso: "08:00" }],
      }),
    ).toBe(true);
  });

  it("ignora celda sin capa fichada", () => {
    expect(
      celdaTieneFichadaImpar({
        tipo_dia: "laborable",
        rda_turno_id: "M",
      }),
    ).toBe(false);
  });
});

describe("calcularAuditoriaDiariaSector", () => {
  it("devuelve ceros sin filas", () => {
    const r = calcularAuditoriaDiariaSector([], PERIODO);
    expect(r.contadores).toEqual({
      fichadasInconsistentes: 0,
      fichadasImpares: 0,
      teoriasPendientes: 0,
      bloqueosLiquidacion: 0,
    });
    expect(r.itemsCriticos).toEqual([]);
  });

  it("cuenta fichada inconsistente (ausente con jornada esperada)", () => {
    const filas = [
      {
        persona_id: "per_1",
        persona_label: "García, Ana",
        fila_id: "per_1__hlg_1",
        hlg_id: "hlg_1",
        vigente_desde: "2026-06-01",
        vigente_hasta: "2026-06-30",
        dias: {
          "15": {
            tipo_dia: "laborable",
            rda_turno_id: "M",
            fichadas_reales: [],
            fichadas_esperadas: 2,
          },
        },
      },
    ];
    const r = calcularAuditoriaDiariaSector(filas, PERIODO);
    expect(r.contadores.fichadasInconsistentes).toBe(1);
    expect(r.itemsCriticos[0]?.tipo).toBe("fichada_inconsistente");
    expect(r.itemsCriticos[0]?.fechaYmd).toBe("2026-06-15");
  });

  it("cuenta teoría pendiente con licencia y materializado lazy", () => {
    const filas = [
      {
        persona_id: "per_2",
        persona_label: "López, Juan",
        materializado_lazy: true,
        vigente_desde: "2026-06-01",
        vigente_hasta: "2026-06-30",
        dias: {
          "10": {
            tipo_dia: "laborable",
            eventos: [{ codigo_grilla: "ART" }],
          },
        },
      },
    ];
    const r = calcularAuditoriaDiariaSector(filas, PERIODO);
    expect(r.contadores.teoriasPendientes).toBe(1);
    expect(r.itemsCriticos.some((i) => i.tipo === "teoria_pendiente")).toBe(true);
  });

  it("limita items críticos a 5 priorizando bloqueos", () => {
    const dias = {};
    for (let d = 1; d <= 8; d += 1) {
      const key = String(d).padStart(2, "0");
      dias[key] = {
        tipo_dia: "laborable",
        rda_turno_id: "M",
        eventos: [{ codigo_grilla: "X", estado_solicitud_id: "cfg_esa_en_revision_rrhh" }],
      };
    }
    const filas = [
      {
        persona_id: "per_3",
        persona_label: "Equipo",
        vigente_desde: "2026-06-01",
        vigente_hasta: "2026-06-30",
        dias,
      },
    ];
    const r = calcularAuditoriaDiariaSector(filas, PERIODO);
    expect(r.contadores.bloqueosLiquidacion).toBe(8);
    expect(r.itemsCriticos.length).toBe(5);
    expect(r.itemsCriticos.every((i) => i.tipo === "bloqueo_liquidacion")).toBe(true);
  });
});
