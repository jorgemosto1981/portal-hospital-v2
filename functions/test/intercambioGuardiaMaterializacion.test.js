"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCapaTeoricaSegmentada,
  ymdHoraToIso,
} = require("../modules/asistencia/capaTeoricaSegmentosCore");

const LOKITO = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const CHAPARRO = "per_01KR3HD24AMJ6YX3N7B3GPAZJ4";
const FECHA = "2026-06-08";

const regimenSala = {
  turnos_disponibles: [
    { turno_id: "M", ingreso: "06:00", egreso: "14:00" },
    { turno_id: "T", ingreso: "14:00", egreso: "22:00" },
    { turno_id: "N", ingreso: "22:00", egreso: "06:00" },
  ],
};

function seg(turnoId, titular, ejecutante) {
  const cruza = turnoId === "N";
  return {
    segmento_id: turnoId,
    ingreso_iso: ymdHoraToIso(FECHA, turnoId === "M" ? "06:00" : turnoId === "T" ? "14:00" : "22:00", 0),
    egreso_iso: ymdHoraToIso(FECHA, turnoId === "M" ? "14:00" : turnoId === "T" ? "22:00" : "06:00", cruza ? 1 : 0),
    fecha_base: FECHA,
    fecha_fin_real: cruza ? "2026-06-09" : FECHA,
    cruza_medianoche: cruza,
    persona_titular_id: titular,
    persona_ejecutante_id: ejecutante,
    origen_segmento: "override_cobertura",
  };
}

describe("intercambio guardia v2 — capa materializada operativa", () => {
  it("LOKITO d8 swap T↔N: operativo M+N (cede T, recibe N de CHAPARRO)", () => {
    const segmentosPostBatch = [
      seg("M", LOKITO, LOKITO),
      seg("T", LOKITO, CHAPARRO),
      seg("N", LOKITO, LOKITO),
    ];
    const capa = buildCapaTeoricaSegmentada({
      fechaYmd: FECHA,
      personaId: LOKITO,
      regimen: regimenSala,
      tipo_dia: "laborable",
      turnoCompuestoId: null,
      origen_segmento: "plan_base",
      indiceCalendario: null,
      segmentosOverride: segmentosPostBatch,
    });
    assert.equal(capa.turno_compuesto_id, "M+N");
    assert.equal(capa.segmentos.length, 2);
    assert.deepEqual(
      capa.segmentos.map((s) => s.segmento_id),
      ["M", "N"],
    );
    assert.equal(capa.tiene_huecos, true);
    assert.equal(capa.fichadas_esperadas, 4);
  });

  it("LOKITO d8 swap M↔N: compuesto T+N sin fantasma M cedido", () => {
    const segmentosPostBatch = [
      seg("M", LOKITO, CHAPARRO),
      seg("T", LOKITO, LOKITO),
      seg("N", LOKITO, LOKITO),
    ];
    const capa = buildCapaTeoricaSegmentada({
      fechaYmd: FECHA,
      personaId: LOKITO,
      regimen: regimenSala,
      tipo_dia: "laborable",
      turnoCompuestoId: null,
      origen_segmento: "plan_base",
      indiceCalendario: null,
      segmentosOverride: segmentosPostBatch,
    });
    assert.equal(capa.turno_compuesto_id, "T+N");
    assert.equal(capa.segmentos.length, 2);
    assert.deepEqual(
      capa.segmentos.map((s) => s.segmento_id),
      ["T", "N"],
    );
    assert.equal(capa.fichadas_esperadas, 2);
  });

  it("CHAPARRO d8 swap T↔N: operativo M+T (cede N, recibe T)", () => {
    const segmentosPostBatch = [
      seg("M", CHAPARRO, CHAPARRO),
      seg("N", CHAPARRO, LOKITO),
      seg("T", CHAPARRO, CHAPARRO),
    ];
    const capa = buildCapaTeoricaSegmentada({
      fechaYmd: FECHA,
      personaId: CHAPARRO,
      regimen: regimenSala,
      tipo_dia: "laborable",
      turnoCompuestoId: null,
      origen_segmento: "plan_base",
      indiceCalendario: null,
      segmentosOverride: segmentosPostBatch,
    });
    assert.equal(capa.turno_compuesto_id, "M+T");
    assert.equal(capa.segmentos.length, 2);
    assert.deepEqual(
      capa.segmentos.map((s) => s.segmento_id),
      ["M", "T"],
    );
    assert.equal(capa.fichadas_esperadas, 2);
  });

  it("CHAPARRO d8 swap M↔N: solo M ejecutado (N cedido a LOKITO)", () => {
    const segmentosPostBatch = [
      seg("M", CHAPARRO, CHAPARRO),
      seg("N", CHAPARRO, LOKITO),
    ];
    const capa = buildCapaTeoricaSegmentada({
      fechaYmd: FECHA,
      personaId: CHAPARRO,
      regimen: regimenSala,
      tipo_dia: "laborable",
      turnoCompuestoId: null,
      origen_segmento: "plan_base",
      indiceCalendario: null,
      segmentosOverride: segmentosPostBatch,
    });
    assert.equal(capa.turno_compuesto_id, "M");
    assert.equal(capa.segmentos.length, 1);
    assert.equal(capa.segmentos[0].segmento_id, "M");
    assert.equal(capa.fichadas_esperadas, 2);
  });
});
