/**
 * node --test functions/test/calcularDeltasCumplimiento.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { calcularDeltasCumplimiento } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/calcularDeltasCumplimiento.js"),
);
const { enriquecerLimitesCumplimientoEnCapa } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/capaTeoricaLimitesCumplimiento.js"),
);
const { instanteMarcaInstitucionalMs } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/fichadasValidacionMarcas.js"),
);

const FECHA = "2026-06-12";

/** Slice enriquecido (turno 08:00–16:00, gracia ingreso +10 / egreso −10). */
const CAPA_ENRIQUECIDA = {
  tipo_dia: "laborable",
  carga_horaria_diaria_minutos: 480,
  tolerancia_debitohorario_minutos: 30,
  ventana_ausencia_automatica_min: 120,
  umbral_solape_fuera_turno_min: 30,
  umbral_solape_fuera_turno_pct: 25,
  ingreso_nominal_iso: "2026-06-12T08:00:00-03:00",
  ingreso_limite_con_gracia_iso: "2026-06-12T08:10:00-03:00",
  egreso_nominal_iso: "2026-06-12T16:00:00-03:00",
  egreso_limite_con_gracia_iso: "2026-06-12T15:50:00-03:00",
};

function celdaConFichadas(filas) {
  return {
    tipo_dia: "laborable",
    fichadas_esperadas: 2,
    fichadas_reales: filas,
  };
}

