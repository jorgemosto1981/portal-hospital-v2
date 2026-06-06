"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  mergeCeldaPlanConResolucion,
  inferirTurnoIdDesdeRegimen,
  esRegimenDerivado,
} = require("../modules/asistencia/planEnriquecimientoDias.js");

describe("mergeCeldaPlanConResolucion — R0 integridad plan", () => {
  const regimenFijo = {
    tipo_patron: "fijo",
    turnos_disponibles: [
      { turno_id: "cfg_turno_m", ingreso: "08:00", egreso: "14:00" },
    ],
  };

  it("fijo: ignora input cliente laborable en feriado → no_laborable", () => {
    const out = mergeCeldaPlanConResolucion({
      regimen: regimenFijo,
      raw: { tipo_dia: "laborable", turno_id: null },
      res: {
        tipo_dia: "no_laborable",
        es_feriado: true,
        turno_teorico: null,
      },
    });
    assert.equal(out.tipo_dia, "no_laborable");
    assert.equal(out.turno_id, null);
  });

  it("fijo: laborable infiere turno_id por horario en turnos_disponibles", () => {
    const out = mergeCeldaPlanConResolucion({
      regimen: regimenFijo,
      raw: {},
      res: {
        tipo_dia: "laborable",
        turno_teorico: { ingreso: "08:00", egreso: "14:00", turno_id: null },
      },
    });
    assert.equal(out.tipo_dia, "laborable");
    assert.equal(out.turno_id, "cfg_turno_m");
  });

  it("fijo: 08-14 contenido en M 06-14 del plan (poolExtra)", () => {
    const regimenFijoInline = {
      id: "CFG_REG_HOR_TEST",
      tipo_patron: "fijo",
      dias: [
        {
          dia_semana: 4,
          tipo_dia: "laborable",
          turno: { ingreso: "08:00", egreso: "14:00", horas_efectivas: 6 },
        },
      ],
    };
    const poolExtra = [{ turno_id: "M", ingreso: "06:00", egreso: "14:00" }];
    const out = mergeCeldaPlanConResolucion({
      regimen: regimenFijoInline,
      raw: {},
      res: {
        tipo_dia: "laborable",
        turno_teorico: { ingreso: "08:00", egreso: "14:00", turno_id: null },
      },
      poolExtra,
    });
    assert.equal(out.turno_id, "M");
  });

  it("planificado: feriado resuelto pisa laborable del cliente", () => {
    const regimenPlan = { tipo_patron: "planificado", turnos_disponibles: [] };
    const out = mergeCeldaPlanConResolucion({
      regimen: regimenPlan,
      raw: { tipo_dia: "laborable", turno_id: "cfg_turno_m" },
      res: {
        tipo_dia: "no_laborable",
        es_feriado: true,
        turno_teorico: null,
      },
    });
    assert.equal(out.tipo_dia, "no_laborable");
    assert.equal(out.turno_id, null);
  });

  it("planificado: conserva turno_id del jefe si resolución laborable", () => {
    const regimenPlan = {
      tipo_patron: "planificado",
      turnos_disponibles: [{ turno_id: "cfg_turno_m", ingreso: "06:00", egreso: "14:00" }],
    };
    const out = mergeCeldaPlanConResolucion({
      regimen: regimenPlan,
      raw: { tipo_dia: "laborable", turno_id: "cfg_turno_m" },
      res: {
        tipo_dia: "laborable",
        turno_teorico: { turno_id: "cfg_turno_m" },
      },
    });
    assert.equal(out.tipo_dia, "laborable");
    assert.equal(out.turno_id, "cfg_turno_m");
  });

  it("planificado: infiere turno_id desde ingreso/egreso persistidos sin turno_id", () => {
    const regimenPlan = {
      tipo_patron: "planificado",
      turnos_disponibles: [
        { turno_id: "cfg_reg_turno_01_manana", ingreso: "08:00", egreso: "12:00" },
      ],
    };
    const out = mergeCeldaPlanConResolucion({
      regimen: regimenPlan,
      raw: { tipo_dia: "laborable", turno_id: null, ingreso: "08:00", egreso: "14:00" },
      res: { tipo_dia: "laborable", turno_teorico: null },
    });
    assert.equal(out.tipo_dia, "laborable");
    assert.equal(out.turno_id, "cfg_reg_turno_01_manana");
  });
});

describe("inferirTurnoIdDesdeRegimen", () => {
  it("fallback: ingreso único cuando egreso del régimen no está en catálogo", () => {
    const regimen = {
      turnos_disponibles: [
        { turno_id: "cfg_reg_turno_01_manana", ingreso: "08:00", egreso: "12:00" },
        { turno_id: "cfg_reg_turno_02_tarde", ingreso: "14:00", egreso: "18:00" },
      ],
    };
    assert.equal(
      inferirTurnoIdDesdeRegimen(regimen, { ingreso: "08:00", egreso: "14:00" }),
      "cfg_reg_turno_01_manana",
    );
  });

  it("fijo inline: id estable ≤32 si no hay catálogo cruzado", () => {
    const regimen = {
      id: "CFG_REG_HOR_X",
      tipo_patron: "fijo",
      dias: [
        {
          dia_semana: 5,
          tipo_dia: "laborable",
          turno: { ingreso: "08:00", egreso: "14:00" },
        },
      ],
    };
    const id = inferirTurnoIdDesdeRegimen(regimen, { ingreso: "08:00", egreso: "14:00" });
    assert.equal(id, "rh_HOR_X_08001400");
    assert.ok(id.length <= 32);
  });

  it("08-14 elige M sobre M+T cuando ambos contienen el horario", () => {
    const regimen = { id: "CFG_REG_HOR_TEST", tipo_patron: "fijo", dias: [] };
    const poolExtra = [
      { turno_id: "M", ingreso: "06:00", egreso: "14:00" },
      { turno_id: "M+T", ingreso: "06:00", egreso: "22:00" },
    ];
    assert.equal(
      inferirTurnoIdDesdeRegimen(regimen, { ingreso: "08:00", egreso: "14:00" }, poolExtra),
      "M",
    );
  });
});

describe("esRegimenDerivado", () => {
  it("fijo y rotativo son derivados", () => {
    assert.equal(esRegimenDerivado({ tipo_patron: "fijo" }), true);
    assert.equal(esRegimenDerivado({ tipo_patron: "rotativo" }), true);
    assert.equal(esRegimenDerivado({ tipo_patron: "planificado" }), false);
  });
});
