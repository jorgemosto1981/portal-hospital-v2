import { describe, expect, it } from "vitest";

import { periodosVentanaJefe } from "../jefe/periodoJefe.js";
import {
  bloqueaCrearPlanHistorico,
  debeAdvertirCambioFocoConOutbox,
  esHorizonteCierre,
  inferirFocoDesdeOpsOutbox,
  HORIZONTE_CONSOLA_IDX,
  indiceHorizonteEnVentana,
  opsOutboxFueraDeFoco,
  resolverFocoOrigenOutbox,
  resolverIntencionTarjetaConsola,
  resolverPeriodoFocoEnVentana,
  validarOutboxCoherenteVentana,
} from "./planRefinamientoConsolaUtils.js";

describe("indiceHorizonteEnVentana", () => {
  const ventana = ["2026-05", "2026-06", "2026-07"];

  it("mapea M−1 / M / M+1", () => {
    expect(indiceHorizonteEnVentana("2026-05", ventana)).toBe(
      HORIZONTE_CONSOLA_IDX.MES_ANTERIOR_CIERRE,
    );
    expect(indiceHorizonteEnVentana("2026-06", ventana)).toBe(
      HORIZONTE_CONSOLA_IDX.MES_ACTUAL_OPERACION,
    );
    expect(indiceHorizonteEnVentana("2026-07", ventana)).toBe(
      HORIZONTE_CONSOLA_IDX.MES_PROXIMO_PLANIFICACION,
    );
  });

  it("fuera de ventana → null", () => {
    expect(indiceHorizonteEnVentana("2026-04", ventana)).toBeNull();
  });
});

describe("resolverPeriodoFocoEnVentana", () => {
  const ventana = periodosVentanaJefe("2026-06");

  it("acepta período en ventana", () => {
    expect(resolverPeriodoFocoEnVentana("2026-05", ventana, "2026-06")).toBe("2026-05");
  });

  it("caída al centro si query inválida", () => {
    expect(resolverPeriodoFocoEnVentana("2020-01", ventana, "2026-06")).toBe("2026-06");
    expect(resolverPeriodoFocoEnVentana("", ventana, "2026-06")).toBe("2026-06");
  });
});

describe("bloqueaCrearPlanHistorico", () => {
  it("solo bloquea M−1 sin plan", () => {
    expect(
      bloqueaCrearPlanHistorico(HORIZONTE_CONSOLA_IDX.MES_ANTERIOR_CIERRE, {
        estadoResumen: "SIN_PLAN",
        cantidadItems: 0,
      }),
    ).toBe(true);
    expect(
      bloqueaCrearPlanHistorico(HORIZONTE_CONSOLA_IDX.MES_ACTUAL_OPERACION, {
        estadoResumen: "SIN_PLAN",
        cantidadItems: 0,
      }),
    ).toBe(false);
  });
});

describe("resolverIntencionTarjetaConsola", () => {
  it("histórico vacío → feedback", () => {
    const r = resolverIntencionTarjetaConsola({
      indiceHorizonte: 0,
      estadoResumen: "SIN_PLAN",
      cantidadItems: 0,
      hayAgentesPlanificados: null,
      principalRechazado: false,
      incorporacionEditable: false,
      principalSoloLectura: false,
    });
    expect(r.kind).toBe("FEEDBACK_HISTORICO_SIN_PLAN");
  });

  it("sin plan y sin dotación → vista equipo", () => {
    const r = resolverIntencionTarjetaConsola({
      indiceHorizonte: 1,
      estadoResumen: "SIN_PLAN",
      cantidadItems: 0,
      hayAgentesPlanificados: false,
      principalRechazado: false,
      incorporacionEditable: false,
      principalSoloLectura: false,
    });
    expect(r.kind).toBe("ABRIR_VISTA_EQUIPO");
  });

  it("M+1 sin plan con dotación → crear", () => {
    const r = resolverIntencionTarjetaConsola({
      indiceHorizonte: 2,
      estadoResumen: "SIN_PLAN",
      cantidadItems: 0,
      hayAgentesPlanificados: true,
      principalRechazado: false,
      incorporacionEditable: false,
      principalSoloLectura: false,
    });
    expect(r.kind).toBe("CREAR_PLAN_NUEVO");
  });

  it("histórico con principal rechazado → modal opciones", () => {
    const r = resolverIntencionTarjetaConsola({
      indiceHorizonte: 0,
      estadoResumen: "EN_REVISION",
      cantidadItems: 1,
      hayAgentesPlanificados: true,
      principalRechazado: true,
      incorporacionEditable: false,
      principalSoloLectura: false,
    });
    expect(r.kind).toBe("MODAL_OPCIONES_RECHAZADO_HISTORICO");
  });
});

describe("outbox y cambio de foco", () => {
  const ventana = ["2026-05", "2026-06", "2026-07"];
  const op = { grupoId: "gdt_A", periodo: "2026-06", id: "op1" };

  it("opsOutboxFueraDeFoco filtra por GDT+período", () => {
    expect(opsOutboxFueraDeFoco([op], { grupoId: "gdt_A", periodo: "2026-06" })).toEqual([]);
    expect(opsOutboxFueraDeFoco([op], { grupoId: "gdt_B", periodo: "2026-06" })).toHaveLength(1);
    expect(opsOutboxFueraDeFoco([op], { grupoId: "gdt_A", periodo: "2026-07" })).toHaveLength(1);
  });

  it("validarOutboxCoherenteVentana rechaza período fuera de M−1..M+1", () => {
    const bad = { grupoId: "gdt_A", periodo: "2026-04" };
    const v = validarOutboxCoherenteVentana([op, bad], ventana);
    expect(v.ok).toBe(false);
    expect(v.periodosInvalidos).toEqual(["2026-04"]);
  });

  it("debeAdvertirCambioFocoConOutbox si hay ops en foco origen", () => {
    expect(
      debeAdvertirCambioFocoConOutbox(
        [op],
        { grupoId: "gdt_A", periodo: "2026-06" },
        { grupoId: "gdt_A", periodo: "2026-07" },
      ),
    ).toBe(true);
    expect(
      debeAdvertirCambioFocoConOutbox(
        [op],
        { grupoId: "gdt_A", periodo: "2026-06" },
        { grupoId: "gdt_A", periodo: "2026-06" },
      ),
    ).toBe(false);
  });
});

describe("resolverFocoOrigenOutbox", () => {
  it("prioriza foco explícito", () => {
    expect(
      resolverFocoOrigenOutbox(
        { grupoId: "gdt_A", periodo: "2026-06" },
        [{ grupoId: "gdt_B", periodo: "2026-07" }],
      ),
    ).toEqual({ grupoId: "gdt_A", periodo: "2026-06" });
  });

  it("infiere desde ops si no hay foco", () => {
    expect(
      resolverFocoOrigenOutbox(
        { grupoId: "", periodo: "" },
        [{ grupo_id: "gdt_X", periodo: "2026-05" }],
      ),
    ).toEqual({ grupoId: "gdt_X", periodo: "2026-05" });
  });
});

describe("inferirFocoDesdeOpsOutbox", () => {
  it("vacío sin ops", () => {
    expect(inferirFocoDesdeOpsOutbox([])).toEqual({ grupoId: "", periodo: "" });
  });
});

describe("esHorizonteCierre", () => {
  it("solo índice 0", () => {
    expect(esHorizonteCierre(0)).toBe(true);
    expect(esHorizonteCierre(1)).toBe(false);
  });
});
