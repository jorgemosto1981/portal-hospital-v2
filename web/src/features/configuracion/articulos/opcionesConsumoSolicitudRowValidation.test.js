import { describe, expect, it } from "vitest";

import {
  getOpcionConsumoRowFieldIssues,
  opcionesConsumoTienenErroresUi,
} from "./opcionesConsumoSolicitudRowValidation.js";

describe("opcionesConsumoSolicitudRowValidation", () => {
  it("marca etiqueta vacía y días inválidos", () => {
    const issues = getOpcionConsumoRowFieldIssues({ etiqueta_ui: "  ", dias_por_evento: 0 }, 5);
    expect(issues.etiquetaVacia).toBe(true);
    expect(issues.diasInvalido).toBe(true);
    expect(issues.hasAny).toBe(true);
  });

  it("detecta superación del tope global", () => {
    const issues = getOpcionConsumoRowFieldIssues(
      { etiqueta_ui: "OK", dias_por_evento: 6 },
      5,
    );
    expect(issues.superaTope).toBe(true);
    expect(issues.hasAny).toBe(true);
  });

  it("array vacío no bloquea guardado", () => {
    expect(opcionesConsumoTienenErroresUi([], 5)).toBe(false);
  });
});
