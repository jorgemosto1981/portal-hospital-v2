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

  it("normaliza cobertura_parcial v2 (A-BATCH)", () => {
    const item = normalizeBatchOp(mkBase({
      tipo: "cobertura_parcial",
      concurrencia: {
        expected_version_token: TOKEN,
        expected_version_token_destino: "2026-06-03T10:00:00.000Z",
      },
      payload: {
        origen: {
          persona_id: PER_X,
          fecha: "2026-06-05",
          segmentos_cedidos: ["cfg_reg_turno_n"],
        },
        destino: {
          persona_id: PER_Y,
          fecha: "2026-06-12",
          segmentos_cedidos: ["cfg_reg_turno_m"],
        },
        tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
        motivo: "Intercambio guardia bilateral",
        tipo: "cobertura_parcial",
      },
    }), 0);
    assert.equal(item.tipo, "cobertura_parcial");
    assert.equal(item.schema_version, 2);
    assert.equal(item.fecha, "2026-06-05");
    assert.equal(item.fecha_destino, "2026-06-12");
    assert.equal(item.override.segmentos_cedidos_destino[0], "cfg_reg_turno_m");
    assert.equal(item.expected_version_token_destino, "2026-06-03T10:00:00.000Z");
  });

  it("rechaza cobertura v2 sin token destino", () => {
    assert.throws(
      () => normalizeBatchOp(mkBase({
        tipo: "cobertura_parcial",
        concurrencia: { expected_version_token: TOKEN },
        payload: {
          origen: { persona_id: PER_X, fecha: FECHA, segmentos_cedidos: ["cfg_reg_turno_n"] },
          destino: { persona_id: PER_Y, fecha: "2026-06-12", segmentos_cedidos: ["cfg_reg_turno_m"] },
          tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
          motivo: "Intercambio guardia",
        },
      }), 0),
      (e) => String(e.message).includes("[BATCH-A005]"),
    );
  });

  it("normaliza reemplazo v2 (B-BATCH-1) en dos ítems origen/destino", () => {
    const raw = mkBase({
      tipo: "reemplazo",
      payload: {
        persona_id: PER_X,
        fecha: "2026-06-12",
        fecha_origen: "2026-06-10",
        fecha_destino: "2026-06-12",
        segmentos_a_trasladar: ["cfg_reg_turno_n"],
        segmentos_incorporados_destino: ["cfg_reg_turno_t"],
        turno_id: "cfg_reg_turno_t",
        franco_en_origen: false,
        tipo: "reemplazo",
        motivo: "Traslado guardia noche",
      },
    });
    const items = normalizeBatchOp(raw, 0);
    const expanded = Array.isArray(items) ? items : [items];
    assert.equal(expanded.length, 2);
    assert.equal(expanded[0].fecha, "2026-06-10");
    assert.equal(expanded[0].override.reemplazo_traslado_v2, "origen");
    assert.equal(expanded[1].fecha, "2026-06-12");
    assert.equal(expanded[1].override.reemplazo_traslado_v2, "destino");
    assert.equal(expanded[0].op_id, expanded[1].op_id);
  });

  it("rechaza tipo desconocido", () => {
    assert.throws(
      () => normalizeBatchOp(mkBase({ tipo: "otro", payload: { fecha: FECHA } }), 0),
      (e) => String(e.message).includes("[BATCH-002]"),
    );
  });
});
