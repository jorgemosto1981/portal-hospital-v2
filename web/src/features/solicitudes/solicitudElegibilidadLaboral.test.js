import { describe, expect, it } from "vitest";

import {
  CFG_USUARIO,
  CODIGO_CIRCUITO_ROL,
  CODIGO_ELEG_ESCALAFON,
  evaluarCircuitoIngreso,
  isPortalRoleUsuario,
  resolverElegibilidadSolicitud,
} from "../../../../shared/utils/solicitudElegibilidadLaboral.js";

/** Circuito operativo acordado: agente + RRHH + médico (@see ARTICULOS_BASICOS_OPERATIVOS_V2.md). */
const CIRCUITO_OPERATIVO_BASICO = [CFG_USUARIO, "CFG_RRHH", "CFG_MEDICO", "CFG_VISUALIZADOR"];

const VERSION_64A = {
  bloque_elegibilidad_filtros: {
    escalafon_ids: ["CFG_ESC_02_ADMINISTRACION"],
    agrupamiento_ids: [],
  },
  bloque_workflow_sla_cobertura: {
    circuito_ingreso_ids: CIRCUITO_OPERATIVO_BASICO,
  },
};

const HLC_2695 = {
  id: "hlc_test",
  escalafon_id: "CFG_ESC_02_ADMINISTRACION",
  agrupamiento_id: "CFG_AGR_X",
  rol_id: CFG_USUARIO,
};

const HLC_9282 = {
  id: "hlc_prof",
  escalafon_id: "CFG_ESC_01_PROFESIONAL",
  rol_id: CFG_USUARIO,
};

describe("solicitudElegibilidadLaboral", () => {
  it("sesión agente: roles HLC + cargo activo (canónico)", () => {
    expect(
      isPortalRoleUsuario({ cargo_activo: true, roles_hlc_vigentes: ["CFG_USUARIO"] }),
    ).toBe(true);
    expect(isPortalRoleUsuario({ cargo_activo: false, roles_hlc_vigentes: ["CFG_USUARIO"] })).toBe(
      false,
    );
    expect(isPortalRoleUsuario({ cargo_activo: true, roles_hlc_vigentes: [] })).toBe(false);
  });

  it("legacy portal_role / perfil_rol_id (compat)", () => {
    expect(isPortalRoleUsuario({ portal_role: "usuario" })).toBe(true);
    expect(isPortalRoleUsuario({ portal_role: "rrhh" })).toBe(true);
    expect(isPortalRoleUsuario({ roles_hlc_vigentes: ["CFG_RRHH"], cargo_activo: true })).toBe(true);
    expect(isPortalRoleUsuario({ portal_role: "invitado" })).toBe(false);
  });

  it("T1 — 2695 + rol HLC en circuito", () => {
    const r = resolverElegibilidadSolicitud({
      versionData: VERSION_64A,
      hlcVigentes: [HLC_2695],
      personaId: "per_test",
      fechaDesde: "2026-05-20",
      authToken: { portal_role: "usuario" },
    });
    expect(r.ok).toBe(true);
  });

  it("T2 — 9282 rechaza escalafón", () => {
    const r = resolverElegibilidadSolicitud({
      versionData: VERSION_64A,
      hlcVigentes: [HLC_9282],
      personaId: "per_test",
      fechaDesde: "2026-05-20",
      authToken: { portal_role: "usuario" },
    });
    expect(r.ok).toBe(false);
    expect(r.codigos).toContain(CODIGO_ELEG_ESCALAFON);
  });

  it("T3 — RRHH con rol HLC en circuito (hereda flujo agente)", () => {
    const c = evaluarCircuitoIngreso(VERSION_64A, { portal_role: "rrhh" }, HLC_2695);
    expect(c).toBeNull();
  });

  it("T3b — HLC CFG_RRHH con circuito configurado en versión", () => {
    const hlcRrhh = { ...HLC_2695, rol_id: "CFG_RRHH" };
    const c = evaluarCircuitoIngreso(VERSION_64A, { portal_role: "rrhh" }, hlcRrhh);
    expect(c).toBeNull();
    const r = resolverElegibilidadSolicitud({
      versionData: VERSION_64A,
      hlcVigentes: [hlcRrhh],
      personaId: "per_test",
      fechaDesde: "2026-05-20",
      authToken: { portal_role: "rrhh" },
    });
    expect(r.ok).toBe(true);
  });

  it("T3c — trigger sin token: solo valida rol HLC ∈ circuito_ingreso_ids", () => {
    const hlcRrhh = { ...HLC_2695, rol_id: "CFG_RRHH" };
    const c = evaluarCircuitoIngreso(VERSION_64A, null, hlcRrhh, { skipPortalRoleCheck: true });
    expect(c).toBeNull();
  });
});
