import { describe, expect, it } from "vitest";

import { resolverTabPorPath, MODULOS_PORTAL } from "../../constants/modulosEstado.js";
import { grupoAccesiblePorClaims } from "../../components/layout/menuGrupoAcceso.js";
import {
  mapArticuloNuevaSolicitud,
  rolPermiteTitularAjeno,
  ROL_CFG_MEDICO,
  ROL_CFG_RRHH,
  ROL_CFG_USUARIO,
  ROL_CFG_VISUALIZADOR,
} from "./nuevaSolicitudPorRol.js";

describe("nuevaSolicitudPorRol helpers", () => {
  it("solo RRHH/Médico/Visualizador permiten titular ajeno", () => {
    expect(rolPermiteTitularAjeno(ROL_CFG_USUARIO)).toBe(false);
    expect(rolPermiteTitularAjeno(ROL_CFG_RRHH)).toBe(true);
    expect(rolPermiteTitularAjeno(ROL_CFG_MEDICO)).toBe(true);
    expect(rolPermiteTitularAjeno(ROL_CFG_VISUALIZADOR)).toBe(true);
  });

  it("mapArticuloNuevaSolicitud exige art_*", () => {
    expect(mapArticuloNuevaSolicitud({ articulo_id: "x" })).toBeNull();
    const row = mapArticuloNuevaSolicitud({
      articulo_id: "art_01TEST",
      codigo_grilla: "77-0",
      nombre: "INASISTENCIA",
      elegible_titular: true,
      alta_disponible: false,
      circuito_ingreso_ids: ["CFG_RRHH"],
    });
    expect(row?.codigo_grilla).toBe("77-0");
    expect(row?.alta_disponible).toBe(false);
  });
});

describe("menú Nueva solicitud por rol", () => {
  it("define un ítem por paquete rrhh/medico/visualizador", () => {
    const ids = MODULOS_PORTAL.filter((m) => m.nuevaSolicitudPorRolMenu).map((m) => m.id);
    expect(ids).toEqual([
      "nueva-solicitud-rrhh",
      "nueva-solicitud-medico",
      "nueva-solicitud-visualizador",
    ]);
  });

  it("resolverTabPorPath mapea las tres rutas", () => {
    expect(resolverTabPorPath("/portal/rrhh/nueva-solicitud")).toBe("nueva-solicitud-rrhh");
    expect(resolverTabPorPath("/portal/medico/nueva-solicitud")).toBe("nueva-solicitud-medico");
    expect(resolverTabPorPath("/portal/visualizador/nueva-solicitud")).toBe(
      "nueva-solicitud-visualizador",
    );
  });

  it("grupo médico visible con CFG_MEDICO", () => {
    const claims = { roles_hlc_vigentes: ["CFG_MEDICO"] };
    expect(grupoAccesiblePorClaims("medico", claims, () => false, { pathname: "/portal/home" })).toBe(
      true,
    );
  });

  it("grupo visualizador visible con CFG_VISUALIZADOR", () => {
    const claims = { roles_hlc_vigentes: ["CFG_VISUALIZADOR"] };
    expect(
      grupoAccesiblePorClaims("visualizador", claims, () => false, { pathname: "/portal/home" }),
    ).toBe(true);
  });
});
