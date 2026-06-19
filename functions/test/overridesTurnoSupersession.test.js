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
});
