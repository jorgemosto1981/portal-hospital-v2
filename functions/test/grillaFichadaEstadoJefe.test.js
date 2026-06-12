/**
 * node --test functions/test/grillaFichadaEstadoJefe.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  evaluarEstadoFichadaJefe,
  ESTADO_FICHADA_JEFE,
} = require(join(dirname(fileURLToPath(import.meta.url)), "../modules/shared/grillaFichadaEstadoJefe.js"));

describe("evaluarEstadoFichadaJefe precedencia", () => {
  it("ALERTA si espera fichada y sin marcas", () => {
    const r = evaluarEstadoFichadaJefe({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      fichadas_reales: [],
    });
    assert.equal(r.estado_fichada_jefe, ESTADO_FICHADA_JEFE.ALERTA);
  });

  it("RRHH_PENDIENTE si hay advertencias", () => {
    const r = evaluarEstadoFichadaJefe({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
      advertencias_fichada_abiertas: ["NOCTURNIDAD_AMBIGUA"],
    });
    assert.equal(r.estado_fichada_jefe, ESTADO_FICHADA_JEFE.RRHH_PENDIENTE);
  });

  it("RRHH_RESUELTO si flag persistido", () => {
    const r = evaluarEstadoFichadaJefe({
      fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
      resuelto_rrhh: true,
    });
    assert.equal(r.estado_fichada_jefe, ESTADO_FICHADA_JEFE.RRHH_RESUELTO);
  });

  it("OK armónico", () => {
    const r = evaluarEstadoFichadaJefe({
      tipo_dia: "laborable",
      fichadas_esperadas: 2,
      fichadas_reales: [{ ingreso: "06:05", egreso: "14:00" }],
    });
    assert.equal(r.estado_fichada_jefe, ESTADO_FICHADA_JEFE.OK);
  });
});
