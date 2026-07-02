"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolverMetadatosLicenciaMedicaParaMdc,
  fusionarMetadatosLicenciaMedicaEnPayload,
} = require("../modules/shared/mdcLicenciaMedicaMetadatos");
const { buildMdcPayloadDesdeSolicitud } = require("../modules/shared/mdcWorkerCore");

describe("mdcLicenciaMedicaMetadatos", () => {
  it("infiera S_MED_LARGA desde cie10 y causal en sol_", () => {
    const meta = resolverMetadatosLicenciaMedicaParaMdc({
      cie10: { codigo: "J06.9", descripcion: "IRA" },
      causal_larga_duracion_id: "cfg_cld_ejemplo",
    });
    assert.equal(meta?.fase_motor, "S_MED_LARGA");
    assert.equal(meta?.cie10_codigo, "J06.9");
    assert.equal(meta?.causal_larga_duracion_id, "cfg_cld_ejemplo");
  });

  it("buildMdcPayload propaga fase_motor al comando", () => {
    const payload = buildMdcPayloadDesdeSolicitud(
      {
        id: "sol_test",
        titular_persona_id: "per_01",
        articulo_id: "art_16",
        version_id_aplicada: "ver_01",
        fecha_desde: "2026-07-01",
        fecha_hasta: "2026-07-20",
        codigo_grilla: "LM-L",
        cie10: { codigo: "A00", descripcion: "Cólera" },
        causal_larga_duracion_id: "cfg_cld_x",
      },
      "PROYECTAR_PENDIENTE",
    );
    assert.equal(payload.fase_motor, "S_MED_LARGA");
    assert.equal(payload.cie10_codigo, "A00");
    assert.equal(payload.causal_larga_duracion_id, "cfg_cld_x");
  });

  it("fusionar no pisa payload sin metadatos larga", () => {
    const p = fusionarMetadatosLicenciaMedicaEnPayload(
      { articulo_id: "art_14" },
      { sol_id: "sol_1", comando: "X" },
    );
    assert.equal(p.fase_motor, undefined);
    assert.equal(p.sol_id, "sol_1");
  });
});
