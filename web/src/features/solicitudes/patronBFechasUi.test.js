import { describe, expect, it } from "vitest";

import {
  articuloTieneDiasPreestablecidos,
  fechasSolicitudCompletas,
  resolverDiasSolicitadosPatronB,
} from "./patronBFechasUi.js";

describe("patronBFechasUi", () => {
  it("marca preestablecidos cuando dias_solicitados <= 1", () => {
    expect(articuloTieneDiasPreestablecidos({ dias_solicitados: 1 })).toBe(true);
    expect(articuloTieneDiasPreestablecidos({ dias_solicitados: 3 })).toBe(false);
  });

  it("valida fechas completas y orden", () => {
    expect(fechasSolicitudCompletas("2026-05-10", "2026-05-12")).toBe(true);
    expect(fechasSolicitudCompletas("2026-05-12", "2026-05-10")).toBe(false);
  });

  it("resuelve dias corridos en rango libre", () => {
    expect(resolverDiasSolicitadosPatronB("2026-05-10", "2026-05-12", false, 1)).toBe(3);
    expect(resolverDiasSolicitadosPatronB("2026-05-10", "2026-05-12", true, 2)).toBe(2);
  });
});
