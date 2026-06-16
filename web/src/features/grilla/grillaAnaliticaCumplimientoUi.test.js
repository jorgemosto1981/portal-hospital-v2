import { describe, it, expect } from "vitest";

import {
  analiticaCumplimientoDesdeCelda,
  analiticaTieneContenidoVisible,
  badgeIncumplimientoHorarioRrhh,
  listaBadgesIncumplimientoPorSegmentoCelda,
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
    expect(b.disciplina).toBe("▼ 60m");
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
          incumplimiento_celda_minutos: 60,
          incumplimiento_celda_tipo: "tardanza",
        },
        {
          segmento_id: "N",
          cubierto: false,
          incumplimiento_celda_minutos: 480,
          incumplimiento_celda_tipo: "ausente_tramo",
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
    expect(lista?.map((x) => x.label)).toEqual(["▼ 60m", "▼ 480m"]);
    const b = microBadgesAnaliticaRrhh(analitica, null);
    expect(b.debito).toBeNull();
    expect(b.disciplinaLista?.map((x) => x.label)).toEqual(["▼ 60m", "▼ 480m"]);
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
});
