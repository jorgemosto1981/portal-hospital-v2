import { describe, expect, it } from "vitest";

import {
  buildCellKey,
  buildRowKey,
  cellKeyEquals,
  nodosAfectadosPorOp,
  nodosAfectadosPorOps,
  parseCellKey,
  parseRowKey,
  paresCeldaDesdeOp,
} from "../../../../shared/utils/grillaMesNodos/index.js";
import { opAfectaDia } from "./grillaCambioTurnoPropioPreview.js";

const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const P1 = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const P2 = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";

describe("grillaMesNodoKeys", () => {
  it("buildCellKey y parseCellKey round-trip", () => {
    const key = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-18" });
    expect(key).toBe(`cell|${GDT}|${P1}|2026-06-18`);
    expect(parseCellKey(key)).toEqual({
      gdt: GDT,
      persona_id: P1,
      fecha_ymd: "2026-06-18",
    });
  });

  it("cellKeyEquals compara parts y strings", () => {
    const a = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-01" });
    expect(cellKeyEquals(a, { gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-01" })).toBe(true);
    expect(cellKeyEquals(a, buildCellKey({ gdt: GDT, persona_id: P2, fecha_ymd: "2026-06-01" }))).toBe(
      false,
    );
  });

  it("buildRowKey y parseRowKey", () => {
    const rk = buildRowKey({ gdt: GDT, periodo_ym: "2026-06", fila_id: P1 });
    expect(parseRowKey(rk)).toEqual({ gdt: GDT, periodo_ym: "2026-06", fila_id: P1 });
  });
});

describe("grillaMesNodoImpacto", () => {
  it("intercambio guardia batch v2: dos celdas (origen y destino)", () => {
    const op = {
      tipo: "cobertura_parcial",
      schema_version: 2,
      grupo_trabajo_id: GDT,
      persona_origen_id: P1,
      persona_cobertura_id: P2,
      fecha: "2026-06-15",
      fecha_destino: "2026-06-16",
    };
    const keys = nodosAfectadosPorOp(op);
    expect(keys.size).toBe(2);
    expect(keys.has(buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-15" }))).toBe(true);
    expect(keys.has(buildCellKey({ gdt: GDT, persona_id: P2, fecha_ymd: "2026-06-16" }))).toBe(true);
  });

  it("intercambio mismo día: dos personas una fecha", () => {
    const op = {
      tipo: "cobertura_parcial",
      grupoId: GDT,
      persona_origen_id: P1,
      persona_cobertura_id: P2,
      fecha: "2026-06-18",
      fecha_destino: "2026-06-18",
    };
    expect(nodosAfectadosPorOp(op).size).toBe(2);
  });

  it("reemplazo: dos fechas misma persona", () => {
    const op = {
      tipo: "reemplazo",
      grupo_trabajo_id: GDT,
      personaId: P1,
      fechaOrigenYmd: "2026-06-10",
      fechaDestinoYmd: "2026-06-12",
    };
    const keys = nodosAfectadosPorOp(op);
    expect(keys.size).toBe(2);
    expect(opAfectaDia(op, P1, "2026-06-10")).toBe(true);
    expect(opAfectaDia(op, P1, "2026-06-12")).toBe(true);
    expect(opAfectaDia(op, P1, "2026-06-11")).toBe(false);
  });

  it("adicional: una celda", () => {
    const op = {
      tipo: "adicional",
      grupo_trabajo_id: GDT,
      persona_id: P2,
      fechaYmd: "2026-06-20",
    };
    expect(nodosAfectadosPorOp(op).size).toBe(1);
  });

  it("nodosAfectadosPorOps deduplica", () => {
    const ops = [
      {
        tipo: "adicional",
        grupo_trabajo_id: GDT,
        persona_id: P1,
        fecha: "2026-06-05",
      },
      {
        tipo: "adicional",
        grupo_trabajo_id: GDT,
        persona_id: P1,
        fechaYmd: "2026-06-05",
      },
    ];
    expect(nodosAfectadosPorOps(ops).size).toBe(1);
  });

  it("paresCeldaDesdeOp coincide con opAfectaDia para cada par", () => {
    const op = {
      tipo: "cobertura_parcial",
      schema_version: 2,
      grupo_trabajo_id: GDT,
      persona_origen_id: P1,
      personaDestinoId: P2,
      fecha: "2026-06-13",
      fecha_destino: "2026-06-14",
      fechaOrigenYmd: "2026-06-13",
      fechaDestinoYmd: "2026-06-14",
    };
    for (const par of paresCeldaDesdeOp(op)) {
      expect(opAfectaDia(op, par.persona_id, par.fecha_ymd)).toBe(true);
    }
  });
});
