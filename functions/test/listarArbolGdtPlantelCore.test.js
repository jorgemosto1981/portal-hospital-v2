"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  expandirSubarbolIds,
  construirArbolGdt,
  gdtEnSubarbolDeRaices,
  normalizarNodoGdt,
} = require("../modules/organizacion/listarArbolGdtPlantelCore");

describe("listarArbolGdtPlantelCore", () => {
  const nodos = [
    { id: "gdt_root", nombre: "Root", parent_group_id: null, activo: true },
    { id: "gdt_mid", nombre: "Mid", parent_group_id: "gdt_root", activo: true },
    { id: "gdt_leaf", nombre: "Leaf", parent_group_id: "gdt_mid", activo: true },
    { id: "gdt_other", nombre: "Other", parent_group_id: null, activo: true },
  ];

  it("normalizarNodoGdt filtra ids inválidos", () => {
    assert.equal(normalizarNodoGdt({ nombre: "X" }, "cfg_x"), null);
    assert.equal(normalizarNodoGdt({ nombre: "Alpha", activo: true }, "gdt_a")?.nombre, "Alpha");
  });

  it("expandirSubarbolIds incluye raíces y descendientes", () => {
    const visible = expandirSubarbolIds(nodos, ["gdt_mid"]);
    assert.deepEqual([...visible].sort(), ["gdt_leaf", "gdt_mid"]);
  });

  it("construirArbolGdt acota a visibles", () => {
    const visible = expandirSubarbolIds(nodos, ["gdt_mid"]);
    const arbol = construirArbolGdt(nodos, visible);
    assert.equal(arbol.length, 1);
    assert.equal(arbol[0].id, "gdt_mid");
    assert.equal(arbol[0].children[0].id, "gdt_leaf");
  });

  it("gdtEnSubarbolDeRaices acepta descendientes y niega hermanos/ascendentes", () => {
    const byId = new Map(nodos.map((n) => [n.id, n]));
    const raices = new Set(["gdt_mid"]);
    assert.equal(gdtEnSubarbolDeRaices(byId, "gdt_mid", raices), true);
    assert.equal(gdtEnSubarbolDeRaices(byId, "gdt_leaf", raices), true);
    assert.equal(gdtEnSubarbolDeRaices(byId, "gdt_root", raices), false);
    assert.equal(gdtEnSubarbolDeRaices(byId, "gdt_other", raices), false);
  });
});
