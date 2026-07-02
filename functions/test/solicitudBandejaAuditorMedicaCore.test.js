"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  itemPasaFiltroIncompleta,
  esIncompletaMedica,
  mapearAdjuntosBandejaAuditor,
  FILTRO_COMPLETAS,
  FILTRO_PROVISORIAS,
  FILTRO_TODAS,
} = require("../modules/shared/solicitudBandejaAuditorMedicaCore");

const {
  resolverCie10DesdeSolBandeja,
  resolverCausalLargaIdDesdeSol,
} = require("../modules/shared/solicitudBandejaAuditorMedicaLargaMeta");

const {
  resolverRangoYmdEfectivoAvisoMedico,
} = require("../modules/shared/avisoMedicoGrillaMdcPayload");

describe("solicitudBandejaAuditorMedicaCore", () => {
  it("esIncompletaMedica lee ingreso_medico", () => {
    assert.equal(esIncompletaMedica({ ingreso_medico: { es_licencia_incompleta: true } }), true);
    assert.equal(esIncompletaMedica({ ingreso_medico: { es_licencia_incompleta: false } }), false);
  });

  it("itemPasaFiltroIncompleta separa completas y provisorias", () => {
    const completa = { es_licencia_incompleta: false };
    const prov = { es_licencia_incompleta: true };
    assert.equal(itemPasaFiltroIncompleta(completa, FILTRO_COMPLETAS), true);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_COMPLETAS), false);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_PROVISORIAS), true);
    assert.equal(itemPasaFiltroIncompleta(completa, FILTRO_PROVISORIAS), false);
    assert.equal(itemPasaFiltroIncompleta(prov, FILTRO_TODAS), true);
  });

  it("resolverCie10DesdeSolBandeja lee mapa inmutable", () => {
    const r = resolverCie10DesdeSolBandeja({
      cie10: { codigo: "B01", descripcion: "Varicela" },
    });
    assert.equal(r.codigo, "B01");
    assert.equal(r.descripcion, "Varicela");
  });

  it("resolverRangoYmdEfectivo incluye aviso con solo fechas estimadas (bandeja auditor)", () => {
    const r = resolverRangoYmdEfectivoAvisoMedico({
      fecha_inicio_reposo_estimada: "2026-08-02",
      fecha_fin_reposo_estimada: "2026-08-18",
    });
    assert.ok(r);
    assert.equal(r.fecha_desde, "2026-08-02");
    assert.equal(r.fecha_hasta, "2026-08-18");
  });

  it("resolverCausalLargaIdDesdeSol prioriza sol_", () => {
    assert.equal(
      resolverCausalLargaIdDesdeSol({ causal_larga_duracion_id: "cfg_cld_abc" }),
      "cfg_cld_abc",
    );
  });

  it("mapearAdjuntosBandejaAuditor expone storage_path para visor", () => {
    const rows = mapearAdjuntosBandejaAuditor({
      ingreso_medico: {
        adjuntos: [
          {
            storage_path: "avisos-med/2026/uid/cert.pdf",
            nombre_archivo: "cert.pdf",
            content_type: "application/pdf",
          },
        ],
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].storage_path, "avisos-med/2026/uid/cert.pdf");
    assert.equal(rows[0].es_pdf, true);
  });

  it("mapearAdjuntosBandejaAuditor ignora filas sin path", () => {
    assert.deepEqual(
      mapearAdjuntosBandejaAuditor({
        ingreso_medico: { adjuntos: [{ nombre_archivo: "x" }] },
      }),
      [],
    );
  });
});
