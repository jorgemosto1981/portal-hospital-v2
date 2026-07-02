import { describe, expect, it } from "vitest";

import {
  etiquetaEnlaceBandejaDesdeResumenGrilla,
  rutaBandejaSolicitudDesdeResumenGrilla,
} from "./grillaBandejaSolicitudLink.js";

describe("rutaBandejaSolicitudDesdeResumenGrilla", () => {
  const jefe = "/portal/jefe/solicitudes";

  it("aviso pendiente → bandeja auditor", () => {
    expect(
      rutaBandejaSolicitudDesdeResumenGrilla(
        {
          es_aviso_medico: true,
          estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
        },
        jefe,
      ),
    ).toBe("/portal/medico/solicitudes");
  });

  it("aviso aprobado → sin enlace jefe", () => {
    expect(
      rutaBandejaSolicitudDesdeResumenGrilla(
        { es_aviso_medico: true, estado_solicitud_id: "cfg_esa_aprobada" },
        jefe,
      ),
    ).toBe("");
  });

  it("patrón B → bandeja jefe", () => {
    expect(
      rutaBandejaSolicitudDesdeResumenGrilla(
        { es_aviso_medico: false, estado_solicitud_id: "cfg_esa_aprobada" },
        jefe,
      ),
    ).toBe(jefe);
  });

  it("etiqueta médica", () => {
    expect(etiquetaEnlaceBandejaDesdeResumenGrilla({ es_aviso_medico: true })).toMatch(/médica/i);
  });
});
