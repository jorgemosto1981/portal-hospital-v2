import { describe, expect, it } from "vitest";

import {
  construirArbolGdt,
  expandirSubarbolIds,
  idsGdtDesdeGruposVigentes,
  listarGdtActivos,
  normalizarNodoGdt,
} from "./buildArbolGdt.js";

describe("buildArbolGdt", () => {
  it("normaliza y filtra activos", () => {
    const rows = [
      { id: "gdt_a", nombre: "Alpha", activo: true, parent_group_id: null },
      { id: "gdt_b", nombre: "Beta", activo: false, parent_group_id: "gdt_a" },
      { id: "x", nombre: "Ignorar" },
    ];
    expect(normalizarNodoGdt(rows[0])?.nombre).toBe("Alpha");
    expect(listarGdtActivos(rows).map((n) => n.id)).toEqual(["gdt_a"]);
  });

  it("expande subárbol desde raíces", () => {
    const nodos = [
      { id: "gdt_root", nombre: "Root", parent_group_id: null, activo: true },
      { id: "gdt_mid", nombre: "Mid", parent_group_id: "gdt_root", activo: true },
      { id: "gdt_leaf", nombre: "Leaf", parent_group_id: "gdt_mid", activo: true },
      { id: "gdt_other", nombre: "Other", parent_group_id: null, activo: true },
    ];
    const visible = expandirSubarbolIds(nodos, ["gdt_mid"]);
    expect([...visible].sort()).toEqual(["gdt_leaf", "gdt_mid"]);
    const arbol = construirArbolGdt(nodos, visible);
    expect(arbol).toHaveLength(1);
    expect(arbol[0].id).toBe("gdt_mid");
    expect(arbol[0].children[0].id).toBe("gdt_leaf");
  });

  it("extrae ids desde grupos vigentes", () => {
    expect(
      idsGdtDesdeGruposVigentes([
        { grupo_de_trabajo_id: "gdt_1" },
        { grupo_trabajo_id: "gdt_2" },
        { id: "gdt_1" },
      ]),
    ).toEqual(["gdt_1", "gdt_2"]);
  });
});
