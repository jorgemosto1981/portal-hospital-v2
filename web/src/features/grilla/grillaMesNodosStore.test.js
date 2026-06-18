import { describe, expect, it, vi } from "vitest";

import {
  buildCellKey,
  createGrillaMesNodoStore,
} from "../../../../shared/utils/grillaMesNodos/index.js";

const GDT = "gdt_test";
const P1 = "per_a";

function vistaMinima() {
  return {
    grupo_trabajo_id: GDT,
    anio: 2026,
    mes: 6,
    filas: [
      {
        persona_id: P1,
        dias: {
          "05": { turno_codigo: "M", k: 1 },
          "06": { turno_codigo: "T", k: 2 },
        },
      },
    ],
  };
}

describe("createGrillaMesNodoStore", () => {
  it("hidrata celdas y getCelda devuelve base", () => {
    const store = createGrillaMesNodoStore();
    store.hidratarDesdeListadoVista(vistaMinima());
    const key = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-05" });
    const view = store.getCelda(key);
    expect(view.base).toEqual({ turno_codigo: "M", k: 1 });
    expect(view.pending).toBe(false);
    expect(store.getRevision(key)).toBe(1);
  });

  it("aplicarOpLocal marca pending y revocar limpia", () => {
    const store = createGrillaMesNodoStore();
    store.hidratarDesdeListadoVista(vistaMinima());
    const op = {
      id: "op_1",
      tipo: "adicional",
      grupo_trabajo_id: GDT,
      persona_id: P1,
      fechaYmd: "2026-06-05",
    };
    const key = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-05" });
    const rev0 = store.getRevision(key);
    store.aplicarOpLocal(op);
    expect(store.getCelda(key).pending).toBe(true);
    expect(store.getOpsEnCelda(key)).toEqual(["op_1"]);
    expect(store.getRevision(key)).toBeGreaterThan(rev0);

    store.revocarOpLocal("op_1");
    expect(store.getCelda(key).pending).toBe(false);
    expect(store.getOpsEnCelda(key)).toEqual([]);
  });

  it("cobertura parcial afecta dos celdas", () => {
    const store = createGrillaMesNodoStore();
    store.hidratarDesdeListadoVista({
      ...vistaMinima(),
      filas: [
        {
          persona_id: P1,
          dias: { "10": { a: 1 } },
        },
        {
          persona_id: "per_b",
          dias: { "11": { b: 1 } },
        },
      ],
    });
    store.aplicarOpLocal({
      id: "op_ix",
      tipo: "cobertura_parcial",
      schema_version: 2,
      grupo_trabajo_id: GDT,
      persona_origen_id: P1,
      persona_cobertura_id: "per_b",
      fecha: "2026-06-10",
      fecha_destino: "2026-06-11",
    });
    const k1 = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-10" });
    const k2 = buildCellKey({ gdt: GDT, persona_id: "per_b", fecha_ymd: "2026-06-11" });
    expect(store.getCelda(k1).pending).toBe(true);
    expect(store.getCelda(k2).pending).toBe(true);
    const kNeutral = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-06" });
    expect(store.getCelda(kNeutral).pending).toBe(false);
  });

  it("confirmarBatch parchea base y quita overlay de ops", () => {
    const store = createGrillaMesNodoStore();
    store.hidratarDesdeListadoVista(vistaMinima());
    const key = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-05" });
    store.aplicarOpLocal({
      id: "op_ok",
      tipo: "adicional",
      grupo_trabajo_id: GDT,
      persona_id: P1,
      fechaYmd: "2026-06-05",
    });
    store.confirmarBatch(["op_ok"], [
      {
        persona_id: P1,
        fecha_ymd: "2026-06-05",
        celda: { turno_codigo: "N", k: 99 },
      },
    ]);
    expect(store.getCelda(key).pending).toBe(false);
    expect(store.getCelda(key).base).toEqual({ turno_codigo: "N", k: 99 });
  });

  it("overlay reemplazaBase sustituye celda merged sin arrastrar analítica", () => {
    const store = createGrillaMesNodoStore();
    store.hidratarDesdeListadoVista(vistaMinima());
    const key = buildCellKey({ gdt: GDT, persona_id: P1, fecha_ymd: "2026-06-05" });
    store.aplicarOpLocal({
      id: "op_r",
      tipo: "reemplazo",
      grupo_trabajo_id: GDT,
      persona_id: P1,
      fechaOrigenYmd: "2026-06-05",
      fechaDestinoYmd: "2026-06-06",
      segmentosTrasladar: ["N"],
      turnoIdDestino: "M",
    });
    store.actualizarOverlaysProyectadosOutbox(
      [
        {
          id: "op_r",
          tipo: "reemplazo",
          grupo_trabajo_id: GDT,
          personaId: P1,
          fechaOrigenYmd: "2026-06-05",
          fechaDestinoYmd: "2026-06-06",
          segmentosTrasladar: ["N"],
          turnoIdDestino: "M",
        },
      ],
      () => ({
        es_franco: true,
        tipo_dia: "franco",
        analitica_cumplimiento: undefined,
      }),
    );
    const merged = store.getCeldaMerged(key);
    expect(merged?.es_franco).toBe(true);
    expect(merged?.k).toBeUndefined();
  });

  it("subscribe notifica keys cambiadas", () => {
    const fn = vi.fn();
    const store = createGrillaMesNodoStore();
    store.subscribe(fn);
    store.hidratarDesdeListadoVista(vistaMinima());
    expect(fn).toHaveBeenCalled();
    const keys = fn.mock.calls[0][0];
    expect(keys.size).toBe(2);
  });
});
