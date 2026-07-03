import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  textoPeriodoOriginalAgenteResumenGrilla,
  textoPeriodoResumenGrilla,
} from "./diaGrillaResumenPeriodoUi.js";

describe("diaGrillaResumenPeriodoUi", () => {
  it("muestra rango efectivo con hasta distinto", () => {
    assert.equal(
      textoPeriodoResumenGrilla({
        fecha_desde: "2026-07-20",
        fecha_hasta: "2026-07-21",
        dias_solicitados: 2,
      }),
      "20/07/2026 → 21/07/2026 · 2 días",
    );
  });

  it("muestra rango original del agente", () => {
    assert.equal(
      textoPeriodoOriginalAgenteResumenGrilla({
        fecha_desde_original: "2026-07-20",
        fecha_hasta_original: "2026-07-30",
      }),
      "20/07/2026 → 30/07/2026",
    );
  });
});
