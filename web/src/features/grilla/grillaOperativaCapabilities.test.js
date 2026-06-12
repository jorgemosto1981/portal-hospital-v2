import { describe, expect, it } from "vitest";

import {
  actorPortalTeoriaDesdeGrilla,
  cargaCatalogoSectorGrilla,
  GRILLA_OPERATIVA_SHELL,
  grillaUsaCatalogoSector,
  modoFichadaCeldaDesdeCapabilities,
  modoGrillaInicialDesdeCapabilities,
  resolveGrillaOperativaCapabilities,
  resolveGrillaOperativaCapabilitiesFromVariant,
  rutaBandejaSolicitudesGrilla,
  shellEsGrillaRrhh,
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
    expect(cap.consolaTripleHorizonteEnFrio).toBe(false);
    expect(cap.muestraBandejaAuditoriaDiaria).toBe(true);
    expect(cap.puedeVerTramosCrudosFichadas).toBe(true);
    expect(cap.puedeEditarFichadasReales).toBe(true);
    expect(cap.permiteExportarMatrizMacro).toBe(true);
  });

  it("Jefe shell: HLg vigente, sin liquidación ni fichadas reales", () => {
    const cap = resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.JEFE);
    expect(cap.origenGrupos).toBe("hlg_vigente");
    expect(cap.puedeAccionesPeriodoLiquidacion).toBe(false);
    expect(cap.puedeVerFichadasReales).toBe(false);
    expect(cap.muestraTarjetaTitular).toBe(true);
    expect(modoGrillaInicialDesdeCapabilities(cap)).toBe(GRILLA_MES_MODO.EQUIPO);
    expect(cap.syncFocoEnUrl).toBe(true);
    expect(cap.consolaTripleHorizonteEnFrio).toBe(true);
    expect(cap.muestraBandejaAuditoriaDiaria).toBe(false);
    expect(cap.puedeVerTramosCrudosFichadas).toBe(false);
    expect(cap.puedeEditarFichadasReales).toBe(false);
    expect(cap.permiteExportarMatrizMacro).toBe(false);
  });

  it("variant legacy mapea a shells", () => {
    expect(resolveGrillaOperativaCapabilitiesFromVariant("rrhh").shell).toBe("rrhh");
    expect(resolveGrillaOperativaCapabilitiesFromVariant("default").shell).toBe("jefe");
  });

  it("helpers shell vs claims cruzados", () => {
    const rrhh = resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.RRHH);
    const jefe = resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.JEFE);
    expect(shellEsGrillaRrhh(rrhh)).toBe(true);
    expect(shellEsGrillaRrhh(jefe)).toBe(false);
    expect(cargaCatalogoSectorGrilla(rrhh)).toBe(true);
    expect(cargaCatalogoSectorGrilla(jefe)).toBe(false);
    expect(rutaBandejaSolicitudesGrilla(rrhh)).toContain("/rrhh/");
    expect(rutaBandejaSolicitudesGrilla(jefe)).toContain("/jefe/");
    expect(modoFichadaCeldaDesdeCapabilities(rrhh, true)).toBe("rrhh");
    expect(modoFichadaCeldaDesdeCapabilities(jefe, true)).toBe("jefe");
    const actorJefeShell = actorPortalTeoriaDesdeGrilla(jefe, {
      personaId: "per_x",
      esJefe: true,
    });
    expect(actorJefeShell.esRrhh).toBe(false);
    expect(actorJefeShell.esJefe).toBe(true);
    const actorRrhhShell = actorPortalTeoriaDesdeGrilla(rrhh, {
      personaId: "per_y",
      esJefe: true,
    });
    expect(actorRrhhShell.esRrhh).toBe(true);
    expect(actorRrhhShell.esJefe).toBe(false);
  });
});
