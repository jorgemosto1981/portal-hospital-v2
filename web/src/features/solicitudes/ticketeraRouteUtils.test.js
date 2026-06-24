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
});
