"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  versionEsCambioDia,
  solicitudEsCambioDia,
  ymdMinimoPreaviso,
  validarFechasMotivoCambioDia,
} = require("../modules/shared/cambioDiaSolicitudCore");

describe("cambioDiaSolicitudCore", () => {
  it("detecta versión y solicitud CAMBIO-DIA", () => {
    assert.equal(versionEsCambioDia({ cambio_dia_solicitud: { schema: "CAMBIO_DIA_V1" } }), true);
    assert.equal(versionEsCambioDia({}), false);
    assert.equal(solicitudEsCambioDia({ es_cambio_dia: true }), true);
    assert.equal(solicitudEsCambioDia({ cambio_dia_schema: "CAMBIO_DIA_V1" }), true);
  });

  it("calcula ymd mínimo de preaviso", () => {
    assert.equal(ymdMinimoPreaviso(2, "2026-07-08"), "2026-07-10");
    assert.equal(ymdMinimoPreaviso(0, "2026-07-08"), "2026-07-08");
  });

  it("valida fechas/motivo con preaviso 2 y sin retroactividad", () => {
    const ok = validarFechasMotivoCambioDia({
      fechaOrigen: "2026-07-15",
      fechaDestino: "2026-07-16",
      motivo: "Trámite personal",
      permiteRetroactividad: false,
      plazoPreavisoInternoDias: 2,
      hoyYmd: "2026-07-08",
    });
    assert.equal(ok.ok, true);

    const fail = validarFechasMotivoCambioDia({
      fechaOrigen: "2026-07-09",
      fechaDestino: "2026-07-10",
      motivo: "x",
      permiteRetroactividad: false,
      plazoPreavisoInternoDias: 2,
      hoyYmd: "2026-07-08",
    });
    assert.equal(fail.ok, false);
    assert.ok(fail.errores.some((e) => /motivo/i.test(e) || /preaviso|después/i.test(e)));
  });

  it("rechaza ventana mayor a 10 días corridos", () => {
    const fail = validarFechasMotivoCambioDia({
      fechaOrigen: "2026-07-15",
      fechaDestino: "2026-07-26",
      motivo: "Trámite de servicio",
      permiteRetroactividad: false,
      plazoPreavisoInternoDias: 2,
      hoyYmd: "2026-07-08",
    });
    assert.equal(fail.ok, false);
    assert.ok(fail.errores.some((e) => /10 días corridos/i.test(e)));
  });

  it("acepta exactamente 10 días corridos", () => {
    const ok = validarFechasMotivoCambioDia({
      fechaOrigen: "2026-07-15",
      fechaDestino: "2026-07-25",
      motivo: "Trámite de servicio",
      permiteRetroactividad: false,
      plazoPreavisoInternoDias: 2,
      hoyYmd: "2026-07-08",
    });
    assert.equal(ok.ok, true);
  });
});
