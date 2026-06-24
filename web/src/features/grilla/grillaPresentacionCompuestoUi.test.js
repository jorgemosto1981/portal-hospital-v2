import { describe, expect, it } from "vitest";

import {
  badgesDisciplinaDesdeFilaPresentacion,
  claseVisualPisoCompuesto,
  copyFichadaOperativaPiso,
  esMatrizPresentacionCompuesta,
  filasPresentacionOperativaDesdeCelda,
  filasPresentacionGrillaDesdeCelda,
  marcasHhmmPorTramoDesdeCelda,
  etiquetaFichadaPisoCelda,
  filaGrillaTieneTurnoCompuesto,
  alturasFilaGrillaEquipoTabla,
  grillaEquipoTablaUsaAlturaFilaPlanificada,
  filaGrillaTienePresentacionPorPisos,
  filaPresentacionSimpleDesdeCelda,
  lineasDesdePresentacionCompuesto,
  segmentoTurnoSimpleDesdeCelda,
  parseRangoHhmmLabel,
  titleFilaPresentacionCompuesto,
  titlePisoCompuestoCelda,
  textoMarcasPisoCelda,
} from "./grillaPresentacionCompuestoUi.js";
import {
  filasPresentacionCompuestoDesdeCelda,
  leerPresentacionCompuestoDesdeCelda,
  celdaVisIndicaFrancoOperativo,
} from "../../../../shared/utils/visCeldaFusionLectura.js";
import { mergeCeldaVisParche } from "../../../../shared/utils/grillaMesNodos/mergeCeldaVisParche.js";

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

