"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  aplicarOverridesConSupersession,
  esOverrideActivo,
} = require("../modules/shared/overridesTurnoSupersession");

describe("overridesTurnoSupersession", () => {
  it("revoca override manual activo del mismo gdt antes de append (reemplazo clásico)", () => {
    const gdt = "gdt_01";
    const meta = { uid: "u1", nowIso: "2026-06-01T12:00:00.000Z" };
    const prev = [
      {
        tipo: "reemplazo",
        grupo_de_trabajo_id: gdt,
        es_override_manual: true,
        turno_id: "M",
      },
    ];
    const next = aplicarOverridesConSupersession(
      prev,
      [{ tipo: "reemplazo", grupo_de_trabajo_id: gdt, es_override_manual: true, turno_id: "N" }],
      gdt,
      meta,
    );
    assert.equal(next.length, 2);
    assert.equal(esOverrideActivo(next[0]), false);
    assert.equal(next[0].supersedido_por_nueva_op, true);
    assert.equal(esOverrideActivo(next[1]), true);
    assert.equal(next[1].turno_id, "N");
  });

  it("apila traslado v2 destino T y luego M sin revocar el tramo T", () => {
    const gdt = "gdt_01";
    const meta = { uid: "u1", nowIso: "2026-06-19T12:00:00.000Z" };
    const trasladoT = {
      tipo: "reemplazo",
      grupo_de_trabajo_id: gdt,
      es_override_manual: true,
      reemplazo_traslado_v2: "destino",
      fecha_origen: "2026-06-07",
      fecha_destino: "2026-06-06",
      segmentos_incorporados_destino: ["T"],
      turno_id: "T",
    };
    const afterT = aplicarOverridesConSupersession([], [trasladoT], gdt, meta);
    assert.equal(esOverrideActivo(afterT[0]), true);

    const trasladoM = {
      tipo: "reemplazo",
      grupo_de_trabajo_id: gdt,
      es_override_manual: true,
      reemplazo_traslado_v2: "destino",
      fecha_origen: "2026-06-07",
      fecha_destino: "2026-06-06",
      segmentos_incorporados_destino: ["M"],
      turno_id: "M",
    };
    const afterM = aplicarOverridesConSupersession(afterT, [trasladoM], gdt, meta);
    assert.equal(afterM.length, 2);
    assert.equal(esOverrideActivo(afterM[0]), true);
    assert.equal(afterM[0].turno_id, "T");
    assert.equal(esOverrideActivo(afterM[1]), true);
    assert.equal(afterM[1].turno_id, "M");
  });

  it("re-traslado del mismo segmento revoca el override anterior", () => {
    const gdt = "gdt_01";
    const meta = { uid: "u1", nowIso: "2026-06-19T12:00:00.000Z" };
    const prev = [
      {
        tipo: "reemplazo",
        grupo_de_trabajo_id: gdt,
        es_override_manual: true,
        reemplazo_traslado_v2: "destino",
        fecha_origen: "2026-06-07",
        fecha_destino: "2026-06-06",
        segmentos_incorporados_destino: ["T"],
        turno_id: "T",
      },
    ];
    const next = aplicarOverridesConSupersession(
      prev,
      [{
        tipo: "reemplazo",
        grupo_de_trabajo_id: gdt,
        es_override_manual: true,
        reemplazo_traslado_v2: "destino",
        fecha_origen: "2026-06-08",
        fecha_destino: "2026-06-06",
        segmentos_incorporados_destino: ["T"],
        turno_id: "T",
      }],
      gdt,
      meta,
    );
    assert.equal(next.length, 2);
    assert.equal(esOverrideActivo(next[0]), false);
    assert.equal(esOverrideActivo(next[1]), true);
  });

  it("ida y vuelta: origen en día destino revoca incorporación previa del mismo segmento", () => {
    const gdt = "gdt_01";
    const meta = { uid: "u1", nowIso: "2026-06-19T10:40:00.000Z" };
    const incorporacionM = {
      tipo: "reemplazo",
      grupo_de_trabajo_id: gdt,
      es_override_manual: true,
      reemplazo_traslado_v2: "destino",
      fecha_origen: "2026-06-09",
      fecha_destino: "2026-06-10",
      segmentos_incorporados_destino: ["M"],
      turno_id: "M",
    };
    const afterIda = aplicarOverridesConSupersession([], [incorporacionM], gdt, meta);

    const vueltaOrigenEn10 = {
      tipo: "reemplazo",
      grupo_de_trabajo_id: gdt,
      es_override_manual: true,
      reemplazo_traslado_v2: "origen",
      fecha_origen: "2026-06-10",
      fecha_destino: "2026-06-09",
      segmentos_a_trasladar: ["M"],
    };
    const afterVuelta = aplicarOverridesConSupersession(afterIda, [vueltaOrigenEn10], gdt, meta);
    assert.equal(afterVuelta.length, 2);
    assert.equal(esOverrideActivo(afterVuelta[0]), false);
    assert.equal(afterVuelta[0].supersedido_por_nueva_op, true);
    assert.equal(esOverrideActivo(afterVuelta[1]), true);
    assert.equal(afterVuelta[1].reemplazo_traslado_v2, "origen");
  });

  it("destino M revoca origen franco previo en el mismo día (cadena N luego M)", () => {
    const gdt = "gdt_01";
    const meta = { uid: "u1", nowIso: "2026-06-19T10:56:00.000Z" };
    const origenFrancoN = {
      tipo: "reemplazo",
      grupo_de_trabajo_id: gdt,
      es_override_manual: true,
      reemplazo_traslado_v2: "origen",
      fecha_origen: "2026-06-10",
      fecha_destino: "2026-06-09",
      segmentos_a_trasladar: ["cfg_reg_turno_n"],
      franco_en_origen: true,
    };
    const prev = aplicarOverridesConSupersession([], [origenFrancoN], gdt, meta);
    const destinoM = {
      tipo: "reemplazo",
      grupo_de_trabajo_id: gdt,
      es_override_manual: true,
      reemplazo_traslado_v2: "destino",
      fecha_origen: "2026-06-09",
      fecha_destino: "2026-06-10",
      segmentos_incorporados_destino: ["cfg_reg_turno_m"],
      turno_id: "cfg_reg_turno_m",
    };
    const next = aplicarOverridesConSupersession(prev, [destinoM], gdt, meta);
    assert.equal(next.length, 2);
    assert.equal(esOverrideActivo(next[0]), false);
    assert.equal(esOverrideActivo(next[1]), true);
    assert.equal(next[1].turno_id, "cfg_reg_turno_m");
  });
});
