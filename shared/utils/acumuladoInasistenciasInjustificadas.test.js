/**
 * Unit tests — acumuladoInasistenciasInjustificadas (pure).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  restarMesesYmd,
  sumarDiasInjustificadosVentana,
  umbralInjustificadasExcedido,
} from "./acumuladoInasistenciasInjustificadas.js";

describe("acumuladoInasistenciasInjustificadas", () => {
  it("restarMesesYmd", () => {
    assert.equal(restarMesesYmd("2026-07-15", 12), "2025-07-15");
  });

  it("suma solo 77-0 aprobadas en ventana", () => {
    const total = sumarDiasInjustificadosVentana(
      [
        {
          codigo_grilla: "77-0",
          estado_solicitud_id: "cfg_esa_aprobada",
          fecha_desde: "2026-06-01",
          dias_solicitados: 3,
        },
        {
          codigo_grilla: "77-0",
          estado_solicitud_id: "cfg_esa_aprobada",
          fecha_desde: "2026-07-01",
          dias_solicitados: 8,
        },
        {
          codigo_grilla: "64-A",
          estado_solicitud_id: "cfg_esa_aprobada",
          fecha_desde: "2026-07-01",
          dias_solicitados: 1,
        },
        {
          codigo_grilla: "77-0",
          estado_solicitud_id: "cfg_esa_rechazada",
          fecha_desde: "2026-07-02",
          dias_solicitados: 5,
        },
      ],
      { fechaHastaRef: "2026-07-15", ventanaMeses: 12 },
    );
    assert.equal(total, 11);
    assert.equal(umbralInjustificadasExcedido(total, 10), true);
    assert.equal(umbralInjustificadasExcedido(10, 10), false);
  });
});
