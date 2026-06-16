"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizarDiasVisGso,
  sanitizarVistaGrillaMesAgenteGso,
  proyectarValidacionFichadaListado,
} = require("../modules/asistencia/grillaVisSanitizeGso.js");
const {
  buildFirestorePatchValidacionFichadaDia,
} = require("../modules/shared/validacionFichadaDiaPersistencia.js");

describe("grillaVisSanitizeGso (UX-6 + Fase F)", () => {
  it("elimina fichadas_reales y proyecta validacion_fichada_dia liviana", () => {
    const dias = sanitizarDiasVisGso({
      "09": {
        rda_ingreso: "06:00",
        fichadas_esperadas: 2,
        tipo_dia: "laborable",
        fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
        analitica_cumplimiento: { version: 1, disciplina: { tardanza_minutos: 5 } },
        fichadas: [{ tipo: "ingreso" }],
        capa_realidad: { ok: true },
        divergencias: [{ codigo: "X" }],
        estado_fichada_jefe: "OK",
        validacion_fichada_dia: {
          estado_semaforo: "VERDE",
          texto_resumen: "Conforme",
          eval_estable: true,
          eval_fingerprint: "fp_1",
          evaluado_en: "2026-06-12T12:00:00.000Z",
          alertas_semanticas: [{ codigo: "X", texto_humano: "no" }],
        },
      },
    });
    assert.equal(dias["09"].fichadas_esperadas, 2);
    assert.equal("fichadas_reales" in dias["09"], false);
    assert.equal(dias["09"].fichada_presencia, "presente");
    assert.equal("estado_fichada_jefe" in dias["09"], false);
    assert.equal(dias["09"].validacion_fichada_dia.estado_semaforo, "VERDE");
    assert.equal("alertas_semanticas" in dias["09"].validacion_fichada_dia, false);
  });

  it("sin validacion persistida no emite semáforo ni legacy estado_fichada_jefe", () => {
    const dias = sanitizarDiasVisGso({
      "10": {
        tipo_dia: "laborable",
        fichadas_esperadas: 2,
        rda_turno_id: "M",
        fichadas_reales: [],
      },
    });
    assert.equal(dias["10"].fichada_presencia, "ausente");
    assert.equal("validacion_fichada_dia" in dias["10"], false);
    assert.equal("estado_fichada_jefe" in dias["10"], false);
    assert.equal("fichadas_reales" in dias["10"], false);
  });

  it("preserva metadata de vista", () => {
    const v = sanitizarVistaGrillaMesAgenteGso({
      ok: true,
      vis_id: "vis_2026_06_per_x_gdt_y",
      dias: { "01": { fichadas_reales: [] } },
    });
    assert.equal(v.vis_id, "vis_2026_06_per_x_gdt_y");
    assert.equal("fichadas_reales" in v.dias["01"], false);
  });
});

describe("validacionFichadaDiaPersistencia", () => {
  it("buildFirestorePatch: omit y skip no generan patch", () => {
    assert.equal(buildFirestorePatchValidacionFichadaDia("12", { accion: "omit" }), null);
    assert.equal(buildFirestorePatchValidacionFichadaDia("12", { accion: "skip" }), null);
  });

  it("buildFirestorePatch: write incluye path dias", () => {
    const p = buildFirestorePatchValidacionFichadaDia("12", {
      accion: "write",
      validacion_fichada_dia: { estado_semaforo: "VERDE", texto_resumen: "ok" },
    });
    assert.ok(p);
    assert.equal(p["dias.12.validacion_fichada_dia"].estado_semaforo, "VERDE");
  });

  it("proyectarValidacionFichadaListado compacta alertas", () => {
    const c = proyectarValidacionFichadaListado({
      validacion_fichada_dia: {
        estado_semaforo: "AMARILLO",
        texto_resumen: "x",
        eval_estable: true,
        eval_fingerprint: "fp",
        evaluado_en: "t",
        alertas_semanticas: [{}],
      },
    });
    assert.equal(c.estado_semaforo, "AMARILLO");
    assert.equal("alertas_semanticas" in c, false);
  });
});
