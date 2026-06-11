import { describe, expect, it } from "vitest";

import { PORTAL_FEATURE_SHELL } from "../grilla/actorPortalTeoriaDesdeShell.js";
import { GRILLA_OPERATIVA_SHELL } from "../grilla/grillaOperativaCapabilities.js";
import {
  permiteExportarReadModelLaboral,
  resolveBandejaSolicitudesCapabilities,
  resolveGrillaOperativaCapabilitiesDesdeRuta,
  resolveGrillaPortalRedirectPath,
  shellGrillaDesdePathname,
  shellMenuPortalDesdePathname,
} from "./portalPerifericoCapabilities.js";
import { resolveGrillaOperativaCapabilities } from "../grilla/grillaOperativaCapabilities.js";

describe("resolveBandejaSolicitudesCapabilities", () => {
  it("bandeja jefe: sin badge RRHH ni acceso por claim RRHH", () => {
    const cap = resolveBandejaSolicitudesCapabilities(PORTAL_FEATURE_SHELL.JEFE);
    expect(cap.muestraBadgeSesionRrhh).toBe(false);
    expect(cap.requiereClaimJefeEnRuta).toBe(true);
    expect(cap.vistaInstitucionalPlanes).toBe(false);
  });

  it("bandeja RRHH: vista institucional", () => {
    const cap = resolveBandejaSolicitudesCapabilities(PORTAL_FEATURE_SHELL.RRHH);
    expect(cap.muestraBadgeSesionRrhh).toBe(true);
    expect(cap.requiereClaimJefeEnRuta).toBe(false);
    expect(cap.vistaInstitucionalPlanes).toBe(true);
  });
});

describe("permiteExportarReadModelLaboral", () => {
  it("solo shell RRHH grilla", () => {
    expect(
      permiteExportarReadModelLaboral(
        resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.RRHH),
      ),
    ).toBe(true);
    expect(
      permiteExportarReadModelLaboral(
        resolveGrillaOperativaCapabilities(GRILLA_OPERATIVA_SHELL.JEFE),
      ),
    ).toBe(false);
  });
});

describe("resolveGrillaPortalRedirectPath", () => {
  const hasJefe = (roles) => roles.includes("jefe");
  const hasRrhh = (roles) => roles.includes("rrhh");

  it("prioriza última shell visitada si el gate lo permite", () => {
    const claims = { tiene_subordinados: true, roles_hlc_vigentes: ["CFG_RRHH"] };
    expect(resolveGrillaPortalRedirectPath(claims, hasJefe, "jefe")).toBe(
      "/portal/jefe/grilla-operativa",
    );
  });

  it("fallback jefe antes que RRHH en frío", () => {
    const claims = { tiene_subordinados: true, roles_hlc_vigentes: ["CFG_RRHH"] };
    expect(resolveGrillaPortalRedirectPath(claims, hasRrhh, null)).toBe(
      "/portal/jefe/grilla-operativa",
    );
  });
});

describe("shellMenuPortalDesdePathname", () => {
  it("detecta prefijo jefe vs rrhh", () => {
    expect(shellMenuPortalDesdePathname("/portal/jefe/planes-turno")).toBe("jefe");
    expect(shellMenuPortalDesdePathname("/portal/rrhh/grilla-operativa")).toBe("rrhh");
    expect(shellMenuPortalDesdePathname("/portal/home")).toBeNull();
  });
});

describe("shellGrillaDesdePathname", () => {
  it("infiere RRHH vs jefe por prefijo de ruta", () => {
    expect(shellGrillaDesdePathname("/portal/rrhh/grilla-operativa")).toBe(
      GRILLA_OPERATIVA_SHELL.RRHH,
    );
    expect(shellGrillaDesdePathname("/portal/jefe/grilla-operativa")).toBe(
      GRILLA_OPERATIVA_SHELL.JEFE,
    );
  });

  it("resolveGrillaOperativaCapabilitiesDesdeRuta", () => {
    const cap = resolveGrillaOperativaCapabilitiesDesdeRuta("/portal/jefe/grilla-operativa");
    expect(cap.shell).toBe("jefe");
    expect(cap.puedeVerTramosCrudosFichadas).toBe(false);
  });
});
