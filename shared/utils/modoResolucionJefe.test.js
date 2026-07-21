/**
 * Unit tests — modoResolucionJefe (pure).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MODO_RESOLUCION_JEFE_AUTORIZACION,
  MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO,
  modoResolucionJefeDesdeSolicitud,
  modoResolucionJefeDesdeVersion,
  normalizeModoResolucionJefe,
} from "./modoResolucionJefe.js";

describe("modoResolucionJefe", () => {
  it("normalize defaults to autorizacion", () => {
    assert.equal(normalizeModoResolucionJefe(null), MODO_RESOLUCION_JEFE_AUTORIZACION);
    assert.equal(normalizeModoResolucionJefe("otro"), MODO_RESOLUCION_JEFE_AUTORIZACION);
    assert.equal(normalizeModoResolucionJefe("toma_conocimiento"), MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO);
  });

  it("lee desde bloque workflow de versión", () => {
    assert.equal(
      modoResolucionJefeDesdeVersion({
        bloque_workflow_sla_cobertura: { modo_resolucion_jefe: "toma_conocimiento" },
      }),
      MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO,
    );
    assert.equal(modoResolucionJefeDesdeVersion({}), MODO_RESOLUCION_JEFE_AUTORIZACION);
  });

  it("sols antiguas 63-* caen en toma_conocimiento", () => {
    assert.equal(modoResolucionJefeDesdeSolicitud({}, "63-J"), MODO_RESOLUCION_JEFE_TOMA_CONOCIMIENTO);
    assert.equal(modoResolucionJefeDesdeSolicitud({}, "64-A"), MODO_RESOLUCION_JEFE_AUTORIZACION);
    assert.equal(
      modoResolucionJefeDesdeSolicitud({ modo_resolucion_jefe: "autorizacion" }, "63-J"),
      MODO_RESOLUCION_JEFE_AUTORIZACION,
    );
  });
});
