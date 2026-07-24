"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolverFechasPaseGdt } = require("../modules/organizacion/paseGdtFechas");
const {
  encontrarSolapeHlgEnFecha,
  actorPuedePasarDesdeOrigen,
} = require("../modules/organizacion/ejecutarPaseInternoGdtCore");
const { hlgVigenteEnFecha } = require("../modules/shared/solicitudHlgVigencia");

describe("paseGdtFechas", () => {
  it("fecha_inicio destino = fecha_efectiva + 1", () => {
    const r = resolverFechasPaseGdt("2026-07-24");
    assert.equal(r.ok, true);
    assert.equal(r.fecha_efectiva, "2026-07-24");
    assert.equal(r.fecha_inicio_destino, "2026-07-25");
  });

  it("rechaza fecha inválida", () => {
    assert.equal(resolverFechasPaseGdt("24/07/2026").ok, false);
  });
});

describe("ejecutarPaseInternoGdtCore helpers", () => {
  it("bloquea auto-pase aunque el actor sea RRHH", async () => {
    const { ejecutarPaseInternoGdtCore } = require("../modules/organizacion/ejecutarPaseInternoGdtCore");
    const r = await ejecutarPaseInternoGdtCore(/** @type {any} */ (null), {
      agentePersonaId: "per_01TESTAGENTE0000000000000",
      hlgOrigenId: "hlg_01TESTORIGEN00000000000000",
      gdtDestinoId: "gdt_01TESTDESTINO000000000000",
      fechaEfectivaYmd: "2026-07-24",
      motivo: "intento auto pase",
      solicitantePersonaId: "per_01TESTAGENTE0000000000000",
      esRrhh: true,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "failed-precondition");
    assert.match(String(r.message || ""), /vos mismo/i);
  });

  it("hlg vigente inclusivo: último día en origen cuenta; día siguiente no", () => {
    const hlg = {
      id: "hlg_1",
      fecha_inicio: "2020-01-01",
      fecha_fin: "2026-07-24",
      activo: true,
    };
    assert.equal(hlgVigenteEnFecha(hlg, "2026-07-24"), true);
    assert.equal(hlgVigenteEnFecha(hlg, "2026-07-25"), false);
  });

  it("encontrarSolapeHlgEnFecha ignora el HLg excluido y detecta otros", () => {
    const rows = [
      {
        id: "hlg_origen",
        fecha_inicio: "2020-01-01",
        fecha_fin: "2026-07-24",
        activo: true,
      },
      {
        id: "hlg_otro",
        fecha_inicio: "2026-07-20",
        fecha_fin: null,
        activo: true,
      },
    ];
    assert.equal(encontrarSolapeHlgEnFecha(rows, "2026-07-25", "hlg_origen")?.id, "hlg_otro");
    assert.equal(
      encontrarSolapeHlgEnFecha(
        [{ id: "hlg_origen", fecha_inicio: "2020-01-01", fecha_fin: "2026-07-24", activo: true }],
        "2026-07-25",
        "hlg_origen",
      ),
      null,
    );
  });

  it("actorPuedePasarDesdeOrigen: mismo GDT exige nivel superior; ancestro OK", () => {
    const nodos = [
      { id: "gdt_root", parent_group_id: null },
      { id: "gdt_mid", parent_group_id: "gdt_root" },
      { id: "gdt_leaf", parent_group_id: "gdt_mid" },
    ];
    const byId = new Map(nodos.map((n) => [n.id, n]));
    const raicesMid = new Set(["gdt_mid"]);

    assert.equal(
      actorPuedePasarDesdeOrigen({
        byId,
        raizIds: raicesMid,
        actorVigentes: [{ grupo_de_trabajo_id: "gdt_mid", nivel_jerarquico: 50 }],
        gdtOrigen: "gdt_mid",
        nivelAgente: 10,
      }),
      true,
    );
    assert.equal(
      actorPuedePasarDesdeOrigen({
        byId,
        raizIds: raicesMid,
        actorVigentes: [{ grupo_de_trabajo_id: "gdt_mid", nivel_jerarquico: 10 }],
        gdtOrigen: "gdt_mid",
        nivelAgente: 50,
      }),
      false,
    );
    assert.equal(
      actorPuedePasarDesdeOrigen({
        byId,
        raizIds: raicesMid,
        actorVigentes: [{ grupo_de_trabajo_id: "gdt_mid", nivel_jerarquico: 50 }],
        gdtOrigen: "gdt_leaf",
        nivelAgente: 10,
      }),
      true,
    );
    assert.equal(
      actorPuedePasarDesdeOrigen({
        byId,
        raizIds: raicesMid,
        actorVigentes: [{ grupo_de_trabajo_id: "gdt_mid", nivel_jerarquico: 50 }],
        gdtOrigen: "gdt_root",
        nivelAgente: 10,
      }),
      false,
    );
  });
});
