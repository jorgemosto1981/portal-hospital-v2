import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  clasesBadgeEstadoHistorialLm,
  etiquetaArticuloHistorialLm,
  formatYmdHistorialLm,
  textoRangoHistorialLm,
} from "./historialLmBandejaAuditorUi.js";

describe("historialLmBandejaAuditorUi", () => {
  it("formatea fechas y rango", () => {
    assert.equal(formatYmdHistorialLm("2026-07-21"), "21/07/26");
    assert.equal(
      textoRangoHistorialLm({ fecha_desde: "2026-07-21", fecha_hasta: "2026-07-25" }),
      "21/07/26 → 25/07/26",
    );
  });

  it("asigna clases de badge por categoría", () => {
    assert.match(clasesBadgeEstadoHistorialLm("aprobada"), /emerald/);
    assert.match(clasesBadgeEstadoHistorialLm("rechazada"), /rose/);
    assert.match(clasesBadgeEstadoHistorialLm("junta"), /amber/);
  });

  it("etiqueta artículo LM", () => {
    assert.equal(etiquetaArticuloHistorialLm({ codigo_grilla: "14" }), "Art. 14 (LM)");
    assert.equal(
      etiquetaArticuloHistorialLm({ codigo_grilla: "11", articulo_label: "Otro" }),
      "11 — Otro",
    );
  });
});
