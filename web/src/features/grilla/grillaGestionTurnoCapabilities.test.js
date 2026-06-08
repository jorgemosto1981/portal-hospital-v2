import { describe, it, expect } from "vitest";

import {
  evaluarCapabilitiesGestionTurno,
  resolverNivelJerarquicoEnFilas,
} from "./grillaGestionTurnoCapabilities.js";
import { MOTIVOS_RECHAZO_TEORIA } from "./teoriaPermisosGso.js";

describe("grillaGestionTurnoCapabilities US-13", () => {
  it("oculta gestión si jefe no es superior (G2)", () => {
    const cap = evaluarCapabilitiesGestionTurno({
      usuarioActual: { id: "jefe1", esJefe: true, nivelJerarquico: 10 },
      agenteTarget: { id: "jefe2", nivelJerarquico: 20 },
      estadoPlan: "BORRADOR",
      periodoGso: { cerrado: false, ventanaM1: false },
    });
    expect(cap.puedeGestionarTurno).toBe(false);
    expect(cap.mensajeBloqueo).toBe(MOTIVOS_RECHAZO_TEORIA.NO_ES_SUPERIOR_JERARQUICO);
  });

  it("permite modal con requiereUrgencia si plan HABILITADO (G1 UX)", () => {
    const cap = evaluarCapabilitiesGestionTurno({
      usuarioActual: { id: "jefe1", esJefe: true, nivelJerarquico: 50 },
      agenteTarget: { id: "med1", nivelJerarquico: 5 },
      estadoPlan: "HABILITADO",
      periodoGso: { cerrado: false, ventanaM1: false },
    });
    expect(cap.puedeGestionarTurno).toBe(true);
    expect(cap.requiereUrgencia).toBe(true);
  });

  it("resolverNivelJerarquicoEnFilas por fila_id", () => {
    const filas = [
      { fila_id: "a", persona_id: "per_1", nivel_jerarquico: 12 },
      { fila_id: "b", persona_id: "per_2", nivel_jerarquico: 3 },
    ];
    expect(resolverNivelJerarquicoEnFilas(filas, "per_2", "b")).toBe(3);
  });
});
