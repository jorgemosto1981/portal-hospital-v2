import { describe, expect, it } from "vitest";

import {
  GRILLA_OPERATIVA_SHELL,
  grillaUsaCatalogoSector,
  modoGrillaInicialDesdeCapabilities,
  resolveGrillaOperativaCapabilities,
  resolveGrillaOperativaCapabilitiesFromVariant,
} from "./grillaOperativaCapabilities.js";
import { GRILLA_MES_MODO } from "./GrillaMesSelector.jsx";

describe("grillaOperativaCapabilities", () => {
  it("RRHH shell: catálogo sector y liquidación", () => {
    const cap = resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.RRHH);
    expect(cap.origenGrupos).toBe("catalogo");
    expect(cap.puedeAccionesPeriodoLiquidacion).toBe(true);
    expect(cap.puedeVerFichadasReales).toBe(true);
    expect(cap.muestraTarjetaTitular).toBe(false);
    expect(grillaUsaCatalogoSector(cap)).toBe(true);
    expect(modoGrillaInicialDesdeCapabilities(cap)).toBe(GRILLA_MES_MODO.SECTOR);
    expect(cap.rutaFocoBase).toContain("/rrhh/grilla-operativa");
    expect(cap.syncFocoEnUrl).toBe(true);
  });

  it("Jefe shell: HLg vigente, sin liquidación ni fichadas reales", () => {
    const cap = resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.JEFE);
    expect(cap.origenGrupos).toBe("hlg_vigente");
    expect(cap.puedeAccionesPeriodoLiquidacion).toBe(false);
    expect(cap.puedeVerFichadasReales).toBe(false);
    expect(cap.muestraTarjetaTitular).toBe(true);
    expect(modoGrillaInicialDesdeCapabilities(cap)).toBe(GRILLA_MES_MODO.EQUIPO);
    expect(cap.syncFocoEnUrl).toBe(true);
  });

  it("variant legacy mapea a shells", () => {
    expect(resolveGrillaOperativaCapabilitiesFromVariant("rrhh").shell).toBe("rrhh");
    expect(resolveGrillaOperativaCapabilitiesFromVariant("default").shell).toBe("jefe");
  });
});
