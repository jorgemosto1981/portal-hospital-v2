/**
 * node --test functions/test/resolverValidacionFichadaDia.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  resolverValidacionFichadaDia,
  ESTADO_SEMAFORO,
  compactarValidacionParaListado,
} = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/resolverValidacionFichadaDia.js"),
);
const { instanteMarcaInstitucionalMs } = require(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/fichadasValidacionMarcas.js"),
);

const FECHA = "2026-06-12";
const CAPA = {
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

function celdaLaborable(overrides = {}) {
  return {
    tipo_dia: "laborable",
    fichadas_esperadas: 2,
    rda_turno_id: "M",
    rda_ingreso: "08:00",
    rda_egreso: "16:00",
    ...overrides,
  };
}

describe("resolverValidacionFichadaDia (Fase F)", () => {
  it("omit: día futuro no evalúa", () => {
    const r = resolverValidacionFichadaDia({
      celda: celdaLaborable(),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: "2099-01-01",
      ahora_evaluacion_ms: Date.now(),
    });
    assert.equal(r.accion, "omit");
    assert.equal(r.motivo, "dia_futuro");
  });

  it("delete: licencia aprobada cubre día laborable con expectativa fichada", () => {
    const r = resolverValidacionFichadaDia({
      celda: celdaLaborable({ fichadas_reales: [] }),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "18:00"),
      eventos: [
        {
          codigo_grilla: "LAO",
          estado_solicitud_id: "cfg_esa_aprobada",
          color_ui: "#3B82F6",
        },
      ],
    });
    assert.equal(r.accion, "delete");
    assert.equal(r.motivo, "licencia_cubre_dia");
  });

  it("omit: franco sin fichadas_esperadas", () => {
    const r = resolverValidacionFichadaDia({
      celda: { tipo_dia: "franco", es_franco: true, fichadas_esperadas: 0 },
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "12:00"),
    });
    assert.equal(r.accion, "omit");
    assert.equal(r.motivo, "sin_expectativa_fichada");
  });

  it("ROJO: ausencia automática sin marcas", () => {
    const r = resolverValidacionFichadaDia({
      celda: celdaLaborable({ fichadas_reales: [] }),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "10:15"),
    });
    assert.equal(r.accion, "write");
    assert.equal(r.validacion_fichada_dia.estado_semaforo, ESTADO_SEMAFORO.ROJO);
    assert.ok(
      r.validacion_fichada_dia.alertas_semanticas.some((a) => a.codigo === "AUSENCIA_AUTOMATICA")
        || r.validacion_fichada_dia.texto_resumen.toLowerCase().includes("ausencia"),
    );
  });

  it("AMARILLO: sin marcas antes de cerrar ventana de ausencia", () => {
    const r = resolverValidacionFichadaDia({
      celda: celdaLaborable({ fichadas_reales: [] }),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "09:00"),
    });
    assert.equal(r.accion, "write");
    assert.equal(r.validacion_fichada_dia.estado_semaforo, ESTADO_SEMAFORO.AMARILLO);
  });

  it("VERDE: marcas dentro de gracia", () => {
    const r = resolverValidacionFichadaDia({
      celda: celdaLaborable({
        fichadas_reales: [{ ingreso: "08:05", egreso: "16:00", fecha_ymd: FECHA }],
      }),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "18:00"),
    });
    assert.equal(r.accion, "write");
    assert.equal(r.validacion_fichada_dia.estado_semaforo, ESTADO_SEMAFORO.VERDE);
  });

  it("skip: eval_estable y mismo fingerprint", () => {
    const first = resolverValidacionFichadaDia({
      celda: celdaLaborable({
        fichadas_reales: [{ ingreso: "08:05", egreso: "16:00", fecha_ymd: FECHA }],
      }),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "18:00"),
    });
    const second = resolverValidacionFichadaDia({
      celda: celdaLaborable({
        fichadas_reales: [{ ingreso: "08:05", egreso: "16:00", fecha_ymd: FECHA }],
      }),
      capaTeoricaGrupo: CAPA,
      fecha_ymd: FECHA,
      ahora_evaluacion_ms: instanteMarcaInstitucionalMs(FECHA, "18:00"),
      validacion_existente: first.validacion_fichada_dia,
    });
    assert.equal(second.accion, "skip");
    assert.equal(second.eval_fingerprint, first.validacion_fichada_dia.eval_fingerprint);
  });

  it("compactarValidacionParaListado omite alertas_semanticas", () => {
    const full = {
      estado_semaforo: "AMARILLO",
      texto_resumen: "x",
      eval_estable: true,
      eval_fingerprint: "fp_abc",
      evaluado_en: "2026-06-12T12:00:00.000Z",
      alertas_semanticas: [{ codigo: "TARDANZA_PUNITIVA" }],
    };
    const c = compactarValidacionParaListado(full);
    assert.equal(c.estado_semaforo, "AMARILLO");
    assert.equal("alertas_semanticas" in c, false);
  });
});
