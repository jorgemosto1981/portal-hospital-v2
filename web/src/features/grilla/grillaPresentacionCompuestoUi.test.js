import { describe, expect, it } from "vitest";

import {
  badgesDisciplinaDesdeFilaPresentacion,
  claseVisualPisoCompuesto,
  copyFichadaOperativaPiso,
  esMatrizPresentacionCompuesta,
  filasPresentacionOperativaDesdeCelda,
  marcasHhmmPorTramoDesdeCelda,
  etiquetaFichadaPisoCelda,
  filaGrillaTieneTurnoCompuesto,
  lineasDesdePresentacionCompuesto,
  parseRangoHhmmLabel,
  titleFilaPresentacionCompuesto,
  titlePisoCompuestoCelda,
  textoMarcasPisoCelda,
} from "./grillaPresentacionCompuestoUi.js";
import {
  filasPresentacionCompuestoDesdeCelda,
  leerPresentacionCompuestoDesdeCelda,
} from "../../../../shared/utils/visCeldaFusionLectura.js";

const FILAS_QA_C5 = [
  {
    segmento_id: "M",
    orden: 0,
    teoria_label: "06:00–14:00",
    fichada_label: "06:00–14:00",
    estado_tramo: "presente",
    badge_label: null,
  },
  {
    segmento_id: "T",
    orden: 1,
    teoria_label: "14:00–22:00",
    fichada_label: "14:00–18:30",
    estado_tramo: "parcial",
    badge_label: "▼ 3h 30m",
  },
  {
    segmento_id: "N",
    orden: 2,
    teoria_label: "22:00–06:00",
    fichada_label: null,
    estado_tramo: "ausente",
    badge_label: "AUSENTE",
  },
];

describe("visCeldaFusionLectura presentacion_compuesto", () => {
  it("lee filas desde celda anidada", () => {
    const celda = { presentacion_compuesto: { version: 1, filas: FILAS_QA_C5 } };
    expect(filasPresentacionCompuestoDesdeCelda(celda)).toHaveLength(3);
    expect(leerPresentacionCompuestoDesdeCelda(celda)?.turno_compuesto_id).toBeNull();
  });

  it("retorna vacío sin sub-objeto", () => {
    expect(filasPresentacionCompuestoDesdeCelda({})).toEqual([]);
    expect(leerPresentacionCompuestoDesdeCelda(null)).toBeNull();
  });
});