describe("segmentoTurnoSimpleDesdeCelda", () => {
  it("extrae el ID desde analítica con un solo segmento (régimen 12h MA)", () => {
    const celda = {
      analitica_cumplimiento: {
        segmentos_cumplimiento: [{ segmento_id: "MA", cubierto: true }],
      },
      rda_turno_id: "MA",
    };
    expect(segmentoTurnoSimpleDesdeCelda(celda)).toBe("MA");
  });

  it("usa rda_turno_id si no hay analítica (régimen 12h TN)", () => {
    expect(segmentoTurnoSimpleDesdeCelda({ rda_turno_id: "TN" })).toBe("TN");
  });

  it("retorna vacío si rda_turno_id es compuesto (MA+TN)", () => {
    expect(segmentoTurnoSimpleDesdeCelda({ rda_turno_id: "MA+TN" })).toBe("");
  });

  it("mantiene compatibilidad legacy M/T/N y sufijo cfg_reg_turno_*", () => {
    expect(segmentoTurnoSimpleDesdeCelda({ rda_turno_id: "T" })).toBe("T");
    expect(segmentoTurnoSimpleDesdeCelda({ rda_turno_id: "N" })).toBe("N");
    expect(segmentoTurnoSimpleDesdeCelda({ rda_turno_id: "cfg_reg_turno_m" })).toBe("M");
  });

  it("filaPresentacionSimpleDesdeCelda arma chip para turno simple MA", () => {
    const fila = filaPresentacionSimpleDesdeCelda({
      rda_turno_id: "MA",
      fichadas_reales: [{ ingreso: "08:00", egreso: "20:00", fecha_ymd: "2026-06-18" }],
      analitica_cumplimiento: {
        segmentos_cumplimiento: [{ segmento_id: "MA", cubierto: true, incumplimiento_celda_minutos: 0 }],
        calculo_por_segmentos: true,
      },
    });
    expect(fila?.segmento_id).toBe("MA");
    expect(fila?.fichada_label).toContain("08:00");
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

  it("claseVisualPisoCompuesto ambariza parcial aunque falte badge (disciplina horaria)", () => {
    expect(
      claseVisualPisoCompuesto({
        segmento_id: "M",
        estado_tramo: "parcial",
        fichada_label: "07:00-13:01",
        badge_label: null,
      }).piso,
    ).toContain("amber");
  });

  it("claseVisualPisoCompuesto retorna slate neutro si el estado es desconocido o nulo", () => {
    expect(claseVisualPisoCompuesto({ estado_tramo: "estado_magico_futuro" }).piso).toContain("slate");
    expect(claseVisualPisoCompuesto({ estado_tramo: null }).piso).toContain("slate");
  });

  it("reparte 2 fichadas en 3 filas (apertura y cierre) sin depender de IDs M/T/N", () => {
    const celdaAgnostica = {
      fichadas_reales: [
        { ingreso: "06:10", egreso: null, fecha_ymd: "2026-06-20" },
        { ingreso: null, egreso: "05:50", fecha_ymd: "2026-06-21" },
      ],
    };
    const filasGenericas = [
      { segmento_id: "MAÑANA", orden: 0 },
      { segmento_id: "TARDE", orden: 1 },
      { segmento_id: "NOCHE_A", orden: 2 },
    ];
    expect(marcasHhmmPorTramoDesdeCelda(celdaAgnostica, filasGenericas[0], filasGenericas)).toEqual([
      "06:10",
    ]);
    expect(marcasHhmmPorTramoDesdeCelda(celdaAgnostica, filasGenericas[2], filasGenericas)).toEqual([
      "05:50",
    ]);
    expect(marcasHhmmPorTramoDesdeCelda(celdaAgnostica, filasGenericas[1], filasGenericas)).toEqual([]);
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

  it("altura fila grilla equipo: estándar fijo h-[5.75rem] en toda la tabla", () => {
    const filaPlanificada = {
      dias: {
        "3": {
          presentacion_compuesto: {
            filas: [{ segmento_id: "M", estado_tramo: "presente", badge_label: "M" }],
          },
        },
      },
    };
    const filaFijo = { dias: { "3": { rda_turno_id: "NL", es_franco: false } } };
    expect(filaGrillaTienePresentacionPorPisos(filaPlanificada)).toBe(true);
    expect(filaGrillaTienePresentacionPorPisos(filaFijo)).toBe(false);
    expect(grillaEquipoTablaUsaAlturaFilaPlanificada([filaFijo])).toBe(true);
    const alturas = alturasFilaGrillaEquipoTabla([filaFijo, filaPlanificada]);
    expect(alturas.uniformarChipPlanificado).toBe(true);
    expect(alturas.alturaFila).toBe("h-[5.75rem]");
    expect(alturas.alturaChip).toBe("h-[5.5rem]");
    expect(alturasFilaGrillaEquipoTabla([])).toEqual(alturas);
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

  it("M+T+N tres fichadas: una por tramo aunque T siga ausente en presentación", () => {
    const celda = {
      fichadas_reales: [
        { ingreso: "05:45", egreso: "13:55", fecha_ymd: "2026-06-16" },
        { ingreso: "15:00", egreso: "17:00", fecha_ymd: "2026-06-16" },
        { ingreso: "21:40", egreso: "04:10", fecha_ymd: "2026-06-16", fecha_egreso_ymd: "2026-06-17" },
      ],
    };
    const filas = [
      { segmento_id: "M", orden: 0, estado_tramo: "presente" },
      { segmento_id: "T", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE" },
      { segmento_id: "N", orden: 2, estado_tramo: "parcial" },
    ];
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[0], filas)).toEqual(["05:45", "13:55"]);
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[1], filas)).toEqual(["15:00", "17:00"]);
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[2], filas)).toEqual(["21:40", "04:10"]);
  });

  it("M+T+N tres fichadas: orden crudo del reloj distinto a M,T,N (LOKITO d16)", () => {
    const celda = {
      fichadas_reales: [
        { ingreso: "05:45", egreso: "13:55", fecha_ymd: "2026-06-16" },
        { ingreso: "21:40", egreso: "04:10", fecha_ymd: "2026-06-16", fecha_egreso_ymd: "2026-06-17" },
        { ingreso: "15:00", egreso: "17:00", fecha_ymd: "2026-06-16" },
      ],
    };
    const filas = [
      { segmento_id: "M", orden: 0, estado_tramo: "presente" },
      { segmento_id: "T", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE" },
      { segmento_id: "N", orden: 2, estado_tramo: "parcial" },
    ];
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[0], filas)).toEqual(["05:45", "13:55"]);
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[1], filas)).toEqual(["15:00", "17:00"]);
    expect(marcasHhmmPorTramoDesdeCelda(celda, filas[2], filas)).toEqual(["21:40", "04:10"]);
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
    expect(filas.find((f) => f.segmento_id === "M")?.marcas_hm).toEqual(["6:25"]);
    expect(filas.find((f) => f.segmento_id === "T")?.marcas_hm).toEqual(["20:05"]);
    expect(textoMarcasPisoCelda(filas[0])).toBe("6:25");
    expect(textoMarcasPisoCelda(filas[1])).toBe("20:05");
  });

  it("M+N una fichada nocturna: M ausente y N con ingreso+egreso (LOKITO d15)", () => {
    const celda = {
      fichadas_reales: [
        {
          ingreso: "21:45",
          egreso: "05:35",
          fecha_ymd: "2026-06-15",
          fecha_egreso_ymd: "2026-06-16",
        },
      ],
      presentacion_compuesto: {
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "ausente", badge_label: "AUSENTE", badge_tipo: "ausente_tramo" },
          { segmento_id: "N", orden: 1, estado_tramo: "presente", fichada_label: "21:45-05:35" },
        ],
      },
      analitica_cumplimiento: {
        calculo_por_segmentos: true,
        segmentos_cumplimiento: [
          { segmento_id: "M", cubierto: false, incumplimiento_celda_tipo: "ausente_tramo" },
          { segmento_id: "N", cubierto: true, incumplimiento_celda_minutos: 0 },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    const m = filas.find((f) => f.segmento_id === "M");
    const n = filas.find((f) => f.segmento_id === "N");
    expect(m?.marcas_hm).toEqual([]);
    expect(n?.marcas_hm).toEqual(["21:45", "5:35"]);
    expect(textoMarcasPisoCelda(n)).toBe("21:45 · 5:35");
  });

  it("M+T+N una fichada nocturna: ingreso en M y egreso D+1 solo en N (CHAPARRO d13)", () => {
    const celda = {
      fichadas_reales: [
        {
          ingreso: "06:38",
          egreso: "05:35",
          fecha_ymd: "2026-06-13",
          fecha_egreso_ymd: "2026-06-14",
        },
      ],
      presentacion_compuesto: {
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "parcial", fichada_label: "06:38-05:35" },
          { segmento_id: "T", orden: 1, estado_tramo: "presente", fichada_label: null },
          { segmento_id: "N", orden: 2, estado_tramo: "parcial", fichada_label: "22:00-05:35" },
        ],
      },
      analitica_cumplimiento: {
        calculo_por_segmentos: true,
        segmentos_cumplimiento: [
          { segmento_id: "M", cubierto: true, incumplimiento_celda_minutos: 38, incumplimiento_celda_tipo: "tardanza" },
          { segmento_id: "T", cubierto: true, incumplimiento_celda_minutos: 0 },
          { segmento_id: "N", cubierto: true, incumplimiento_celda_minutos: 0 },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    const m = filas.find((f) => f.segmento_id === "M");
    const t = filas.find((f) => f.segmento_id === "T");
    const n = filas.find((f) => f.segmento_id === "N");
    expect(m?.marcas_hm).toEqual(["6:38"]);
    expect(t?.marcas_hm).toEqual([]);
    expect(n?.marcas_hm).toEqual(["5:35"]);
    expect(textoMarcasPisoCelda(m)).toBe("6:38");
    expect(textoMarcasPisoCelda(n)).toBe("5:35");
  });

  it("filasPresentacionGrillaDesdeCelda oculta tramos obsoletos tras traslado (origen solo N)", () => {
    const celda = {
      rda_turno_id: "N",
      presentacion_compuesto: {
        turno_compuesto_id: "T+N",
        filas: [
          { segmento_id: "T", orden: 0, estado_tramo: "ausente", badge_label: "AUSENTE" },
          { segmento_id: "N", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE" },
        ],
      },
    };
    const filas = filasPresentacionGrillaDesdeCelda(celda);
    expect(filas.map((f) => f.segmento_id)).toEqual(["N"]);
  });

  it("filasPresentacionGrillaDesdeCelda enriquece marcas sin reconciliar analítica (CHAPARRO d13)", () => {
    const celda = {
      fichadas_reales: [
        {
          ingreso: "06:38",
          egreso: "05:35",
          fecha_ymd: "2026-06-13",
          fecha_egreso_ymd: "2026-06-14",
        },
      ],
      presentacion_compuesto: {
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "parcial", fichada_label: "06:38-05:35", badge_label: "▼ 38m" },
          { segmento_id: "T", orden: 1, estado_tramo: "presente", fichada_label: null },
          { segmento_id: "N", orden: 2, estado_tramo: "presente", fichada_label: "22:00-05:35" },
        ],
      },
    };
    const filas = filasPresentacionGrillaDesdeCelda(celda);
    const m = filas.find((f) => f.segmento_id === "M");
    const n = filas.find((f) => f.segmento_id === "N");
    expect(m?.marcas_hm).toEqual(["6:38"]);
    expect(n?.marcas_hm).toEqual(["5:35"]);
    expect(textoMarcasPisoCelda(n)).toBe("5:35");
    expect(n?.estado_tramo).toBe("presente");
  });

  it("M+N un tramo diurno: ingreso y egreso en M si N está ausente (grilla hot path)", () => {
    const celda = {
      fichadas_reales: [{ ingreso: "05:45", egreso: "13:55", fecha_ymd: "2026-06-16" }],
      presentacion_compuesto: {
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "presente", fichada_label: null },
          { segmento_id: "N", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE", badge_tipo: "ausente_tramo" },
        ],
      },
    };
    const filas = filasPresentacionGrillaDesdeCelda(celda);
    const m = filas.find((f) => f.segmento_id === "M");
    const n = filas.find((f) => f.segmento_id === "N");
    expect(m?.marcas_hm).toEqual(["5:45", "13:55"]);
    expect(textoMarcasPisoCelda(m)).toBe("5:45 · 13:55");
    expect(n?.marcas_hm).toEqual([]);
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
    expect(m?.marcas_hm).toEqual(["8:15", "12:30"]);
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
    expect(t?.marcas_hm).toEqual(["16:15", "20:30"]);
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

  it("tras traslado origen (solo M teórico) oculta fila T obsoleta en presentación", () => {
    const celda = {
      rda_turno_id: "M",
      rda_ingreso: "06:00",
      rda_egreso: "14:00",
      validacion_fichada_dia: { estado_semaforo: "ROJO" },
      presentacion_compuesto: {
        turno_compuesto_id: "M+T",
        filas: [
          { segmento_id: "M", orden: 0, estado_tramo: "ausente", badge_label: "AUSENTE" },
          { segmento_id: "T", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE" },
        ],
      },
    };
    const filas = filasPresentacionOperativaDesdeCelda(celda);
    expect(filas.map((f) => f.segmento_id)).toEqual(["M"]);
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

  it("T+N con fichada diurna fuera de tramos: piso extra violeta en grilla (CHAPARRO d23)", () => {
    const celda = {
      rda_turno_id: "T+N",
      fichadas_reales: [{ ingreso: "08:00", egreso: "14:02", fecha_ymd: "2026-06-23" }],
      presentacion_compuesto: {
        turno_compuesto_id: "T+N",
        filas: [
          { segmento_id: "T", orden: 0, estado_tramo: "ausente", badge_label: "AUSENTE", badge_tipo: "ausente_tramo" },
          { segmento_id: "N", orden: 1, estado_tramo: "ausente", badge_label: "AUSENTE", badge_tipo: "ausente_tramo" },
        ],
      },
      analitica_cumplimiento: {
        fichada_fuera_turno_teorico: true,
        calculo_por_segmentos: true,
        segmentos_cumplimiento: [
          { segmento_id: "T", cubierto: false, incumplimiento_celda_tipo: "ausente_tramo" },
          { segmento_id: "N", cubierto: false, incumplimiento_celda_tipo: "ausente_tramo" },
        ],
      },
    };
    const filas = filasPresentacionGrillaDesdeCelda(celda);
    expect(filas.map((f) => f.segmento_id)).toEqual(["T", "N", "·"]);
    const extra = filas[2];
    expect(extra?.marcas_hm).toEqual(["8:00", "14:02"]);
    expect(textoMarcasPisoCelda(extra)).toBe("8:00 · 14:02");
    expect(claseVisualPisoCompuesto(extra).piso).toContain("violet");
    expect(copyFichadaOperativaPiso(extra, 3)).toContain("8:00");
  });
});

describe("franco operativo vs flags obsoletos (incorporar N en día plan franco)", () => {
  it("celdaVisIndicaFrancoOperativo: N materializado no es franco", () => {
    const celda = {
      es_franco: true,
      tipo_dia: "franco",
      rda_turno_id: "N",
      capa_teorica: { tipo_dia: "laborable", segmentos: [{ segmento_id: "N" }] },
    };
    expect(celdaVisIndicaFrancoOperativo(celda)).toBe(false);
  });

  it("mergeCeldaVisParche no borra N si es_franco obsoleto en parche", () => {
    const parche = {
      es_franco: true,
      tipo_dia: "franco",
      rda_turno_id: "N",
      capa_teorica: { tipo_dia: "laborable", segmentos: [{ segmento_id: "N" }] },
      presentacion_compuesto: { filas: [{ segmento_id: "N", orden: 0 }] },
    };
    const merged = mergeCeldaVisParche(null, parche);
    expect(merged.rda_turno_id).toBe("N");
    expect(merged.presentacion_compuesto?.filas?.length).toBe(1);
    expect(merged.tipo_dia).not.toBe("franco");
  });
});
