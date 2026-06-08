"use strict";

/**
 * US-13 — motor teoriaPermisosGso (Functions).
 * Ejecutar: node --test functions/test/teoriaPermisosGso.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");

const {
  evaluarPermisoTeoria,
  assertTeoriaOverrideAuth,
  CANALES_TEORIA,
  MOTIVOS_RECHAZO_TEORIA,
} = require("../modules/shared/teoriaPermisosGso");

function mockRequest(token = {}) {
  return {
    auth: {
      uid: "uid_test",
      token: {
        persona_id: "per_actor",
        tiene_subordinados: false,
        roles_hlc_vigentes: [],
        ...token,
      },
    },
  };
}

function assertHttpsError(fn, code, messagePart) {
  assert.throws(
    fn,
    (err) => {
      assert.ok(err instanceof HttpsError);
      assert.equal(err.code, code);
      if (messagePart) {
        assert.ok(String(err.message).includes(messagePart), `expected message containing ${messagePart}, got ${err.message}`);
      }
      return true;
    },
  );
}

describe("US-13 Functions: evaluarPermisoTeoria", () => {
  const RRHH_UNIFICADO = { id: "per_rrhh", esRrhh: true, esJefe: false };
  const JEFE_SERVICIO = { id: "per_jefe", esRrhh: false, esJefe: true, nivelJerarquico: 10 };
  const MEDICO_TITULAR = { id: "per_med", esRrhh: false, esJefe: false, nivelJerarquico: 1 };

  describe("G4: Titular y auto-modificación", () => {
    it("bloquea al titular hacer override sobre sí mismo", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: MEDICO_TITULAR,
        target: MEDICO_TITULAR,
        planEstado: "HABILITADO",
      });
      assert.equal(resultado.permitido, false);
      assert.equal(resultado.motivoRechazo, MOTIVOS_RECHAZO_TEORIA.TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA);
    });

    it("bloquea self-override incluso para RRHH (segregación de funciones)", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: RRHH_UNIFICADO,
        target: { id: "per_rrhh", nivelJerarquico: 50 },
        planEstado: "HABILITADO",
        periodo: { cerrado: true, ventanaM1: true },
      });
      assert.equal(resultado.permitido, false);
      assert.equal(resultado.motivoRechazo, MOTIVOS_RECHAZO_TEORIA.TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA);
    });
  });

  describe("G3: RRHH Unificado", () => {
    it("RRHH puede override con período cerrado", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: RRHH_UNIFICADO,
        target: MEDICO_TITULAR,
        planEstado: "HABILITADO",
        periodo: { cerrado: true, ventanaM1: true },
      });
      assert.equal(resultado.permitido, true);
    });

    it("RRHH puede aprobar o revertir planes", () => {
      const contexto = { actor: RRHH_UNIFICADO };
      assert.equal(evaluarPermisoTeoria(CANALES_TEORIA.APROBAR_PLAN, contexto).permitido, true);
      assert.equal(evaluarPermisoTeoria(CANALES_TEORIA.REVERTIR_PLAN, contexto).permitido, true);
    });

    it("reconoce esRrhhLabor como RRHH operativo", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: { id: "per_rrhh2", esRrhhLabor: true },
        target: { id: "per_med", nivelJerarquico: 1 },
        planEstado: "HABILITADO",
        periodo: { cerrado: true, ventanaM1: true },
      });
      assert.equal(resultado.permitido, true);
    });
  });

  describe("G2: Jerarquía en GDT", () => {
    it("permite override si el actor es superior del target", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: JEFE_SERVICIO,
        target: { id: "per_med2", nivelJerarquico: 5 },
        planEstado: "BORRADOR",
        periodo: { cerrado: false, ventanaM1: false },
      });
      assert.equal(resultado.permitido, true);
    });

    it("bloquea si el actor no es superior (nivel ≤ target)", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: JEFE_SERVICIO,
        target: { id: "per_jefe_otro", nivelJerarquico: 20 },
        planEstado: "BORRADOR",
        periodo: { cerrado: false, ventanaM1: false },
      });
      assert.equal(resultado.permitido, false);
      assert.equal(resultado.motivoRechazo, MOTIVOS_RECHAZO_TEORIA.NO_ES_SUPERIOR_JERARQUICO);
    });
  });

  describe("G1: Plan vs Override", () => {
    it("bloquea jefe en plan HABILITADO sin urgencia", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: JEFE_SERVICIO,
        target: { id: "per_med2", nivelJerarquico: 5 },
        planEstado: "HABILITADO",
        esUrgenciaOperativa: false,
        periodo: { cerrado: false, ventanaM1: false },
      });
      assert.equal(resultado.permitido, false);
      assert.equal(resultado.motivoRechazo, MOTIVOS_RECHAZO_TEORIA.PLAN_HABILITADO_REQUIERE_URGENCIA);
    });

    it("permite jefe en plan HABILITADO con urgencia operativa", () => {
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
        actor: JEFE_SERVICIO,
        target: { id: "per_med2", nivelJerarquico: 5 },
        planEstado: "HABILITADO",
        esUrgenciaOperativa: true,
        periodo: { cerrado: false, ventanaM1: false },
      });
      assert.equal(resultado.permitido, true);
    });
  });

  describe("G6: Plan mensual (motor)", () => {
    it("solo jefe o RRHH puede guardar plan", () => {
      assert.equal(
        evaluarPermisoTeoria(CANALES_TEORIA.GUARDAR_PLAN, {
          actor: MEDICO_TITULAR,
          planEstado: "BORRADOR",
        }).permitido,
        false,
      );
      assert.equal(
        evaluarPermisoTeoria(CANALES_TEORIA.GUARDAR_PLAN, {
          actor: JEFE_SERVICIO,
          planEstado: "BORRADOR",
        }).permitido,
        true,
      );
    });
  });

  it("bloquea override a jefe si período cerrado o ventana M-1", () => {
    const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
      actor: { id: "per_jefe", esJefe: true, nivelJerarquico: 10 },
      target: { id: "per_med2", nivelJerarquico: 5 },
      planEstado: "BORRADOR",
      periodo: { cerrado: true, ventanaM1: false },
    });
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.motivoRechazo, MOTIVOS_RECHAZO_TEORIA.PERIODO_CERRADO);
  });
});

describe("US-13 Functions: assertTeoriaOverrideAuth", () => {
  it("rechaza sin sesión", () => {
    assertHttpsError(
      () => assertTeoriaOverrideAuth({ auth: null }, { targetPersonaId: "per_med" }),
      "unauthenticated",
    );
  });

  it("rechaza G4 self-override para agente común", () => {
    const req = mockRequest({ persona_id: "per_med", tiene_subordinados: false });
    assertHttpsError(
      () => assertTeoriaOverrideAuth(req, {
        targetPersonaId: "per_med",
        actorNivelJerarquicoEnGrupo: 20,
        targetNivelJerarquicoEnGrupo: 20,
        planEstado: "BORRADOR",
      }),
      "permission-denied",
      MOTIVOS_RECHAZO_TEORIA.TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA,
    );
  });

  it("pasa G2 cuando niveles en GDT indican superioridad", () => {
    const req = mockRequest({ persona_id: "per_jefe", tiene_subordinados: true });
    assert.doesNotThrow(() => assertTeoriaOverrideAuth(req, {
      targetPersonaId: "per_med",
      grupoTrabajoId: "gdt_1",
      actorNivelJerarquicoEnGrupo: 90,
      targetNivelJerarquicoEnGrupo: 20,
      planEstado: "BORRADOR",
      periodo: { cerrado: false, ventanaM1: false },
    }));
  });

  it("rechaza G1 plan HABILITADO sin flag urgencia", () => {
    const req = mockRequest({ persona_id: "per_jefe", tiene_subordinados: true });
    assertHttpsError(
      () => assertTeoriaOverrideAuth(req, {
        targetPersonaId: "per_med",
        actorNivelJerarquicoEnGrupo: 90,
        targetNivelJerarquicoEnGrupo: 20,
        planEstado: "HABILITADO",
        esUrgenciaOperativa: false,
      }),
      "permission-denied",
      MOTIVOS_RECHAZO_TEORIA.PLAN_HABILITADO_REQUIERE_URGENCIA,
    );
  });

  it("RRHH desde token pasa sin niveles jerárquicos", () => {
    const req = mockRequest({
      persona_id: "per_rrhh",
      roles_hlc_vigentes: ["CFG_RRHH"],
    });
    assert.doesNotThrow(() => assertTeoriaOverrideAuth(req, {
      targetPersonaId: "per_med",
      actorNivelJerarquicoEnGrupo: 0,
      targetNivelJerarquicoEnGrupo: 99,
      planEstado: "HABILITADO",
      esUrgenciaOperativa: false,
    }));
  });
});
