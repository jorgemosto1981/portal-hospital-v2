import { describe, expect, it } from "vitest";

import {
  articuloIdDesdeSearchParams,
  esArticuloElegibleEnCatalogo,
  filaArticuloIngresoDesdeCallable,
  normalizarPatronSaldo,
} from "./ticketeraRouteUtils.js";

describe("ticketeraRouteUtils", () => {
  it("articuloIdDesdeSearchParams acepta articulo o articulo_id", () => {
    expect(articuloIdDesdeSearchParams(new URLSearchParams("articulo=art_01ABC"))).toBe("art_01ABC");
    expect(articuloIdDesdeSearchParams(new URLSearchParams("articulo_id=art_02XYZ"))).toBe("art_02XYZ");
    expect(articuloIdDesdeSearchParams(new URLSearchParams(""))).toBe("");
    expect(articuloIdDesdeSearchParams(new URLSearchParams("articulo=invalid"))).toBe("");
  });

  it("validación 1:1 catálogo — URL 68B no pasa si solo está 64A en mapa", () => {
    const map = new Map([["art_64A", { articulo_id: "art_64A", patron_saldo: "B" }]]);
    expect(esArticuloElegibleEnCatalogo("art_64A", map)).toBe(true);
    expect(esArticuloElegibleEnCatalogo("art_68B", map)).toBe(false);
  });

  it("normalizarPatronSaldo", () => {
    expect(normalizarPatronSaldo("c")).toBe("C");
    expect(normalizarPatronSaldo(undefined)).toBe("B");
  });

  it("filaArticuloIngresoDesdeCallable", () => {
    const row = filaArticuloIngresoDesdeCallable({
      articulo_id: "art_x",
      version_id: "ver_y",
      patron_saldo: "C",
      nombre: "Comp",
    });
    expect(row?.patron_saldo).toBe("C");
  });

  it("filaArticuloIngresoDesdeCallable propaga opciones de consumo", () => {
    const row = filaArticuloIngresoDesdeCallable({
      articulo_id: "art_x",
      requiere_opcion_consumo: true,
      dias_solicitados: null,
      fecha_hasta: null,
      opciones_consumo_solicitud: [
        { id: "oc_63j_hermanos", etiqueta_ui: "Hermanos", dias_por_evento: 3 },
      ],
    });
    expect(row?.requiere_opcion_consumo).toBe(true);
    expect(row?.dias_solicitados).toBeNull();
    expect(row?.opciones_consumo_solicitud).toHaveLength(1);
  });

  it("filaArticuloIngresoDesdeCallable propaga CAMBIO-DIA", () => {
    const row = filaArticuloIngresoDesdeCallable({
      articulo_id: "art_x",
      es_cambio_dia: true,
      cambio_dia_solicitud: { schema: "CAMBIO_DIA_V1" },
      plazo_preaviso_interno_dias: 2,
      permite_retroactividad: false,
    });
    expect(row?.es_cambio_dia).toBe(true);
    expect(row?.plazo_preaviso_interno_dias).toBe(2);
    expect(row?.cambio_dia_solicitud?.schema).toBe("CAMBIO_DIA_V1");
  });
});
