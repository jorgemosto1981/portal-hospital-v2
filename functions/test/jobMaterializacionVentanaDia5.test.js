"use strict";

/**
 * node --test functions/test/jobMaterializacionVentanaDia5.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  ventanaMesesDesdeReferencia,
  hlgVigenteEnMes,
  cambioBasePosteriorASync,
  decidirAccionMesDia5,
} = require("../modules/asistencia/jobMaterializacionVentanaDia5");
const { visRequiereMaterializacion } = require("../modules/shared/grillaMesAgenteCore");

describe("ventanaMesesDesdeReferencia", () => {
  it("5/jun → M=jun, M+1=jul", () => {
    const v = ventanaMesesDesdeReferencia("2026-06-05");
    assert.equal(v.anioM, 2026);
    assert.equal(v.mesM, 6);
    assert.equal(v.anioM1, 2026);
    assert.equal(v.mesM1, 7);
    assert.equal(v.dia, 5);
  });

  it("5/dic → M+1 ene año siguiente", () => {
    const v = ventanaMesesDesdeReferencia("2026-12-05");
    assert.equal(v.mesM, 12);
    assert.equal(v.anioM1, 2027);
    assert.equal(v.mesM1, 1);
  });
});

describe("hlgVigenteEnMes", () => {
  it("cruce con mes", () => {
    assert.equal(hlgVigenteEnMes("2026-06-01", "2026-06-30", 2026, 6), true);
    assert.equal(hlgVigenteEnMes("2026-07-01", null, 2026, 6), false);
  });
});

describe("decidirAccionMesDia5", () => {
  it("M+1 omitir si snapshot válido", () => {
    const vista = {
      existe: true,
      dias: Object.fromEntries(
        Array.from({ length: 22 }, (_, i) => [
          String(i + 1).padStart(2, "0"),
          { tipo_dia: "laborable", rda_ingreso: "08:00", rda_egreso: "14:00" },
        ]),
      ),
    };
    assert.equal(visRequiereMaterializacion(vista), false);
    const d = decidirAccionMesDia5(vista, "m_plus_1");
    assert.equal(d.accion, "omitir");
  });

  it("M+1 materializar si sin vis", () => {
    const d = decidirAccionMesDia5({ existe: false, dias: {} }, "m_plus_1");
    assert.equal(d.accion, "materializar");
    assert.equal(d.motivo, "job_dia5_m_plus_1");
  });

  it("M actual materializar si cambio base posterior a sync", () => {
    const vista = {
      existe: true,
      dias: Object.fromEntries(
        Array.from({ length: 22 }, (_, i) => [
          String(i + 1).padStart(2, "0"),
          { tipo_dia: "laborable", rda_ingreso: "08:00", rda_egreso: "14:00" },
        ]),
      ),
      metadata: {
        ultima_sync_teorica: new Date("2026-06-01T10:00:00Z"),
        ultimo_motivo_en: new Date("2026-06-04T12:00:00Z"),
        ultimo_motivo: "hlg_alta",
      },
    };
    const d = decidirAccionMesDia5(vista, "m_actual");
    assert.equal(d.accion, "materializar");
    assert.equal(d.motivo, "job_dia5_m_cambio_base");
  });

  it("M actual omitir sin degenerado ni cambio base", () => {
    const vista = {
      existe: true,
      dias: Object.fromEntries(
        Array.from({ length: 22 }, (_, i) => [
          String(i + 1).padStart(2, "0"),
          { tipo_dia: "laborable", rda_ingreso: "08:00", rda_egreso: "14:00" },
        ]),
      ),
      metadata: {
        ultima_sync_teorica: new Date("2026-06-04T12:00:00Z"),
        ultimo_motivo_en: new Date("2026-06-02T08:00:00Z"),
        ultimo_motivo: "hlg_alta",
      },
    };
    assert.equal(cambioBasePosteriorASync(vista.metadata), false);
    const d = decidirAccionMesDia5(vista, "m_actual");
    assert.equal(d.accion, "omitir");
  });
});
