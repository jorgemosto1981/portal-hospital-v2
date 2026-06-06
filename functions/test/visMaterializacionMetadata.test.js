"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { patchVisMetadataMaterializacionDot } = require("../modules/asistencia/visMaterializacionMetadata");

describe("patchVisMetadataMaterializacionDot", () => {
  it("incluye motivo y rango YMD", () => {
    const p = patchVisMetadataMaterializacionDot({
      motivo: "alta_hlg",
      rangoDesde: "2026-06-01",
      rangoHasta: "2026-06-15",
      origenEventoId: "hlg_01TEST",
    });
    assert.equal(p["metadata.ultimo_motivo"], "alta_hlg");
    assert.deepEqual(p["metadata.ultimo_rango_materializado"], {
      desde: "2026-06-01",
      hasta: "2026-06-15",
    });
    assert.equal(p["metadata.ultimo_origen_evento_id"], "hlg_01TEST");
    assert.ok(p["metadata.ultima_sync_teorica"]);
    assert.ok(p["metadata.version_token"]);
  });
});
