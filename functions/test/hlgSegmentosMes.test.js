"use strict";

/**
 * node --test functions/test/hlgSegmentosMes.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFilaId,
  hlgSegmentosMes,
  filtrarDiasPorTramo,
  buildPersonaLabelConCarga,
  limitarTramosPorPersonasUnicas,
  hlgSolapaMes,
  rangoMes,
} = require("../modules/shared/hlgSegmentosMes");

const PER = "per_01TEST";
const GDT = "gdt_01TEST";
const HLG_A = "hlg_A";
const HLG_B = "hlg_B";

describe("hlgSegmentosMes", () => {
  it("genera dos tramos CONTIGUOUS en junio 2026 sin deduplicar persona", () => {
    const tramos = hlgSegmentosMes(
      [
        {
          hlg_id: HLG_A,
          persona_id: PER,
          grupo_de_trabajo_id: GDT,
          regimen_horario_id: "reg_12",
          fecha_inicio: "2026-02-02",
          fecha_fin: "2026-06-10",
        },
        {
          hlg_id: HLG_B,
          persona_id: PER,
          grupo_de_trabajo_id: GDT,
          regimen_horario_id: "reg_40",
          fecha_inicio: "2026-06-11",
          fecha_fin: null,
        },
      ],
      2026,
      6,
    );

    assert.equal(tramos.length, 2);
    assert.equal(tramos[0].fila_id, buildFilaId(PER, HLG_A));
    assert.equal(tramos[0].vigente_desde, "2026-06-01");
    assert.equal(tramos[0].vigente_hasta, "2026-06-10");
    assert.equal(tramos[1].vigente_desde, "2026-06-11");
    assert.equal(tramos[1].vigente_hasta, "2026-06-30");
  });

  it("excluye HLg que no solapan el mes", () => {
    const tramos = hlgSegmentosMes(
      [
        {
          hlg_id: HLG_A,
          persona_id: PER,
          grupo_de_trabajo_id: GDT,
          fecha_inicio: "2025-01-01",
          fecha_fin: "2025-12-31",
        },
      ],
      2026,
      6,
    );
    assert.equal(tramos.length, 0);
  });
});

describe("filtrarDiasPorTramo", () => {
  it("conserva solo días dentro del tramo", () => {
    const dias = {
      "09": { tipo_dia: "laborable" },
      "10": { tipo_dia: "franco" },
      "11": { tipo_dia: "laborable" },
      "12": { tipo_dia: "laborable" },
    };
    const out = filtrarDiasPorTramo(dias, "2026-06-10", "2026-06-11");
    assert.deepEqual(Object.keys(out).sort(), ["10", "11"]);
    assert.equal(out["10"].tipo_dia, "franco");
    assert.equal(out["11"].tipo_dia, "laborable");
    assert.equal(out["09"], undefined);
  });
});

describe("limitarTramosPorPersonasUnicas", () => {
  it("limita por persona_id únicos pero conserva todos los tramos incluidos", () => {
    const tramos = [
      { persona_id: "per_1", hlg_id: "h1" },
      { persona_id: "per_1", hlg_id: "h2" },
      { persona_id: "per_2", hlg_id: "h3" },
    ];
    const r = limitarTramosPorPersonasUnicas(tramos, 1);
    assert.equal(r.total_personas_unicas, 2);
    assert.equal(r.truncado, true);
    assert.equal(r.tramos.length, 2);
    assert.ok(r.tramos.every((t) => t.persona_id === "per_1"));
  });
});

describe("buildPersonaLabelConCarga", () => {
  it("añade sufijo de carga horaria", () => {
    assert.equal(buildPersonaLabelConCarga("MOSTO", 12), "MOSTO · 12 hs");
    assert.equal(buildPersonaLabelConCarga("MOSTO", null), "MOSTO");
  });
});

describe("hlgSolapaMes", () => {
  it("detecta solape parcial al inicio/fin de mes", () => {
    const rango = rangoMes(2026, 6);
    assert.equal(
      hlgSolapaMes({ fecha_inicio: "2026-06-15", fecha_fin: null, activo: true }, rango),
      true,
    );
    assert.equal(
      hlgSolapaMes({ fecha_inicio: "2026-07-01", fecha_fin: null, activo: true }, rango),
      false,
    );
  });
});
