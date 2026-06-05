"use strict";

/**
 * node --test functions/test/purgaAgentePlanesPorHlg.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  compararPeriodoConCorte,
  truncarDiasDesdeCorte,
  filtrarAgentePorHlg,
  aplicarPurgaAgenteEnPlan,
} = require("../modules/asistencia/purgaAgentePlanesPorHlg");

describe("compararPeriodoConCorte", () => {
  it("clasifica anterior, mes_corte y posterior", () => {
    assert.equal(compararPeriodoConCorte("2026-05", "2026-06-15"), "anterior");
    assert.equal(compararPeriodoConCorte("2026-06", "2026-06-15"), "mes_corte");
    assert.equal(compararPeriodoConCorte("2026-07", "2026-06-15"), "posterior");
  });
});

describe("truncarDiasDesdeCorte", () => {
  it("conserva días hasta el corte inclusive", () => {
    const out = truncarDiasDesdeCorte(
      { "2026-06-10": { tipo_dia: "laborable" }, "2026-06-20": { tipo_dia: "franco" } },
      "2026-06-15",
    );
    assert.deepEqual(Object.keys(out).sort(), ["2026-06-10"]);
  });
});

describe("filtrarAgentePorHlg", () => {
  it("quita solo el agente con hlg_id", () => {
    const agentes = [
      { persona_id: "per_a", hlg_id: "hlg_1" },
      { persona_id: "per_b", hlg_id: "hlg_2" },
    ];
    const { next, removed } = filtrarAgentePorHlg(agentes, { hlgId: "hlg_1" });
    assert.equal(removed, 1);
    assert.equal(next.length, 1);
    assert.equal(next[0].persona_id, "per_b");
  });
});

describe("aplicarPurgaAgenteEnPlan", () => {
  const basePlan = {
    id: "plt_x",
    tipo_plan: "mensual",
    periodo: "2026-06",
    estado: "HABILITADO",
    plan_rol: "principal",
    agentes: [
      { persona_id: "per_a", hlg_id: "hlg_1", dias: { "2026-06-01": {}, "2026-06-20": {} } },
      { persona_id: "per_b", hlg_id: "hlg_2", dias: {} },
    ],
  };

  it("anulacion elimina bloque del agente", () => {
    const r = aplicarPurgaAgenteEnPlan(basePlan, { hlgId: "hlg_1", modo: "anulacion" });
    assert.equal(r.changed, true);
    assert.equal(r.agentes.length, 1);
    assert.equal(r.agentes[0].hlg_id, "hlg_2");
    assert.ok(r.meta.agentes_hlg_ids.includes("hlg_2"));
    assert.ok(!r.meta.agentes_hlg_ids.includes("hlg_1"));
  });

  it("cierre_hlg trunca dias en mes de corte", () => {
    const r = aplicarPurgaAgenteEnPlan(basePlan, {
      hlgId: "hlg_1",
      modo: "cierre_hlg",
      fechaCorteYmd: "2026-06-10",
    });
    assert.equal(r.changed, true);
    const ag = r.agentes.find((a) => a.hlg_id === "hlg_1");
    assert.ok(ag);
    assert.ok(ag.dias["2026-06-01"]);
    assert.equal(ag.dias["2026-06-20"], undefined);
  });

  it("cierre_hlg elimina agente en mes posterior", () => {
    const planJul = { ...basePlan, periodo: "2026-07" };
    const r = aplicarPurgaAgenteEnPlan(planJul, {
      hlgId: "hlg_1",
      modo: "cierre_hlg",
      fechaCorteYmd: "2026-06-15",
    });
    assert.equal(r.changed, true);
    assert.equal(r.agentes.length, 1);
    assert.equal(r.agentes[0].hlg_id, "hlg_2");
  });

  it("marca plan eliminado si queda sin agentes", () => {
    const solo = { ...basePlan, agentes: [{ persona_id: "per_a", hlg_id: "hlg_1", dias: {} }] };
    const r = aplicarPurgaAgenteEnPlan(solo, { hlgId: "hlg_1", modo: "anulacion" });
    assert.equal(r.eliminado, true);
    assert.equal(r.estado, "CERRADO");
    assert.equal(r.agentes.length, 0);
  });
});
