import { describe, it, expect } from "vitest";

import {
  evaluarPermisoTeoria,
  CANALES_TEORIA,
  MOTIVOS_RECHAZO_TEORIA,
} from "./teoriaPermisosGso.js";

describe("US-13: Matriz de Permisos de Teoría GSO", () => {
  const RRHH_UNIFICADO = { id: "rrhh1", esRrhh: true, esJefe: false };
  const JEFE_SERVICIO = { id: "jefe1", esRrhh: false, esJefe: true, nivelJerarquico: 10 };
  const MEDICO_TITULAR = { id: "med1", esRrhh: false, esJefe: false, nivelJerarquico: 1 };

  describe("G4: Titular y auto-modificación", () => {
    it("bloquea al titular hacer override sobre sí mismo", () => {
      const contexto = {
        actor: MEDICO_TITULAR,
        target: MEDICO_TITULAR,
        planEstado: "HABILITADO",
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contexto);

      expect(resultado.permitido).toBe(false);
      expect(resultado.motivoRechazo).toBe("TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA");
    });
  });

  describe("G3: RRHH Unificado (Labor + Admin)", () => {
    it("RRHH puede hacer override en GSO incluso con período cerrado", () => {
      const contexto = {
        actor: RRHH_UNIFICADO,
        target: MEDICO_TITULAR,
        planEstado: "HABILITADO",
        periodo: { cerrado: true, ventanaM1: true },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contexto);

      expect(resultado.permitido).toBe(true);
    });

    it("RRHH puede aprobar o revertir planes", () => {
      const contexto = { actor: RRHH_UNIFICADO };
      expect(evaluarPermisoTeoria(CANALES_TEORIA.APROBAR_PLAN, contexto).permitido).toBe(true);
      expect(evaluarPermisoTeoria(CANALES_TEORIA.REVERTIR_PLAN, contexto).permitido).toBe(true);
    });
  });

  describe("G2: Jefe y jerarquía real (GSO)", () => {
    it("permite override si el jefe es superior del target", () => {
      const contexto = {
        actor: JEFE_SERVICIO,
        target: { id: "med2", nivelJerarquico: 5 },
        planEstado: "BORRADOR",
        periodo: { cerrado: false, ventanaM1: false },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contexto);
      expect(resultado.permitido).toBe(true);
    });

    it("bloquea override si el jefe NO es superior del target (claim falso positivo)", () => {
      const contexto = {
        actor: JEFE_SERVICIO,
        target: { id: "jefeOtroServicio", nivelJerarquico: 20 },
        planEstado: "BORRADOR",
        periodo: { cerrado: false, ventanaM1: false },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contexto);

      expect(resultado.permitido).toBe(false);
      expect(resultado.motivoRechazo).toBe("NO_ES_SUPERIOR_JERARQUICO");
    });
  });

  describe("G1: Plan vs Override", () => {
    it("bloquea override de jefe si el mes está HABILITADO y NO es urgencia", () => {
      const contexto = {
        actor: JEFE_SERVICIO,
        target: { id: "med2", nivelJerarquico: 5 },
        planEstado: "HABILITADO",
        esUrgenciaOperativa: false,
        periodo: { cerrado: false, ventanaM1: false },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contexto);

      expect(resultado.permitido).toBe(false);
      expect(resultado.motivoRechazo).toBe("PLAN_HABILITADO_REQUIERE_URGENCIA");
    });

    it("permite override de jefe en mes HABILITADO si se marca como urgencia operativa", () => {
      const contexto = {
        actor: JEFE_SERVICIO,
        target: { id: "med2", nivelJerarquico: 5 },
        planEstado: "HABILITADO",
        esUrgenciaOperativa: true,
        periodo: { cerrado: false, ventanaM1: false },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contexto);
      expect(resultado.permitido).toBe(true);
    });
  });

  describe("G6: Edición de Plan Mensual", () => {
    it("solo el jefe (o RRHH) puede guardar el plan, no un empleado base", () => {
      const contextoMedico = { actor: MEDICO_TITULAR, planEstado: "BORRADOR" };
      const contextoJefe = { actor: JEFE_SERVICIO, planEstado: "BORRADOR" };

      expect(evaluarPermisoTeoria(CANALES_TEORIA.GUARDAR_PLAN, contextoMedico).permitido).toBe(false);
      expect(evaluarPermisoTeoria(CANALES_TEORIA.GUARDAR_PLAN, contextoJefe).permitido).toBe(true);
    });
  });

  describe("Cobertura adicional (Tests Extra)", () => {
    it("RRHH puede guardar y enviar el plan mensual (usando esRrhhAdmin)", () => {
      const contexto = { actor: { esRrhhAdmin: true }, planEstado: "BORRADOR" };
      expect(evaluarPermisoTeoria(CANALES_TEORIA.GUARDAR_PLAN, contexto).permitido).toBe(true);
      expect(evaluarPermisoTeoria(CANALES_TEORIA.ENVIAR_PLAN, contexto).permitido).toBe(true);
    });

    it("bloquea override a Jefe si el período está cerrado o en ventana M-1", () => {
      const contextoCerrado = {
        actor: { id: "jefe1", esJefe: true, nivelJerarquico: 10 },
        target: { id: "med2", nivelJerarquico: 5 },
        planEstado: "BORRADOR",
        periodo: { cerrado: true, ventanaM1: false },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contextoCerrado);
      expect(resultado.permitido).toBe(false);
      expect(resultado.motivoRechazo).toBe(MOTIVOS_RECHAZO_TEORIA.PERIODO_CERRADO);
    });

    it("reconoce esRrhhLabor como RRHH operativo saltando bloqueos (G3)", () => {
      const contextoLabor = {
        actor: { id: "rrhh2", esRrhhLabor: true },
        target: { id: "med1", nivelJerarquico: 1 },
        planEstado: "HABILITADO",
        periodo: { cerrado: true, ventanaM1: true },
      };
      const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, contextoLabor);
      expect(resultado.permitido).toBe(true);
    });
  });
});
