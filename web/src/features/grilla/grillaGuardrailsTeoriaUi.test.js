import { describe, expect, it } from "vitest";

import { CATALOGO_MOTIVOS_NOVEDAD_GSO } from "./grillaMotivosNovedadCatalogo.js";
import {
  COPY_BADGE_RRHH_BYPASS,
  COPY_PERIODO_CERRADO_JEFE,
  buildGuardrailNovedadContext,
  COPY_OUTBOX_CODIGO_EXCLUSIVO_RRHH,
  COPY_OUTBOX_PERIODO_CERRADO,
  evaluarGuardrailsAplicarOutbox,
  evaluarGuardrailsModificacionTeoria,
  mapearOpcionesNovedadCatalogo,
  opTieneCodigoNovedadExclusivoRrhh,
  puedeAsignarCodigoNovedad,
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

describe("guardrail combo novedades", () => {
  const exclusivo = CATALOGO_MOTIVOS_NOVEDAD_GSO.find((n) => n.requiereAuditoriaCentral);
  const operativo = CATALOGO_MOTIVOS_NOVEDAD_GSO.find((n) => !n.requiereAuditoriaCentral);

  it("jefe sin modificar teoría no puede asignar ningún código", () => {
    const ctx = buildGuardrailNovedadContext({ puedeModificarTeoria: false, esAuditoriaCentral: false });
    expect(puedeAsignarCodigoNovedad(operativo, ctx)).toBe(false);
    expect(puedeAsignarCodigoNovedad(exclusivo, ctx)).toBe(false);
  });

  it("jefe con período abierto no puede códigos exclusivos RRHH", () => {
    const ctx = buildGuardrailNovedadContext({ puedeModificarTeoria: true, esAuditoriaCentral: false });
    expect(puedeAsignarCodigoNovedad(operativo, ctx)).toBe(true);
    expect(puedeAsignarCodigoNovedad(exclusivo, ctx)).toBe(false);
  });

  it("RRHH puede todo el catálogo", () => {
    const ctx = buildGuardrailNovedadContext({ puedeModificarTeoria: true, esAuditoriaCentral: true });
    const mapped = mapearOpcionesNovedadCatalogo(CATALOGO_MOTIVOS_NOVEDAD_GSO, ctx);
    expect(mapped.every((o) => !o.disabled)).toBe(true);
  });
});

describe("evaluarGuardrailsAplicarOutbox", () => {
  it("bloquea jefe con período restringido", () => {
    const r = evaluarGuardrailsAplicarOutbox({
      ops: [{ motivo: "[URG_OPE] ok" }],
      esAuditoriaCentral: false,
      periodoRestringido: true,
      puedeModificarTeoriaLote: false,
    });
    expect(r.puedeAplicarBatch).toBe(false);
    expect(r.mensajeBloqueo).toBe(COPY_OUTBOX_PERIODO_CERRADO);
  });

  it("bloquea jefe si el lote trae código exclusivo RRHH", () => {
    expect(
      opTieneCodigoNovedadExclusivoRrhh({ motivo: "[AUD_LIQ] Regularización liquidación (auditoría central): x" }),
    ).toBe(true);
    const r = evaluarGuardrailsAplicarOutbox({
      ops: [{ motivo: "[AUD_LIQ] x" }],
      esAuditoriaCentral: false,
      periodoRestringido: false,
      puedeModificarTeoriaLote: true,
    });
    expect(r.puedeAplicarBatch).toBe(false);
    expect(r.mensajeBloqueo).toBe(COPY_OUTBOX_CODIGO_EXCLUSIVO_RRHH);
  });

  it("RRHH aplica batch con bypass en período cerrado", () => {
    const r = evaluarGuardrailsAplicarOutbox({
      ops: [{ motivo: "[AUD_LIQ] ok" }],
      esAuditoriaCentral: true,
      periodoRestringido: true,
    });
    expect(r.puedeAplicarBatch).toBe(true);
    expect(r.muestraBadgeBypassRrhh).toBe(true);
  });
});
