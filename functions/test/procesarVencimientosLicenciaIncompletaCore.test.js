"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");

const {
  esCandidatoVencimientoIncompleta,
  ESTADO_RECHAZADA,
  MOTIVO_RECHAZO_VENCIMIENTO_INCOMPLETA,
} = require("../modules/shared/procesarVencimientosLicenciaIncompletaCore");
const {
  ESTADO_PENDIENTE_CLASIFICACION,
  SCHEMA_MED_AVISO,
} = require("../modules/shared/avisoMedicoProvisoriosVigentesCore");

describe("esCandidatoVencimientoIncompleta", () => {
  const past = Timestamp.fromMillis(Date.now() - 60_000);
  const future = Timestamp.fromMillis(Date.now() + 3_600_000);

  const base = {
    schema_version: SCHEMA_MED_AVISO,
    estado_solicitud_id: ESTADO_PENDIENTE_CLASIFICACION,
    ingreso_medico: { es_licencia_incompleta: true },
    vencimiento_plazo_certificado: past,
  };

  it("acepta incompleta vencida en pendiente", () => {
    assert.equal(esCandidatoVencimientoIncompleta(base), true);
  });

  it("rechaza plazo futuro", () => {
    assert.equal(esCandidatoVencimientoIncompleta({ ...base, vencimiento_plazo_certificado: future }), false);
  });

  it("rechaza ya completa", () => {
    assert.equal(
      esCandidatoVencimientoIncompleta({
        ...base,
        ingreso_medico: { es_licencia_incompleta: false },
      }),
      false,
    );
  });

  it("rechaza estado distinto de pendiente", () => {
    assert.equal(
      esCandidatoVencimientoIncompleta({ ...base, estado_solicitud_id: ESTADO_RECHAZADA }),
      false,
    );
  });
});

describe("procesarVencimientosLicenciaIncompleta — constantes", () => {
  it("motivo documental del catálogo seed", () => {
    assert.equal(MOTIVO_RECHAZO_VENCIMIENTO_INCOMPLETA, "cfg_mrs_doc_incompleta");
  });
});