describe("calcularDeltasCumplimiento (Fase 1 colisión)", () => {
  it("día limpio: dentro de gracia y sin déficit grave", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "08:05", egreso: "16:00", fecha_ymd: FECHA }]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA, ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "18:00") },
    );
    assert.equal(r.version, 1);
    assert.equal(r.disciplina.fuera_de_margen, false);
    assert.equal(r.disciplina.tardanza_minutos, 0);
    assert.equal(r.disciplina.salida_anticipada_minutos, 0);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, false);
    assert.equal(r.ausencia_automatica, false);
    assert.equal(r.alertas_activas.length, 0);
  });

  it("tardanza punitiva: supera tolerancia de débito del régimen", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "08:11", egreso: "16:00", fecha_ymd: FECHA }]),
      { ...CAPA_ENRIQUECIDA, tolerancia_debitohorario_minutos: 10 },
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.fuera_de_margen, true);
    assert.equal(r.disciplina.tardanza_minutos, 11);
    assert.ok(r.alertas_activas.includes("TARDANZA_PUNITIVA"));
  });

  it("débito de tiempo: déficit por tramos cortos sin infracción de margen de fichada", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([
        { ingreso: "08:00", egreso: "12:00", fecha_ymd: FECHA },
        { ingreso: "13:00", egreso: "15:50", fecha_ymd: FECHA },
      ]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.tardanza_minutos, 0);
    assert.equal(r.disciplina.salida_anticipada_minutos, 0);
    assert.equal(r.debito_tiempo.carga_real_minutos, 410);
    assert.equal(r.debito_tiempo.deficit_minutos, 70);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, true);
    assert.ok(r.alertas_activas.includes("DEFICIT_HORARIO_GRAVE"));
  });

  it("débito de tiempo: marcas hora_hm sueltas (carga manual sin teoría)", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ hora_hm: "06:00" }, { hora_hm: "13:01" }]),
      {
        ...CAPA_ENRIQUECIDA,
        ingreso_nominal_iso: "2026-06-15T06:00:00-03:00",
        ingreso_limite_con_gracia_iso: "2026-06-15T06:15:00-03:00",
        egreso_nominal_iso: "2026-06-15T14:00:00-03:00",
        egreso_limite_con_gracia_iso: "2026-06-15T13:50:00-03:00",
      },
      { fecha_ymd: "2026-06-15" },
    );
    assert.equal(r.debito_tiempo.carga_real_minutos, 421);
    assert.equal(r.debito_tiempo.deficit_minutos, 59);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, true);
  });

  it("fichada fuera del turno teórico (N vs marcas diurnas)", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "05:35", egreso: "13:55", fecha_ymd: "2026-06-18" }]),
      {
        tipo_dia: "laborable",
        turno_id: "N",
        carga_horaria_diaria_minutos: 480,
        tolerancia_debitohorario_minutos: 30,
        umbral_solape_fuera_turno_min: 30,
        umbral_solape_fuera_turno_pct: 25,
        ingreso_nominal_iso: "2026-06-19T01:00:00.000Z",
        ingreso_limite_con_gracia_iso: "2026-06-19T01:00:00.000Z",
        egreso_nominal_iso: "2026-06-19T09:00:00.000Z",
        egreso_limite_con_gracia_iso: "2026-06-19T09:00:00.000Z",
      },
      { fecha_ymd: "2026-06-18" },
    );
    assert.equal(r.fichada_fuera_turno_teorico, true);
    assert.equal(r.debito_tiempo.calculo_suspendido, true);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, false);
    assert.ok(r.alertas_activas.includes("FICHADA_FUERA_TURNO_TEORICO"));
  });

  it("ausencia automática en backfill cuando supera límite de ingreso + 120 min", () => {
    const umbralMs = instanteMarcaInstitucionalMs(FECHA, "10:10");
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA, ahora_evaluacion_ms: umbralMs },
    );
    assert.equal(r.ausencia_automatica, true);
    assert.ok(r.alertas_activas.includes("AUSENCIA_AUTOMATICA"));

    const antes = calcularDeltasCumplimiento(
      celdaConFichadas([]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA, ahora_evaluacion_ms: umbralMs - 60_000 },
    );
    assert.equal(antes.ausencia_automatica, false);
  });

  it("ausencia automática respeta ventana_ausencia_automatica_min de capa enriquecida", () => {
    const capaBase = {
      horas_teoricas_totales: 8,
      ingreso_teorico_final: "2026-06-12T08:00:00-03:00",
      egreso_teorico_final: "2026-06-12T16:00:00-03:00",
    };
    const regimen = { ventana_ausencia_automatica_min: 60, tolerancia_debitohorario_minutos: 30 };
    const turno = { tolerancia_ingreso_min: 10, tolerancia_egreso_min: 10 };
    const regimenConTurno = {
      ...regimen,
      turnos_disponibles: [{ turno_id: "M", ...turno }],
    };
    const capa60 = enriquecerLimitesCumplimientoEnCapa(capaBase, regimenConTurno);
    assert.equal(capa60.ventana_ausencia_automatica_min, 60);

    const umbralMs = instanteMarcaInstitucionalMs(FECHA, "09:10");
    const conVentana60 = calcularDeltasCumplimiento(celdaConFichadas([]), capa60, {
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: umbralMs,
    });
    assert.equal(conVentana60.ausencia_automatica, true);

    const capa120 = enriquecerLimitesCumplimientoEnCapa(capaBase, {
      ...regimenConTurno,
      ventana_ausencia_automatica_min: 120,
    });
    const antes120 = calcularDeltasCumplimiento(celdaConFichadas([]), capa120, {
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: umbralMs,
    });
    assert.equal(antes120.ausencia_automatica, false);
  });

  it("salida e ingreso anticipados: métricas vs nominal; alerta solo salida > tolerancia débito", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "05:00", egreso: "13:00", fecha_ymd: FECHA }]),
      {
        ...CAPA_ENRIQUECIDA,
        ingreso_nominal_iso: "2026-06-12T06:00:00-03:00",
        ingreso_limite_con_gracia_iso: "2026-06-12T06:15:00-03:00",
        egreso_nominal_iso: "2026-06-12T14:00:00-03:00",
        egreso_limite_con_gracia_iso: "2026-06-12T13:45:00-03:00",
      },
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.fuera_de_margen, true);
    assert.equal(r.disciplina.ingreso_anticipado_minutos, 60);
    assert.equal(r.disciplina.salida_anticipada_minutos, 60);
    assert.equal(r.alertas_activas.includes("INGRESO_ANTICIPADO"), false);
    assert.ok(r.alertas_activas.includes("SALIDA_ANTICIPADA"));
  });

  it("desvíos menores o iguales a tolerancia de débito: sin alertas de disciplina", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "06:05", egreso: "13:45", fecha_ymd: FECHA }]),
      {
        ...CAPA_ENRIQUECIDA,
        carga_horaria_diaria_minutos: 480,
        tolerancia_debitohorario_minutos: 30,
        ingreso_nominal_iso: "2026-06-12T06:00:00-03:00",
        ingreso_limite_con_gracia_iso: "2026-06-12T06:00:00-03:00",
        egreso_nominal_iso: "2026-06-12T14:00:00-03:00",
        egreso_limite_con_gracia_iso: "2026-06-12T14:00:00-03:00",
      },
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.tardanza_minutos, 5);
    assert.equal(r.disciplina.salida_anticipada_minutos, 15);
    assert.equal(r.disciplina.fuera_de_margen, false);
    assert.equal(r.debito_tiempo.deficit_minutos, 20);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, false);
    assert.equal(r.alertas_activas.length, 0);
  });

  it("salida anticipada: minutos vs egreso nominal (no restar gracia del cómputo)", () => {
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "08:00", egreso: "15:40", fecha_ymd: FECHA }]),
      CAPA_ENRIQUECIDA,
      { fecha_ymd: FECHA },
    );
    assert.equal(r.disciplina.salida_anticipada_minutos, 20);
    assert.equal(r.disciplina.fuera_de_margen, false);
    assert.equal(r.alertas_activas.includes("SALIDA_ANTICIPADA"), false);
  });

  it("M+N con huecos: solo mañana fichada — tardanza en M, sin salida falsa de 960 min", () => {
    const FECHA_MN = "2026-06-14";
    const capaMn = {
      tipo_dia: "laborable",
      tiene_huecos: true,
      carga_horaria_diaria_minutos: 960,
      horas_teoricas_totales: 16,
      tolerancia_debitohorario_minutos: 30,
      tolerancia_ingreso_dia_min: 0,
      tolerancia_egreso_dia_min: 0,
      ingreso_nominal_iso: "2026-06-14T09:00:00.000Z",
      ingreso_limite_con_gracia_iso: "2026-06-14T09:00:00.000Z",
      egreso_nominal_iso: "2026-06-15T09:00:00.000Z",
      egreso_limite_con_gracia_iso: "2026-06-15T09:00:00.000Z",
      segmentos: [
        {
          segmento_id: "M",
          ingreso_iso: "2026-06-14T09:00:00.000Z",
          egreso_iso: "2026-06-14T17:00:00.000Z",
        },
        {
          segmento_id: "N",
          ingreso_iso: "2026-06-15T01:00:00.000Z",
          egreso_iso: "2026-06-15T09:00:00.000Z",
        },
      ],
    };
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "07:00", egreso: "14:00", fecha_ymd: FECHA_MN }]),
      capaMn,
      { fecha_ymd: FECHA_MN },
    );
    assert.equal(r.calculo_por_segmentos, true);
    assert.equal(r.disciplina.tardanza_minutos, 60);
    assert.equal(r.disciplina.salida_anticipada_minutos, 0);
    assert.equal(r.debito_tiempo.carga_real_minutos, 420);
    assert.equal(r.debito_tiempo.deficit_minutos, 540);
    assert.equal(r.debito_tiempo.incumplimiento_carga_horaria, true);
    const noche = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "N");
    assert.equal(noche?.cubierto, false);
    assert.equal(noche?.incumplimiento_celda_minutos, 480);
    assert.equal(noche?.incumplimiento_celda_tipo, "ausente_tramo");
    const manana = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "M");
    assert.equal(manana?.incumplimiento_celda_minutos, 60);
    assert.equal(manana?.incumplimiento_celda_tipo, "tardanza");
  });

  it("M+N con huecos: sin fichadas — dos tramos AUSENTE en celda (no déficit agregado)", () => {
    const FECHA_MN = "2026-06-08";
    const capaMn = {
      tipo_dia: "laborable",
      tiene_huecos: true,
      carga_horaria_diaria_minutos: 960,
      tolerancia_debitohorario_minutos: 30,
      tolerancia_ingreso_dia_min: 0,
      tolerancia_egreso_dia_min: 0,
      ingreso_nominal_iso: "2026-06-08T09:00:00.000Z",
      ingreso_limite_con_gracia_iso: "2026-06-08T09:00:00.000Z",
      egreso_nominal_iso: "2026-06-09T09:00:00.000Z",
      egreso_limite_con_gracia_iso: "2026-06-09T09:00:00.000Z",
      segmentos: [
        {
          segmento_id: "M",
          ingreso_iso: "2026-06-08T09:00:00.000Z",
          egreso_iso: "2026-06-08T17:00:00.000Z",
        },
        {
          segmento_id: "N",
          ingreso_iso: "2026-06-09T01:00:00.000Z",
          egreso_iso: "2026-06-09T09:00:00.000Z",
        },
      ],
    };
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([]),
      capaMn,
      { fecha_ymd: FECHA_MN },
    );
    assert.equal(r.calculo_por_segmentos, true);
    assert.equal(r.segmentos_cumplimiento?.filter((s) => s.cubierto === false).length, 2);
    assert.equal(
      r.segmentos_cumplimiento?.every((s) => s.incumplimiento_celda_tipo === "ausente_tramo"),
      true,
    );
  });

  it("M+N con huecos: solo noche fichada — ausente M + salida N en badges de celda", () => {
    const FECHA_N = "2026-06-15";
    const capaMn = {
      tipo_dia: "laborable",
      tiene_huecos: true,
      carga_horaria_diaria_minutos: 960,
      horas_teoricas_totales: 16,
      tolerancia_debitohorario_minutos: 30,
      tolerancia_ingreso_dia_min: 15,
      tolerancia_egreso_dia_min: 15,
      ingreso_nominal_iso: "2026-06-15T06:00:00-03:00",
      ingreso_limite_con_gracia_iso: "2026-06-15T06:15:00-03:00",
      egreso_nominal_iso: "2026-06-16T06:00:00-03:00",
      egreso_limite_con_gracia_iso: "2026-06-16T05:45:00-03:00",
      segmentos: [
        {
          segmento_id: "M",
          ingreso_iso: "2026-06-15T06:00:00-03:00",
          egreso_iso: "2026-06-15T14:00:00-03:00",
        },
        {
          segmento_id: "N",
          ingreso_iso: "2026-06-15T22:00:00-03:00",
          egreso_iso: "2026-06-16T06:00:00-03:00",
        },
      ],
    };
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([
        {
          ingreso: "21:45",
          egreso: "05:35",
          fecha_ymd: FECHA_N,
          fecha_egreso_ymd: "2026-06-16",
        },
      ]),
      capaMn,
      { fecha_ymd: FECHA_N },
    );
    assert.equal(r.calculo_por_segmentos, true);
    assert.equal(r.debito_tiempo.deficit_minutos, 490);
    const manana = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "M");
    assert.equal(manana?.incumplimiento_celda_minutos, 480);
    assert.equal(manana?.incumplimiento_celda_tipo, "ausente_tramo");
    const noche = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "N");
    assert.equal(noche?.incumplimiento_celda_minutos, 25);
    assert.equal(noche?.incumplimiento_celda_tipo, "salida");
  });

  it("turno T en segmento: ignora sobre nocturno obsoleto y no marca fuera de turno", () => {
    const FECHA_T = "2026-06-14";
    const regimen = {
      tolerancia_debitohorario_minutos: 30,
      turnos_disponibles: [
        { turno_id: "N", tolerancia_ingreso_min: 15, tolerancia_egreso_min: 15 },
        { turno_id: "T", tolerancia_ingreso_min: 15, tolerancia_egreso_min: 15 },
      ],
    };
    const capaBase = {
      tipo_dia: "laborable",
      tiene_huecos: false,
      horas_teoricas_totales: 8,
      turno_compuesto_id: "T",
      ingreso_teorico_final: "2026-06-13T22:00:00-03:00",
      egreso_teorico_final: "2026-06-14T06:00:00-03:00",
      segmentos: [
        {
          segmento_id: "T",
          ingreso_iso: "2026-06-14T14:00:00-03:00",
          egreso_iso: "2026-06-14T22:00:00-03:00",
        },
      ],
    };
    const capa = enriquecerLimitesCumplimientoEnCapa(capaBase, regimen);
    assert.equal(capa.ingreso_nominal_iso, "2026-06-14T14:00:00-03:00");
    assert.equal(capa.egreso_nominal_iso, "2026-06-14T22:00:00-03:00");

    const r = calcularDeltasCumplimiento(
      celdaConFichadas([{ ingreso: "14:15", egreso: "21:35", fecha_ymd: FECHA_T }]),
      capa,
      { fecha_ymd: FECHA_T },
    );
    assert.notEqual(r.fichada_fuera_turno_teorico, true);
    assert.equal(r.alertas_activas?.includes("FICHADA_FUERA_TURNO_TEORICO"), false);
  });

  it("M+T+N continuo: M fichada, T ausente, N con ingreso — por segmento sin fuera de turno", () => {
    const FECHA_MTN = "2026-06-16";
    const capaMtn = enriquecerLimitesCumplimientoEnCapa(
      {
        tipo_dia: "laborable",
        tiene_huecos: false,
        turno_compuesto_id: "M+T+N",
        horas_teoricas_totales: 24,
        segmentos: [
          {
            segmento_id: "M",
            ingreso_iso: "2026-06-16T09:00:00.000Z",
            egreso_iso: "2026-06-16T17:00:00.000Z",
          },
          {
            segmento_id: "T",
            ingreso_iso: "2026-06-16T17:00:00.000Z",
            egreso_iso: "2026-06-17T01:00:00.000Z",
          },
          {
            segmento_id: "N",
            ingreso_iso: "2026-06-17T01:00:00.000Z",
            egreso_iso: "2026-06-17T09:00:00.000Z",
          },
        ],
        ingreso_teorico_final: "2026-06-16T09:00:00.000Z",
        egreso_teorico_final: "2026-06-17T09:00:00.000Z",
      },
      {
        tolerancia_debitohorario_minutos: 30,
        turnos_disponibles: [
          { turno_id: "M", tolerancia_ingreso_min: 15, tolerancia_egreso_min: 15 },
        ],
      },
    );
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([
        { ingreso: "05:55", egreso: "06:05", fecha_ymd: FECHA_MTN },
        { ingreso: "21:55", fecha_ymd: FECHA_MTN },
      ]),
      capaMtn,
      { fecha_ymd: FECHA_MTN },
    );
    assert.notEqual(r.fichada_fuera_turno_teorico, true);
    assert.equal(r.calculo_por_segmentos, true);
    const m = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "M");
    const t = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "T");
    const n = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "N");
    assert.equal(m?.cubierto, true);
    assert.equal(t?.cubierto, false);
    assert.equal(t?.incumplimiento_celda_tipo, "ausente_tramo");
    assert.equal(n?.cubierto, true);
  });

  it("ABM M+N en M+T+N: tramo M largo y N no roba T ni marca tardanza 470", () => {
    const FECHA_MTN = "2026-06-16";
    const capaMtn = enriquecerLimitesCumplimientoEnCapa(
      {
        tipo_dia: "laborable",
        tiene_huecos: false,
        turno_compuesto_id: "M+T+N",
        horas_teoricas_totales: 24,
        segmentos: [
          {
            segmento_id: "M",
            ingreso_iso: "2026-06-16T09:00:00.000Z",
            egreso_iso: "2026-06-16T17:00:00.000Z",
          },
          {
            segmento_id: "T",
            ingreso_iso: "2026-06-16T17:00:00.000Z",
            egreso_iso: "2026-06-17T01:00:00.000Z",
          },
          {
            segmento_id: "N",
            ingreso_iso: "2026-06-17T01:00:00.000Z",
            egreso_iso: "2026-06-17T09:00:00.000Z",
          },
        ],
        ingreso_teorico_final: "2026-06-16T09:00:00.000Z",
        egreso_teorico_final: "2026-06-17T09:00:00.000Z",
      },
      {
        tolerancia_debitohorario_minutos: 30,
        turnos_disponibles: [
          { turno_id: "M", tolerancia_ingreso_min: 15, tolerancia_egreso_min: 15 },
        ],
      },
    );
    const r = calcularDeltasCumplimiento(
      celdaConFichadas([
        { ingreso: "05:54", egreso: "14:10", fecha_ymd: FECHA_MTN },
        {
          ingreso: "21:50",
          egreso: "05:55",
          fecha_ymd: FECHA_MTN,
          fecha_egreso_ymd: "2026-06-17",
        },
      ]),
      capaMtn,
      { fecha_ymd: FECHA_MTN },
    );
    const m = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "M");
    const t = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "T");
    const n = r.segmentos_cumplimiento?.find((s) => s.segmento_id === "N");
    assert.equal(m?.cubierto, true);
    assert.equal(t?.cubierto, false);
    assert.equal(t?.incumplimiento_celda_tipo, "ausente_tramo");
    assert.equal(n?.cubierto, true);
    assert.equal(r.disciplina?.tardanza_minutos, 0);
    assert.equal(r.alertas_activas?.includes("TARDANZA_PUNITIVA"), false);
  });
});
