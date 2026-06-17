import { describe, it, expect } from "vitest";

import {
  analiticaCumplimientoDesdeCelda,
  analiticaTieneContenidoVisible,
  badgeIncumplimientoHorarioRrhh,
  listaBadgesIncumplimientoPorSegmentoCelda,
  disciplinaListaBadgesPorTramoCelda,
  listaBadgesAusentePorTramoHuecosCelda,
  lineasDisciplinaTeoriaVsRealRrhh,
  lineasMargenToleranciaRegimenDesdeAnalitica,
  microBadgesAnalitica,
  microBadgesAnaliticaRrhh,
  tarjetasAuditoriaCumplimientoJefe,
} from "./grillaAnaliticaCumplimientoUi.js";

describe("grillaAnaliticaCumplimientoUi", () => {
  it("tolera celda sin analitica (meses viejos)", () => {
    expect(analiticaCumplimientoDesdeCelda(null)).toBeNull();
    expect(analiticaCumplimientoDesdeCelda({ rda_ingreso: "08:00" })).toBeNull();
    expect(analiticaTieneContenidoVisible(null)).toBe(false);
    expect(microBadgesAnalitica(null).disciplina).toBeNull();
  });

  it("micro-badge disciplina tardanza", () => {
    const a = {
      disciplina: { fuera_de_margen: true, tardanza_minutos: 45 },
      debito_tiempo: { incumplimiento_carga_horaria: false, tolerancia_debitohorario_minutos: 30 },
    };
    expect(microBadgesAnalitica(a).disciplina).toBe("▼ 45m");
  });

  it("micro-badge débito contractual", () => {
    const a = {
      disciplina: { fuera_de_margen: false },
      debito_tiempo: { incumplimiento_carga_horaria: true, deficit_minutos: 45 },
    };
    expect(microBadgesAnalitica(a).debito).toBe("-45m");
  });

  it("tarjeta jefe traduce déficit con tolerancia", () => {
    const t = tarjetasAuditoriaCumplimientoJefe({
      disciplina: { fuera_de_margen: false },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        carga_teorica_minutos: 480,
        carga_real_minutos: 435,
        deficit_minutos: 45,
        tolerancia_debitohorario_minutos: 30,
      },
    });
    expect(t.debito).toMatch(/Déficit neto: 45m/);
    expect(t.debito).toMatch(/30 min/);
  });

  it("márgenes régimen desde analítica persistida", () => {
    const lines = lineasMargenToleranciaRegimenDesdeAnalitica({
      disciplina: {
        ingreso_nominal_iso: "2026-06-13T09:00:00.000Z",
        ingreso_limite_con_gracia_iso: "2026-06-13T09:15:00.000Z",
        egreso_nominal_iso: "2026-06-13T17:00:00.000Z",
        egreso_limite_con_gracia_iso: "2026-06-13T16:45:00.000Z",
      },
      debito_tiempo: { tolerancia_debitohorario_minutos: 30 },
    });
    expect(lines.some((l) => l.includes("15 min"))).toBe(true);
    expect(lines.some((l) => l.includes("débito"))).toBe(true);
  });

  it("disciplina RRHH: ingreso anticipado y salida anticipada desde nominal", () => {
    const lineas = lineasDisciplinaTeoriaVsRealRrhh({
      disciplina: {
        fuera_de_margen: true,
        ingreso_anticipado_minutos: 60,
        salida_anticipada_minutos: 60,
        tardanza_minutos: 0,
      },
      debito_tiempo: { incumplimiento_carga_horaria: false, tolerancia_debitohorario_minutos: 30 },
    });
    expect(lineas.some((l) => l.includes("Salida anticipada: 60 min"))).toBe(true);
    expect(lineas.some((l) => l.includes("Ingreso anticipado"))).toBe(false);
  });

  it("celda RRHH: prioriza salida anticipada sobre ingreso anticipado", () => {
    const b = microBadgesAnaliticaRrhh({
      disciplina: {
        fuera_de_margen: true,
        ingreso_anticipado_minutos: 60,
        salida_anticipada_minutos: 60,
      },
      debito_tiempo: { incumplimiento_carga_horaria: false, tolerancia_debitohorario_minutos: 30 },
    });
    expect(b.disciplina).toBe("▼ 1h");
    expect(
      badgeIncumplimientoHorarioRrhh(
        { salida_anticipada_minutos: 45 },
        { tolerancia_debitohorario_minutos: 30 },
      ).label,
    ).toBe("▼ 45m");
  });

  it("celda RRHH: tardanza punitiva usa triángulo invertido", () => {
    const b = microBadgesAnaliticaRrhh(
      {
        disciplina: { tardanza_minutos: 38, fuera_de_margen: true },
        debito_tiempo: { tolerancia_debitohorario_minutos: 30 },
      },
      null,
    );
    expect(b.disciplina).toBe("▼ 38m");
  });

  it("M+N: dos badges ▼ por tramo sin déficit agregado en celda", () => {
    const analitica = {
      calculo_por_segmentos: true,
      segmentos_cumplimiento: [
        {
          segmento_id: "M",
          cubierto: true,
          carga_teorica_minutos: 480,
          tardanza_minutos: 60,
          salida_anticipada_minutos: 0,
        },
        {
          segmento_id: "N",
          cubierto: false,
          carga_teorica_minutos: 480,
          tardanza_minutos: 0,
          salida_anticipada_minutos: 0,
        },
      ],
      disciplina: { tardanza_minutos: 60, fuera_de_margen: true },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 540,
        tolerancia_debitohorario_minutos: 30,
      },
    };
    const lista = listaBadgesIncumplimientoPorSegmentoCelda(analitica);
    expect(lista?.map((x) => x.label)).toEqual(["▼ 1h", "AUSENTE"]);
    const b = microBadgesAnaliticaRrhh(analitica, null);
    expect(b.debito).toBeNull();
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["▼ 1h", "AUSENTE"]);
  });

  it("M+N solo noche: AUSENTE en M; N con salida 25m sin badge (dentro cortesía)", () => {
    const analitica = {
      segmentos_cumplimiento: [
        {
          segmento_id: "M",
          cubierto: false,
          carga_teorica_minutos: 480,
          tardanza_minutos: 0,
          salida_anticipada_minutos: 0,
        },
        {
          segmento_id: "N",
          cubierto: true,
          carga_teorica_minutos: 480,
          tardanza_minutos: 0,
          salida_anticipada_minutos: 25,
          ingreso_anticipado_minutos: 15,
        },
      ],
      disciplina: { fuera_de_margen: false },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 490,
        tolerancia_debitohorario_minutos: 30,
      },
    };
    expect(listaBadgesIncumplimientoPorSegmentoCelda(analitica)?.map((x) => x.label)).toEqual([
      "AUSENTE",
    ]);
    const b = microBadgesAnaliticaRrhh(analitica, null);
    expect(b.debito).toBeNull();
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["AUSENTE"]);
  });

  it("sin marcas en celda laborable: chip AUSENTE sin déficit agregado", () => {
    const analitica = {
      disciplina: { fuera_de_margen: false },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 960,
        tolerancia_debitohorario_minutos: 30,
      },
    };
    const celda = { tipo_dia: "laborable", fichadas_esperadas: 2, fichadas_reales: [] };
    const b = microBadgesAnaliticaRrhh(analitica, celda);
    expect(b.debito).toBeNull();
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["AUSENTE"]);
  });

  it("sin marcas (modo jefe): chip AUSENTE sin -480m", () => {
    const analitica = {
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 480,
        tolerancia_debitohorario_minutos: 30,
      },
    };
    const celda = { tipo_dia: "laborable", fichadas_esperadas: 2, fichadas_reales: [] };
    const b = microBadgesAnalitica(analitica, { celdaVis: celda });
    expect(b.debito).toBeNull();
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["AUSENTE"]);
  });

  it("M+N ausente en ambos tramos (analítica): dos AUSENTE", () => {
    const analitica = {
      calculo_por_segmentos: true,
      segmentos_cumplimiento: [
        {
          segmento_id: "M",
          cubierto: false,
          carga_teorica_minutos: 480,
          tardanza_minutos: 0,
          salida_anticipada_minutos: 0,
        },
        {
          segmento_id: "N",
          cubierto: false,
          carga_teorica_minutos: 480,
          tardanza_minutos: 0,
          salida_anticipada_minutos: 0,
        },
      ],
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 960,
        tolerancia_debitohorario_minutos: 30,
      },
    };
    const celda = { tipo_dia: "laborable", fichadas_esperadas: 4, fichadas_reales: [] };
    expect(disciplinaListaBadgesPorTramoCelda(analitica, celda)?.map((x) => x.label)).toEqual([
      "AUSENTE",
      "AUSENTE",
    ]);
    const b = microBadgesAnaliticaRrhh(analitica, celda);
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["AUSENTE", "AUSENTE"]);
    expect(b.debito).toBeNull();
  });

  it("M+N sin analítica por tramo: dos AUSENTE desde rda_horario_display", () => {
    const celda = {
      tipo_dia: "laborable",
      fichadas_esperadas: 4,
      fichadas_reales: [],
      rda_tiene_huecos: true,
      rda_horario_display: "06:00–14:00 · 22:00–06:00",
      rda_turno_id: "M+N",
    };
    expect(listaBadgesAusentePorTramoHuecosCelda(celda)?.map((x) => x.label)).toEqual([
      "AUSENTE",
      "AUSENTE",
    ]);
    const b = microBadgesAnalitica(null, { celdaVis: celda });
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["AUSENTE", "AUSENTE"]);
  });

  it("M+T+N: no muestra déficit agregado en copy RRHH (evaluación por tramo)", () => {
    const lineas = lineasDisciplinaTeoriaVsRealRrhh({
      calculo_por_segmentos: true,
      segmentos_cumplimiento: [
        { segmento_id: "M", cubierto: true, carga_teorica_minutos: 480 },
        { segmento_id: "T", cubierto: true, carga_teorica_minutos: 480 },
        { segmento_id: "N", cubierto: true, carga_teorica_minutos: 480 },
      ],
      disciplina: { tardanza_minutos: 38, fuera_de_margen: true },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 55,
        tolerancia_debitohorario_minutos: 30,
      },
    });
    expect(lineas.some((l) => l.includes("Carga horaria: déficit"))).toBe(false);
    expect(lineas.some((l) => l.includes("Ingreso tardío: 38 min"))).toBe(true);
  });

  it("déficit jornada simple: tolerancia solo si está materializada en analítica", () => {
    const conTol = lineasDisciplinaTeoriaVsRealRrhh({
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 55,
        tolerancia_debitohorario_minutos: 45,
      },
    });
    expect(conTol.some((l) => l.includes("45 min"))).toBe(true);

    const sinTol = lineasDisciplinaTeoriaVsRealRrhh({
      debito_tiempo: { incumplimiento_carga_horaria: true, deficit_minutos: 55 },
    });
    expect(sinTol.some((l) => l.includes("Carga horaria: déficit"))).toBe(true);
    expect(sinTol.some((l) => l.includes("tolerancia"))).toBe(false);
  });

  it("disciplina RRHH: desvíos dentro de tolerancia de débito no son incumplimiento", () => {
    const lineas = lineasDisciplinaTeoriaVsRealRrhh({
      disciplina: {
        fuera_de_margen: false,
        tardanza_minutos: 5,
        salida_anticipada_minutos: 15,
      },
      debito_tiempo: {
        incumplimiento_carga_horaria: false,
        deficit_minutos: 20,
        tolerancia_debitohorario_minutos: 30,
      },
    });
    expect(lineas.some((l) => l.includes("Ingreso tardío"))).toBe(false);
    expect(lineas.some((l) => l.includes("Salida anticipada"))).toBe(false);
    expect(lineas.some((l) => l.includes("Sin incumplimiento"))).toBe(true);
  });

  it("disciplina RRHH: solo salida anticipada (oculta duplicación con déficit)", () => {
    const lineas = lineasDisciplinaTeoriaVsRealRrhh({
      disciplina: {
        fuera_de_margen: true,
        ingreso_anticipado_minutos: 0,
        salida_anticipada_minutos: 59,
        tardanza_minutos: 0,
      },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 59,
        tolerancia_debitohorario_minutos: 30,
      },
    });

    expect(lineas.some((l) => l.includes("Salida anticipada: 59 min"))).toBe(true);
    expect(lineas.some((l) => l.includes("Carga horaria: déficit"))).toBe(false);
  });

  it("celda RRHH: salida punitiva sin badge duplicado de déficit", () => {
    const b = microBadgesAnaliticaRrhh({
      disciplina: { salida_anticipada_minutos: 59, fuera_de_margen: true },
      debito_tiempo: {
        incumplimiento_carga_horaria: true,
        deficit_minutos: 59,
        tolerancia_debitohorario_minutos: 30,
      },
    });
    expect(b.disciplina).toBe("▼ 59m");
    expect(b.debito).toBeNull();
  });

  it("celda RRHH: horas extra autorizadas en verde", () => {
    const b = microBadgesAnaliticaRrhh(
      { disciplina: { fuera_de_margen: false }, debito_tiempo: {} },
      { horas_extra_autorizadas_min: 45 },
    );
    expect(b.extras).toBe("+45m");
  });

  it("disciplina RRHH: ausente sin analítica", () => {
    const lineas = lineasDisciplinaTeoriaVsRealRrhh(null, { presencia: "ausente" });
    expect(lineas[0]).toMatch(/Ausente/);
  });

  it("ignora flag fuera de turno obsoleto si validación ya es déficit", () => {
    const celda = {
      rda_ingreso: "14:00",
      rda_egreso: "22:00",
      validacion_fichada_dia: {
        alertas_semanticas: [{ codigo: "DEFICIT_HORARIO_GRAVE" }],
      },
      analitica_cumplimiento: {
        fichada_fuera_turno_teorico: true,
        debito_tiempo: { incumplimiento_carga_horaria: true, deficit_minutos: 40 },
        disciplina: {
          ingreso_nominal_iso: "2026-06-13T22:00:00-03:00",
          ingreso_limite_con_gracia_iso: "2026-06-13T22:15:00-03:00",
        },
      },
    };
    const anal = analiticaCumplimientoDesdeCelda(celda);
    expect(anal?.fichada_fuera_turno_teorico).toBeUndefined();
    const lineas = lineasDisciplinaTeoriaVsRealRrhh(anal, { presencia: "presente", celdaVis: celda });
    expect(lineas.some((l) => l.includes("ventana del turno teórico"))).toBe(false);
    expect(lineasMargenToleranciaRegimenDesdeAnalitica(anal).length).toBe(0);
  });
});
