import { describe, expect, it } from "vitest";

import { grillaDiaCeldaPropsAreEqual } from "./GrillaDiaCelda.jsx";

const base = {
  cellKey: "cell|gdt_x|per_y|2026-06-01",
  revision: 3,
  cell: { a: 1 },
  outboxVisual: null,
  dia: "01",
  fechaYmd: "2026-06-01",
  filaId: "f1",
  personaId: "per_y",
  personaLabel: "Test",
  filaCompuesta: false,
  filaMaterializoLazy: false,
  colEsFinde: false,
  tipoInstCol: null,
  grupoSeleccionado: "gdt_x",
  etiquetasGrupo: {},
  gsoPermiteEscritura: true,
  gsoSoloLecturaMotivo: null,
  modoFichada: null,
  materializacionGrupoReciente: false,
  columnasFichadaAnchas: false,
  alturaChip: "h-[3.25rem]",
  onCeldaClick: () => {},
};

describe("grillaDiaCeldaPropsAreEqual", () => {
  it("evita re-render si revision y contexto estable", () => {
    expect(grillaDiaCeldaPropsAreEqual(base, { ...base })).toBe(true);
  });

  it("re-render si cambia revision del nodo", () => {
    expect(grillaDiaCeldaPropsAreEqual(base, { ...base, revision: 4 })).toBe(false);
  });

  it("re-render si cambia cellKey", () => {
    expect(
      grillaDiaCeldaPropsAreEqual(base, {
        ...base,
        cellKey: "cell|gdt_x|per_z|2026-06-01",
      }),
    ).toBe(false);
  });
});
