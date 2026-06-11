import { describe, expect, it } from "vitest";

import {
  COPY_BADGE_RRHH_BYPASS,
  COPY_PERIODO_CERRADO_JEFE,
  evaluarGuardrailsModificacionTeoria,
} from "./grillaGuardrailsTeoriaUi.js";

describe("evaluarGuardrailsModificacionTeoria T-06 paso 3", () => {
  it("jefe + período cerrado → puedeModificarTeoria false y copy liquidación", () => {
    const g = evaluarGuardrailsModificacionTeoria({
      usuarioActual: { id: "jefe1", esJefe: true, nivelJerarquico: 50 },
      agenteTarget: { id: "med1", nivelJerarquico: 5 },
      estadoPlan: "BORRADOR",
      periodoGso: { cerrado: true, ventanaM1: false },
    });
    expect(g.puedeModificarTeoria).toBe(false);
    expect(g.mensajeBloqueo).toBe(COPY_PERIODO_CERRADO_JEFE);
    expect(g.muestraBadgeBypassRrhh).toBe(false);
  });

  it("RRHH + período cerrado → puedeModificarTeoria true y badge bypass", () => {
    const g = evaluarGuardrailsModificacionTeoria({
      usuarioActual: { id: "rrhh1", esRrhh: true, nivelJerarquico: 99 },
      agenteTarget: { id: "med1", nivelJerarquico: 5 },
      estadoPlan: "HABILITADO",
      periodoGso: { cerrado: true, ventanaM1: false },
    });
    expect(g.puedeModificarTeoria).toBe(true);
    expect(g.mensajeBloqueo).toBeNull();
    expect(g.muestraBadgeBypassRrhh).toBe(true);
  });

  it("expone copy de badge RRHH para UI", () => {
    expect(COPY_BADGE_RRHH_BYPASS).toMatch(/RRHH/);
  });
});
