"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCapaTeoricaSegmentada,
  calcularFichadasEsperadas,
} = require("../modules/asistencia/capaTeoricaSegmentosCore");

const regimen = {
  turnos_disponibles: [
    { turno_id: "cfg_reg_turno_01_manana", ingreso: "08:00", egreso: "16:00" },
    { turno_id: "cfg_reg_turno_02_tarde", ingreso: "16:00", egreso: "20:00" },
    { turno_id: "cfg_reg_turno_03_noche", ingreso: "20:00", egreso: "08:00" },
  ],
};

const pid = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const pidYy = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const fecha = "2026-06-10";
const compuesto =
  "cfg_reg_turno_01_manana+cfg_reg_turno_02_tarde+cfg_reg_turno_03_noche";

function capaMtn() {
  return buildCapaTeoricaSegmentada({
    fechaYmd: fecha,
    personaId: pid,
    regimen,
    tipo_dia: "laborable",
    turnoCompuestoId: compuesto,
    origen_segmento: "plan_base",
    indiceCalendario: null,
  });
}

describe("calcularFichadasEsperadas (T-08)", () => {
  it("un bloque continuo (M+T+N) => 2 fichadas", () => {
    const capa = capaMtn();
    assert.equal(calcularFichadasEsperadas({ segmentos: capa.segmentos, personaId: pid }), 2);
    assert.equal(capa.fichadas_esperadas, 2);
  });

  it("dos bloques (cede tarde) => 4 fichadas", () => {
    const capa = capaMtn();
    const cedidos = capa.segmentos.map((s) =>
      s.segmento_id === "cfg_reg_turno_02_tarde"
        ? { ...s, persona_ejecutante_id: pidYy, origen_segmento: "override_cobertura" }
        : s,
    );
    const capaB = buildCapaTeoricaSegmentada({
      fechaYmd: fecha,
      personaId: pid,
      regimen,
      tipo_dia: "laborable",
      turnoCompuestoId: null,
      origen_segmento: "plan_base",
      indiceCalendario: null,
      segmentosOverride: cedidos,
    });
    assert.equal(calcularFichadasEsperadas({ segmentos: capaB.segmentos, personaId: pid }), 4);
    assert.equal(capaB.fichadas_esperadas, 4);
  });

  it("suma expectativas salida momentánea sobre bloque partido", () => {
    const capa = capaMtn();
    const cedidos = capa.segmentos.map((s) =>
      s.segmento_id === "cfg_reg_turno_02_tarde"
        ? { ...s, persona_ejecutante_id: pidYy }
        : s,
    );
    const n = calcularFichadasEsperadas({
      segmentos: cedidos,
      personaId: pid,
      expectativasFichadaExtra: [
        {
          tipo: "salida_momentanea",
          fecha_base: fecha,
          cantidad_fichadas_esperadas: 2,
          patron_esperado: ["egreso", "ingreso"],
        },
      ],
    });
    assert.equal(n, 6);
  });

  it("solo extras sin segmentos propios del titular => 0 base + extras", () => {
    const n = calcularFichadasEsperadas({
      segmentos: [],
      personaId: pid,
      expectativasFichadaExtra: [{ tipo: "salida_momentanea", cantidad_fichadas_esperadas: 3 }],
    });
    assert.equal(n, 3);
  });
});
