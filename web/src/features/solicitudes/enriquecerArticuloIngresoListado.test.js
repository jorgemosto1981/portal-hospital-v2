import { describe, expect, it } from "vitest";

import { enriquecerArticuloIngresoListado } from "./enriquecerArticuloIngresoListado.js";
import { articuloRequiereOpcionConsumo } from "./patronBFechasUi.js";

describe("enriquecerArticuloIngresoListado", () => {
  it("conserva fila P5.0b del callable", () => {
    const row = enriquecerArticuloIngresoListado({
      articulo_id: "art_x",
      codigo_grilla: "63-J",
      requiere_opcion_consumo: true,
      dias_solicitados: null,
      opciones_consumo_solicitud: [{ id: "oc_a", etiqueta_ui: "A", dias_por_evento: 2 }],
    });
    expect(row?.requiere_opcion_consumo).toBe(true);
    expect(row?.opciones_consumo_solicitud).toHaveLength(1);
  });

  it("completa 63-J si el callable legacy no envía opciones", () => {
    const row = enriquecerArticuloIngresoListado({
      articulo_id: "art_63j",
      codigo_grilla: "63-J",
      nombre: "DUELO",
      dias_solicitados: 1,
      fecha_hasta: "2026-06-26",
    });
    expect(row?.requiere_opcion_consumo).toBe(true);
    expect(row?.opciones_consumo_solicitud?.length).toBeGreaterThan(1);
    expect(row?.dias_solicitados).toBeNull();
    expect(articuloRequiereOpcionConsumo(row)).toBe(true);
  });
});