describe("grillaPresentacionCompuestoUi", () => {
  it("matriz compuesta requiere al menos 2 filas", () => {
    expect(esMatrizPresentacionCompuesta(FILAS_QA_C5)).toBe(true);
    expect(esMatrizPresentacionCompuesta([FILAS_QA_C5[0]])).toBe(false);
    expect(esMatrizPresentacionCompuesta([])).toBe(false);
  });

  it("lineasDesdePresentacionCompuesto arma copy operativo sin teoría", () => {
    const lineas = lineasDesdePresentacionCompuesto(FILAS_QA_C5);
    expect(lineas).toEqual([
      "M",
      "T · 18:30 · ▼ 3h 30m",
      "N · AUSENTE",
    ]);
  });

  it("titleFilaPresentacionCompuesto resume tramo", () => {
    expect(titleFilaPresentacionCompuesto(FILAS_QA_C5[2])).toContain("AUSENTE");
    expect(titleFilaPresentacionCompuesto(FILAS_QA_C5[2])).toContain("Tramo N");
  });

  it("titlePisoCompuestoCelda solo fichada operativa en tooltip", () => {
    expect(titlePisoCompuestoCelda(FILAS_QA_C5[0], 3)).toBe("M");
    expect(titlePisoCompuestoCelda(FILAS_QA_C5[1], 3)).toContain("▼ 3h 30m");
  });

  it("claseVisualPisoCompuesto mapea presente / parcial / ausente", () => {
    expect(claseVisualPisoCompuesto(FILAS_QA_C5[0]).piso).toContain("emerald");
    expect(claseVisualPisoCompuesto(FILAS_QA_C5[1]).piso).toContain("amber");
    expect(claseVisualPisoCompuesto(FILAS_QA_C5[2]).piso).toContain("rose");
  });

  it("claseVisualPisoCompuesto no ambariza parcial sin badge disciplina (cobertura legacy)", () => {
    expect(
      claseVisualPisoCompuesto({
        segmento_id: "N",
        estado_tramo: "parcial",
        fichada_label: "22:00-05:35",
        badge_label: null,
      }).piso,
    ).toContain("emerald");
  });

  it("filasPresentacionOperativaDesdeCelda reconcilia estado_tramo desde analitica", () => {
    const celda = {
      presentacion_compuesto: {
        version: 1,
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "parcial", badge_label: "▼ 38m", badge_tipo: "tardanza" },
          { segmento_id: "T", orden: 1, estado_tramo: "presente", badge_label: null },
          { segmento_id: "N", orden: 2, estado_tramo: "parcial", badge_label: null, fichada_label: "22:00-05:35" },
        ],
      },
      analitica_cumplimiento: {
        calculo_por_segmentos: true,
        segmentos_cumplimiento: [
          {
            segmento_id: "M",
            cubierto: true,
            incumplimiento_celda_minutos: 38,
            incumplimiento_celda_tipo: "tardanza",
          },
          { segmento_id: "T", cubierto: true, incumplimiento_celda_minutos: 0, incumplimiento_celda_tipo: null },
          { segmento_id: "N", cubierto: true, incumplimiento_celda_minutos: 0, incumplimiento_celda_tipo: null },
        ],
      },
      fichadas_reales: [{ ingreso: "06:38", egreso: "05:35", fecha_ymd: "2026-06-13", fecha_egreso_ymd: "2026-06-14" }],
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    const n = filas.find((f) => f.segmento_id === "N");
    expect(n?.estado_tramo).toBe("presente");
    expect(claseVisualPisoCompuesto(n).piso).toContain("emerald");
  });

  it("filaGrillaTieneTurnoCompuesto detecta M+T+N en la fila", () => {
    expect(
      filaGrillaTieneTurnoCompuesto({
        dias: {
          "13": { presentacion_compuesto: { filas: FILAS_QA_C5 } },
        },
      }),
    ).toBe(true);
    expect(
      filaGrillaTieneTurnoCompuesto({
        dias: { "5": { rda_turno_id: "M" } },
      }),
    ).toBe(false);
    expect(
      filaGrillaTieneTurnoCompuesto({
        dias: { "5": { rda_turno_id: "M+T+N" } },
      }),
    ).toBe(true);
  });

  it("etiquetaFichadaPisoCelda muestra todas las marcas del tramo", () => {
    expect(
      etiquetaFichadaPisoCelda({
        marcas_hm: ["14:15", "21:35"],
        estado_tramo: "presente",
      }),
    ).toBe("14:15 · 21:35");
    expect(
      etiquetaFichadaPisoCelda({
        marcas_hm: ["21:45", "05:35"],
        estado_tramo: "parcial",
        orden: 1,
      }),
    ).toBe("21:45 · 5:35");
  });

  it("marcasHhmmPorTramoDesdeCelda reparte fichadas por M/T/N", () => {
    const celda = {
      fichadas_reales: [
        { ingreso: "05:54", egreso: "14:10", fecha_ymd: "2026-06-16" },
        { ingreso: "21:50", egreso: "05:55", fecha_ymd: "2026-06-16", fecha_egreso_ymd: "2026-06-17" },
      ],
    };
    const filas = [
      { segmento_id: "M", orden: 0, estado_tramo: "presente" },
      { segmento_id: "T", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE" },
      { segmento_id: "N", orden: 2, estado_tramo: "parcial" },
    ];
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[0], filas)).toEqual(["05:54", "14:10"]);
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[2], filas)).toEqual(["21:50", "05:55"]);
  });

  it("M+T una fichada: ingreso en M y egreso en T (sin duplicar salida)", () => {
    const celda = {
      fichadas_reales: [{ ingreso: "06:25", egreso: "20:05", fecha_ymd: "2026-06-10" }],
      presentacion_compuesto: {
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "parcial", fichada_label: "06:25-14:00" },
          {
            segmento_id: "T",
            orden: 1,
            estado_tramo: "parcial",
            fichada_label: "14:00-20:05",
            badge_label: "▼ 1h 55m",
            badge_tipo: "salida",
          },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    expect(filas.find((f) => f.segmento_id === "M")?.marcas_hm).toEqual(["06:25"]);
    expect(filas.find((f) => f.segmento_id === "T")?.marcas_hm).toEqual(["20:05"]);
    expect(textoMarcasPisoCelda(filas[0])).toBe("6:25");
    expect(textoMarcasPisoCelda(filas[1])).toBe("20:05");
  });

  it("M+T CAMPOS d8: tardanza y salida en M, T ausente", () => {
    const celda = {
      fichadas_reales: [{ ingreso: "08:15", egreso: "12:30", fecha_ymd: "2026-06-08" }],
      presentacion_compuesto: {
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "parcial", fichada_label: "08:15-12:30", badge_label: "▼ 1h 30m", badge_tipo: "salida" },
          { segmento_id: "T", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE", badge_tipo: "ausente_tramo" },
        ],
      },
      analitica_cumplimiento: {
        calculo_por_segmentos: true,
        disciplina: { tolerancia_ingreso_dia_min: 25, tolerancia_egreso_dia_min: 25 },
        segmentos_cumplimiento: [
          {
            segmento_id: "M",
            cubierto: true,
            tardanza_minutos: 135,
            salida_anticipada_minutos: 90,
            incumplimiento_celda_minutos: 90,
            incumplimiento_celda_tipo: "salida",
          },
          {
            segmento_id: "T",
            cubierto: false,
            carga_teorica_minutos: 480,
            incumplimiento_celda_minutos: 480,
            incumplimiento_celda_tipo: "ausente_tramo",
          },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    const m = filas.find((f) => f.segmento_id === "M");
    const t = filas.find((f) => f.segmento_id === "T");
    expect(m?.marcas_hm).toEqual(["08:15"]);
    expect(badgesDisciplinaDesdeFilaPresentacion(m).map((b) => b.label)).toEqual(["▼ 2h 15m", "▼ 1h 30m"]);
    expect(t?.estado_tramo).toBe("ausente");
    expect(copyFichadaOperativaPiso(t, 2)).toContain("AUSENTE");
  });

  it("T+N análogo CAMPOS d8: tardanza y salida en T, N ausente", () => {
    const celda = {
      fichadas_reales: [{ ingreso: "16:15", egreso: "20:30", fecha_ymd: "2026-06-08" }],
      presentacion_compuesto: {
        filas: [
          {
            segmento_id: "T",
            orden: 0,
            estado_tramo: "parcial",
            fichada_label: "16:15-20:30",
            badges: [
              { label: "▼ 2h 15m", tipo: "tardanza" },
              { label: "▼ 1h 30m", tipo: "salida" },
            ],
          },
          {
            segmento_id: "N",
            orden: 1,
            estado_tramo: "ausente",
            badge_label: "AUSENTE",
            badge_tipo: "ausente_tramo",
          },
        ],
      },
      analitica_cumplimiento: {
        calculo_por_segmentos: true,
        disciplina: { tolerancia_ingreso_dia_min: 25, tolerancia_egreso_dia_min: 25 },
        segmentos_cumplimiento: [
          {
            segmento_id: "T",
            cubierto: true,
            tardanza_minutos: 135,
            salida_anticipada_minutos: 90,
            incumplimiento_celda_tardanza_minutos: 135,
            incumplimiento_celda_salida_minutos: 90,
          },
          {
            segmento_id: "N",
            cubierto: false,
            incumplimiento_celda_tipo: "ausente_tramo",
          },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    const t = filas.find((f) => f.segmento_id === "T");
    const n = filas.find((f) => f.segmento_id === "N");
    expect(t?.marcas_hm).toEqual(["16:15"]);
    expect(badgesDisciplinaDesdeFilaPresentacion(t).map((b) => b.label)).toEqual([
      "▼ 2h 15m",
      "▼ 1h 30m",
    ]);
    expect(n?.estado_tramo).toBe("ausente");
    expect(copyFichadaOperativaPiso(n, 2)).toContain("AUSENTE");
  });

  it("M+T CAMPOS d5: no muestra egreso en fila M", () => {
    const celda = {
      fichadas_reales: [{ ingreso: "08:00", egreso: "18:00", fecha_ymd: "2026-06-05" }],
      presentacion_compuesto: {
        filas: [
          {
            segmento_id: "M",
            orden: 0,
            estado_tramo: "parcial",
            fichada_label: "08-14",
            badge_label: "▼ 2h",
            badge_tipo: "tardanza",
          },
          {
            segmento_id: "T",
            orden: 1,
            estado_tramo: "parcial",
            fichada_label: "14-18",
            badge_label: "▼ 4h",
            badge_tipo: "salida",
          },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    expect(textoMarcasPisoCelda(filas[0])).toBe("8:00");
    expect(textoMarcasPisoCelda(filas[1])).toBe("18:00");
  });

  it("piso ausente sin guión ni fichada vacía", () => {
    const fila = {
      segmento_id: "T",
      orden: 1,
      estado_tramo: "ausente",
      badge_label: "AUSENTE",
      badge_tipo: "ausente_tramo",
    };
    expect(textoMarcasPisoCelda(fila)).toBe("AUSENTE");
    expect(copyFichadaOperativaPiso(fila, 3)).toBe("T · AUSENTE");
    expect(lineasDesdePresentacionCompuesto([fila])).toEqual(["T · AUSENTE"]);
  });

  it("etiquetaFichadaPisoCelda fallback sin marcas_hm", () => {
    expect(parseRangoHhmmLabel("06:38–14:00")).toEqual({
      ingreso: "06:38",
      egreso: "14:00",
      esHorasEnteras: false,
    });
    expect(parseRangoHhmmLabel("06-14")).toEqual({
      ingreso: "06:00",
      egreso: "14:00",
      esHorasEnteras: true,
    });
    expect(
      etiquetaFichadaPisoCelda(
        {
          orden: 0,
          estado_tramo: "parcial",
          fichada_label: "06:38–14:00",
          badge_label: "▼ 38m",
          badge_tipo: "tardanza",
        },
        3,
      ),
    ).toBe("6:38");
    expect(
      etiquetaFichadaPisoCelda(
        { orden: 0, estado_tramo: "presente", fichada_label: "06-14" },
        3,
      ),
    ).toBe("");
    expect(
      etiquetaFichadaPisoCelda(
        { orden: 1, estado_tramo: "presente", fichada_label: "14:00–22:00" },
        3,
      ),
    ).toBe("");
    expect(
      etiquetaFichadaPisoCelda(
        {
          orden: 2,
          estado_tramo: "parcial",
          fichada_label: "22:00–05:40",
          badge_label: "▼ 20m",
          badge_tipo: "salida",
        },
        3,
      ),
    ).toBe("5:40");
    expect(
      etiquetaFichadaPisoCelda(
        {
          orden: 2,
          estado_tramo: "parcial",
          fichada_label: "22-04",
          badge_label: "▼ 2h",
          badge_tipo: "salida",
        },
        3,
      ),
    ).toBe("4:00");
    expect(
      etiquetaFichadaPisoCelda(
        { orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE", badge_tipo: "ausente_tramo" },
        3,
      ),
    ).toBe("");
  });
});
