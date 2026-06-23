"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBatchOp } = require("../modules/asistencia/cambiosTurno.js");
const {
  CFG_TCC_CAMBIO_INTERNO,
  CFG_TOV_COBERTURA_PARCIAL,
} = require("../modules/shared/cfgAsistenciaTurnosIds.js");
const {
  evaluarTopeMovimientosBatch,
  derivarIncrementosTopeDesdeBatchItems,
  contarMovimientosTramoDia,
  mapaConteoHistoricoTope,
} = require("../modules/shared/topeMovimientosGestionTurno.js");

const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const PER_A = "per_01KR3HD24AMJ6YX3N7B3GPAZJ4";
const PER_B = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const VIGENTE = "2026-06-01T00:00:00.000Z";
const TOKEN = "2026-06-02T12:00:00.000Z";

function mkBase(overrides = {}) {
  return {
    id: "op_test",
    concurrencia: { expected_version_token: TOKEN },
    context: { grupo_id: GDT, periodo: "2026-06" },
    ...overrides,
  };
}

function histTrasladoOrigen({ batchId, fecha, seg, creado = "2026-06-10T10:00:00.000Z" }) {
  return {
    persona_id_doc: PER_A,
    fecha_ymd: fecha,
    tipo: "reemplazo",
    reemplazo_traslado_v2: "origen",
    fecha_origen: fecha,
    fecha_destino: "2026-06-26",
    segmentos_a_trasladar: [seg],
    grupo_de_trabajo_id: GDT,
    op_batch_id: batchId,
    creado_en: creado,
    es_override_manual: true,
  };
}

describe("topeMovimientosGestionTurno", () => {
  it("patrón d25: tres tramos distintos no bloquean al tercer batch en otro tramo", () => {
    const hist = [
      histTrasladoOrigen({ batchId: "b1", fecha: "2026-06-25", seg: "M" }),
      histTrasladoOrigen({ batchId: "b2", fecha: "2026-06-25", seg: "T" }),
    ];
    const opN = mkBase({
      id: "b3",
      tipo: "reemplazo",
      payload: {
        persona_id: PER_A,
        fecha_origen: "2026-06-25",
        fecha_destino: "2026-06-26",
        segmentos_a_trasladar: ["N"],
        segmentos_incorporados_destino: ["N"],
        turno_id: "N",
        motivo: "Traslado tramo noche",
      },
    });
    const items = normalizeBatchOp(opN, 0);
    const batchItems = Array.isArray(items) ? items : [items];
    const res = evaluarTopeMovimientosBatch({
      overridesEnriquecidos: hist,
      batchItems,
      vigenteDesde: VIGENTE,
      tope: 2,
    });
    assert.equal(res.ok, true);
  });

  it("ida y vuelta mismo tramo: tercer movimiento bloqueado", () => {
    const hist = [
      histTrasladoOrigen({ batchId: "b1", fecha: "2026-06-12", seg: "M" }),
      histTrasladoOrigen({ batchId: "b2", fecha: "2026-06-12", seg: "M", creado: "2026-06-12T14:00:00.000Z" }),
    ];
    const op3 = mkBase({
      id: "b3",
      tipo: "reemplazo",
      payload: {
        persona_id: PER_A,
        fecha_origen: "2026-06-12",
        fecha_destino: "2026-06-13",
        segmentos_a_trasladar: ["M"],
        segmentos_incorporados_destino: ["M"],
        turno_id: "M",
        motivo: "Tercer cambio mismo tramo",
      },
    });
    const items = normalizeBatchOp(op3, 0);
    const batchItems = Array.isArray(items) ? items : [items];
    const res = evaluarTopeMovimientosBatch({
      overridesEnriquecidos: hist,
      batchItems,
      vigenteDesde: VIGENTE,
      tope: 2,
    });
    assert.equal(res.ok, false);
    assert.ok(res.violaciones.some((v) => v.segmento_id_canon === "M"));
  });

  it("intercambio v2 suma +1 por agente y tramo", () => {
    const op = mkBase({
      id: "swap1",
      tipo: "cobertura_parcial",
      concurrencia: {
        expected_version_token: TOKEN,
        expected_version_token_destino: TOKEN,
      },
      payload: {
        origen: { persona_id: PER_A, fecha: "2026-06-08", segmentos_cedidos: ["T"] },
        destino: { persona_id: PER_B, fecha: "2026-06-08", segmentos_cedidos: ["N"] },
        motivo: "Intercambio guardia",
        tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
      },
    });
    const item = normalizeBatchOp(op, 0);
    const incs = derivarIncrementosTopeDesdeBatchItems([item]);
    assert.equal(incs.length, 2);
    assert.ok(incs.some((x) => x.persona_id === PER_A && x.segmento_id_canon === "T"));
    assert.ok(incs.some((x) => x.persona_id === PER_B && x.segmento_id_canon === "N"));
  });

  it("reemplazo clásico no incrementa contador", () => {
    const op = mkBase({
      tipo: "reemplazo",
      payload: {
        persona_id: PER_A,
        fecha: "2026-06-10",
        tipo: "reemplazo",
        turno_id: "M",
        motivo: "Cambio clásico",
      },
    });
    const item = normalizeBatchOp(op, 0);
    const incs = derivarIncrementosTopeDesdeBatchItems([item]);
    assert.equal(incs.length, 0);
  });

  it("contarMovimientosTramoDia respeta vigente_desde", () => {
    const hist = [
      {
        ...histTrasladoOrigen({ batchId: "old", fecha: "2026-06-05", seg: "M", creado: "2026-05-01T00:00:00.000Z" }),
      },
      {
        ...histTrasladoOrigen({ batchId: "new", fecha: "2026-06-05", seg: "M", creado: "2026-06-05T12:00:00.000Z" }),
      },
    ];
    const n = contarMovimientosTramoDia({
      overridesMes: hist,
      persona_id: PER_A,
      fecha_ymd: "2026-06-05",
      segmento_id: "M",
      gdt: GDT,
      vigenteDesde: VIGENTE,
    });
    assert.equal(n, 1);
    const map = mapaConteoHistoricoTope(hist, VIGENTE);
    assert.equal(map.size, 1);
  });
});
