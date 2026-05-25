import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bolsaTieneSaldoPositivoVisible, lineasDiasDescontadosDisplay } from "./laoDisplayUtils.js";

describe("bolsaTieneSaldoPositivoVisible", () => {
  it("oculta bolsa con disponible 0", () => {
    assert.equal(bolsaTieneSaldoPositivoVisible({ anio_origen: 2024, disponible: 0 }, 2026), false);
  });

  it("muestra bolsa con disponible > 0", () => {
    assert.equal(bolsaTieneSaldoPositivoVisible({ anio_origen: 2024, disponible: 3 }, 2026), true);
  });

  it("muestra año en curso (proporcional)", () => {
    assert.equal(bolsaTieneSaldoPositivoVisible({ anio_origen: 2026, disponible: 0 }, 2026), true);
  });
});

describe("lineasDiasDescontadosDisplay", () => {
  it("agrupa fines de semana", () => {
    const lineas = lineasDiasDescontadosDisplay([
      { fecha: "2026-05-23", fecha_formateada: "23-05-2026", motivo: "Fin de semana" },
      { fecha: "2026-05-24", fecha_formateada: "24-05-2026", motivo: "Fin de semana" },
      { fecha: "2026-05-25", fecha_formateada: "25-05-2026", motivo: "Feriado" },
    ]);
    assert.equal(lineas[0].text, "2 días por fin de semana");
    assert.match(lineas[1].text, /Feriado/);
  });
});
