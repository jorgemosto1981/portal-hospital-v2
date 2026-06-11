import { describe, expect, it } from "vitest";

import {
  actorPortalTeoriaDesdePlanes,
  cargaCatalogoGruposPlanes,
  PLANES_TURNO_SHELL,
  resolvePlanesTurnoCapabilities,
  shellEsPlanesRrhh,
} from "./planesTurnoCapabilities.js";

describe("planesTurnoCapabilities", () => {
  it("RRHH shell: catálogo, bandeja masiva y sin consola en frío", () => {
    const cap = resolvePlanesTurnoCapabilities(PLANES_TURNO_SHELL.RRHH);
    expect(cap.origenGrupos).toBe("catalogo");
    expect(cap.consolaTripleHorizonteEnFrio).toBe(false);
    expect(cap.actorEsAuditoriaCentralPlan).toBe(true);
    expect(cap.puedeVerBandejaAprobacionMasiva).toBe(true);
    expect(cap.muestraBotonVolverConsola).toBe(false);
    expect(cap.rutaFocoBase).toBe("/portal/rrhh/planes-turno");
    expect(shellEsPlanesRrhh(cap)).toBe(true);
    expect(cargaCatalogoGruposPlanes(cap)).toBe(true);
  });

  it("Jefe shell: HLg, consola triple horizonte", () => {
    const cap = resolvePlanesTurnoCapabilities(PLANES_TURNO_SHELL.JEFE);
    expect(cap.origenGrupos).toBe("hlg_vigente");
    expect(cap.consolaTripleHorizonteEnFrio).toBe(true);
    expect(cap.actorEsAuditoriaCentralPlan).toBe(false);
    expect(cap.puedeVerBandejaAprobacionMasiva).toBe(false);
    expect(cap.muestraBotonVolverConsola).toBe(true);
    expect(cap.rutaFocoBase).toBe("/portal/jefe/planes-turno");
    expect(shellEsPlanesRrhh(cap)).toBe(false);
  });

  it("actor desde planes delega en shell", () => {
    const cap = resolvePlanesTurnoCapabilities(PLANES_TURNO_SHELL.JEFE);
    const actor = actorPortalTeoriaDesdePlanes(cap, { personaId: "p1", esJefe: true });
    expect(actor.esRrhh).toBe(false);
    expect(actor.esJefe).toBe(true);
  });
});
