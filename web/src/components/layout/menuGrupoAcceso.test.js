import { describe, expect, it } from "vitest";

import { grupoAccesiblePorClaims } from "./menuGrupoAcceso.js";

describe("grupoAccesiblePorClaims", () => {
  const hasJefe = (roles) => roles.includes("jefe");
  const hasRrhh = (roles) => roles.includes("rrhh");

  it("en ruta jefe oculta bloque rrhh aunque el token tenga CFG_RRHH", () => {
    const claims = { roles_hlc_vigentes: ["CFG_RRHH", "CFG_JEFE"] };
    expect(
      grupoAccesiblePorClaims("rrhh", claims, hasRrhh, {
        pathname: "/portal/jefe/grilla-operativa",
      }),
    ).toBe(false);
    expect(
      grupoAccesiblePorClaims("jefe", claims, hasJefe, {
        pathname: "/portal/jefe/grilla-operativa",
      }),
    ).toBe(true);
  });

  it("no usa claim RRHH para desbloquear menú jefe", () => {
    const claims = { roles_hlc_vigentes: ["CFG_RRHH"] };
    expect(grupoAccesiblePorClaims("jefe", claims, () => false, { pathname: "/portal/home" })).toBe(
      false,
    );
  });
});
