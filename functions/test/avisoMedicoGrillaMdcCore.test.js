"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolverCodigoGrillaAvisoMedico,
  resolverRangoYmdAvisoMedico,
  mapSolicitudMedAvisoParaMdc,
  CODIGO_GRILLA_AVISO_PROVISORIO,
  CODIGO_GRILLA_AVISO_COMPLETO,
} = require("../modules/shared/avisoMedicoGrillaMdcPayload");

describe("avisoMedicoGrillaMdcCore", () => {
  it("usa LM-P para aviso incompleto", () => {
    const cod = resolverCodigoGrillaAvisoMedico({
      ingreso_medico: { es_licencia_incompleta: true },
    });
    assert.equal(cod, CODIGO_GRILLA_AVISO_PROVISORIO);
    assert.equal(cod, "LM-P");
  });

  it("usa LM para aviso completo pendiente auditoría", () => {
    const cod = resolverCodigoGrillaAvisoMedico({
      ingreso_medico: { es_licencia_incompleta: false },
    });
    assert.equal(cod, CODIGO_GRILLA_AVISO_COMPLETO);
    assert.equal(cod, "LM");
  });

  it("mapea fechas estimadas a rango MDC", () => {
    const rango = resolverRangoYmdAvisoMedico({
      fecha_inicio_reposo_estimada: "2026-06-20",
      fecha_fin_reposo_estimada: "2026-06-22",
    });
    assert.deepEqual(rango, { fecha_desde: "2026-06-20", fecha_hasta: "2026-06-22" });
  });

  it("buildMdc payload incluye codigo y estado pendiente clasificación", () => {
    const mapped = mapSolicitudMedAvisoParaMdc(
      {
        schema_version: "SOL_MED_AVISO_V1",
        titular_persona_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ",
        estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
        fecha_inicio_reposo_estimada: "2026-06-25",
        fecha_fin_reposo_estimada: "2026-06-25",
        ingreso_medico: { es_licencia_incompleta: true },
        grupo_trabajo_id_ancla: "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0",
      },
      "sol_01KQN9WXFXF69Z9DCT5YNJ3TS0",
    );
    assert.ok(mapped);
    assert.equal(mapped.codigo_grilla, "LM-P");
    assert.equal(mapped.fecha_desde, "2026-06-25");
    assert.equal(mapped.fecha_hasta, "2026-06-25");
    assert.equal(mapped.estado_solicitud_id, "cfg_esa_pendiente_clasificacion_medica");
  });
});
