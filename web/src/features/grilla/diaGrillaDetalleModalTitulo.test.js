import { describe, expect, it } from "vitest";

import { sufijoTituloDiaGrillaDetalleModal } from "./diaGrillaDetalleModalTitulo.js";

describe("sufijoTituloDiaGrillaDetalleModal", () => {
  it("prioriza licencias si hay eventos", () => {
    expect(
      sufijoTituloDiaGrillaDetalleModal({
        cantidadEventosLicencia: 1,
        celdaVis: { tipo_dia: "franco", es_franco: true },
      }),
    ).toBe(" — licencias");
  });

  it("franco sin licencias (CHAPARRO d25 post-traslados)", () => {
    expect(
      sufijoTituloDiaGrillaDetalleModal({
        cantidadEventosLicencia: 0,
        celdaVis: { tipo_dia: "franco", es_franco: true, rda_turno_id: null },
        turnoTeoricoEfectivo: { es_franco: true },
        tieneHistorialGestionTurno: true,
      }),
    ).toBe(" — franco");
  });

  it("plan incompleto sin eventos", () => {
    expect(
      sufijoTituloDiaGrillaDetalleModal({
        incompletoPlan: true,
        cantidadEventosLicencia: 0,
      }),
    ).toBe(" — sin turno en plan");
  });

  it("gestión de turno en laborable sin licencias", () => {
    expect(
      sufijoTituloDiaGrillaDetalleModal({
        cantidadEventosLicencia: 0,
        tieneHistorialGestionTurno: true,
        celdaVis: { tipo_dia: "laborable", rda_turno_id: "M+T+N" },
      }),
    ).toBe(" — gestión de turno");
  });
});
