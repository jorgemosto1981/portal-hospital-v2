"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBatchOp } = require("../modules/asistencia/cambiosTurno.js");
const {
  CFG_TCC_CAMBIO_INTERNO,
  CFG_TOV_COBERTURA_PARCIAL,
} = require("../modules/shared/cfgAsistenciaTurnosIds.js");

const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const PER_X = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const PER_Y = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const TOKEN = "2026-06-02T12:00:00.000Z";
const FECHA = "2026-06-10";

function mkBase(overrides = {}) {
  return {
    id: "op_test",
    concurrencia: { expected_version_token: TOKEN },
    context: { grupo_id: GDT, periodo: "2026-06" },
    ...overrides,
  };
}

describe("normalizeBatchOp", () => {
  it("normaliza cobertura_parcial", () => {
    const item = normalizeBatchOp(mkBase({
      tipo: "cobertura_parcial",
      payload: {
        persona_origen_id: PER_X,
        persona_cobertura_id: PER_Y,
        fecha: FECHA,
        segmentos_cubiertos: ["T"],
        tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
        tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
        tipo: "cobertura_parcial",
        motivo: "Cobertura tramo tarde",
      },
    }), 0);
    assert.equal(item.tipo, "cobertura_parcial");
    assert.equal(item.persona_origen_id, PER_X);
    assert.equal(item.persona_cobertura_id, PER_Y);
    assert.equal(item.override.motivo, "Cobertura tramo tarde");
  });

  it("normaliza reemplazo", () => {
    const item = normalizeBatchOp(mkBase({
      tipo: "reemplazo",
      payload: {
        persona_id: PER_X,
        fecha: FECHA,
        tipo: "reemplazo",
        turno_id: "M",
        ingreso: "06:00",
        egreso: "14:00",
        horas_efectivas: 8,
        motivo: "Cambio de franco",
      },
    }), 0);
    assert.equal(item.tipo, "reemplazo");
    assert.equal(item.persona_id, PER_X);
    assert.equal(item.override.turno_id, "M");
  });

  it("normaliza adicional legacy (sin estado_previo)", () => {
    const item = normalizeBatchOp(mkBase({
      tipo: "adicional",
      payload: {
        persona_id: PER_X,
        fecha: FECHA,
        tipo: "adicional",
        motivo: "Guardia extra",
      },
    }), 0);
    assert.equal(item.tipo, "adicional");
    assert.equal(item.override.tipo, "adicional");
  });

  it("normaliza adicional v2 (C-BATCH) con estado_previo", () => {
    const item = normalizeBatchOp(mkBase({
      tipo: "adicional",
      payload: {
        persona_id: PER_X,
        fecha: FECHA,
        tipo: "adicional",
        turno_id: "cfg_reg_turno_t",
        turno_id_adicional: "cfg_reg_turno_t",
        motivo: "Emergencia guardia",
        estado_previo: {
          es_franco: false,
          es_feriado: true,
          es_no_laborable: false,
          turno_preasignado_id: "cfg_reg_turno_m",
          horas_preasignadas: 8,
          etiqueta_preasignada: "M",
        },
      },
    }), 0);
    assert.equal(item.tipo, "adicional");
    assert.equal(item.override.turno_id, "cfg_reg_turno_t");
    assert.equal(item.override.estado_previo.horas_preasignadas, 8);
    assert.equal(item.override.estado_previo.etiqueta_preasignada, "M");
    assert.equal(item.override.motivo, "Emergencia guardia");
  });

  it("rechaza adicional v2 con horas_efectivas en payload", () => {
    assert.throws(
      () => normalizeBatchOp(mkBase({
        tipo: "adicional",
        payload: {
          persona_id: PER_X,
          fecha: FECHA,
          turno_id: "cfg_reg_turno_t",
          motivo: "xxx",
          horas_efectivas: 4,
          estado_previo: { horas_preasignadas: 0 },
        },
      }), 0),
      (e) => String(e.message).includes("[C-BATCH-014]"),
    );
  });

  it("rechaza tipo desconocido", () => {
    assert.throws(
      () => normalizeBatchOp(mkBase({ tipo: "otro", payload: { fecha: FECHA } }), 0),
      (e) => String(e.message).includes("[BATCH-002]"),
    );
  });
});
