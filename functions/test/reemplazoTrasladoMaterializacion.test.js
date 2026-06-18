"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  clasificarReemplazosParaMaterializacion,
  esLegTrasladoReemplazoV2,
  aplicarQuitaSegmentosTrasladoOrigen,
  esTrasladoOrigenAplicableEnDia,
} = require("../modules/asistencia/rdaTurnoTeoricoWorker");

describe("clasificarReemplazosParaMaterializacion", () => {
  it("destino v2 no entra en reemplazosClassic (no pisa turno N del plan)", () => {
    const destino = {
      tipo: "reemplazo",
      reemplazo_traslado_v2: "destino",
      fecha_origen: "2026-06-11",
      fecha_destino: "2026-06-12",
      turno_id: "cfg_reg_turno_t",
      segmentos_incorporados_destino: ["cfg_reg_turno_t"],
    };
    const { trasladoDestinoV2, reemplazosClassic } = clasificarReemplazosParaMaterializacion(
      [destino],
      "2026-06-12",
    );
    assert.equal(trasladoDestinoV2.length, 1);
    assert.equal(reemplazosClassic.length, 0);
    assert.equal(esLegTrasladoReemplazoV2(destino), true);
  });

  it("reemplazo clásico sin traslado sigue en reemplazosClassic", () => {
    const classic = {
      tipo: "reemplazo",
      turno_id: "cfg_reg_turno_m",
      motivo: "cambio",
    };
    const { reemplazosClassic, trasladoDestinoV2 } = clasificarReemplazosParaMaterializacion(
      [classic],
      "2026-06-12",
    );
    assert.equal(reemplazosClassic.length, 1);
    assert.equal(trasladoDestinoV2.length, 0);
  });

  it("pierna origen no aplica al materializar el día destino", () => {
    const origen = {
      tipo: "reemplazo",
      reemplazo_traslado_v2: "origen",
      fecha_origen: "2026-06-11",
      fecha_destino: "2026-06-12",
      segmentos_a_trasladar: ["cfg_reg_turno_n"],
      franco_en_origen: true,
    };
    assert.equal(esTrasladoOrigenAplicableEnDia(origen, "2026-06-11"), true);
    assert.equal(esTrasladoOrigenAplicableEnDia(origen, "2026-06-12"), false);
    const { trasladoOrigenV2 } = clasificarReemplazosParaMaterializacion([origen], "2026-06-12");
    assert.equal(trasladoOrigenV2.length, 0);
  });

  it("pierna origen intra-día (fo=fd) no aplica al materializar ese día", () => {
    const intra = {
      tipo: "reemplazo",
      reemplazo_traslado_v2: "origen",
      fecha_origen: "2026-06-12",
      fecha_destino: "2026-06-12",
      segmentos_a_trasladar: ["N"],
      franco_en_origen: true,
    };
    const { trasladoOrigenV2 } = clasificarReemplazosParaMaterializacion([intra], "2026-06-12");
    assert.equal(trasladoOrigenV2.length, 0);
  });

  it("quita segmento N en origen aunque el id trasladado sea alias (N vs cfg_reg_turno_n)", () => {
    const regimen = {
      turnos_disponibles: [
        { turno_id: "cfg_reg_turno_n", sigla: "N", ingreso: "19:00", egreso: "07:00" },
      ],
    };
    const origenOv = {
      reemplazo_traslado_v2: "origen",
      fecha_origen: "2026-06-11",
      fecha_destino: "2026-06-12",
      segmentos_a_trasladar: ["N"],
    };
    const segmentos = [
      {
        segmento_id: "cfg_reg_turno_n",
        persona_titular_id: "per_x",
        persona_ejecutante_id: "per_x",
      },
    ];
    const out = aplicarQuitaSegmentosTrasladoOrigen(segmentos, [origenOv], regimen);
    assert.equal(out.length, 0);
  });
});
