/**
 * US-13 Fase A — política permisos sobre capa teórica (agnóstico UI / backend).
 * SSoT normativa: docs/v2/CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md (G1–G7).
 */

/** @typedef {'BORRADOR'|'EN_REVISION'|'ENVIADO'|'HABILITADO'} PlanEstadoTeoria */

export const CANALES_TEORIA = {
  GUARDAR_PLAN: "C1",
  ENVIAR_PLAN: "C2",
  APROBAR_PLAN: "C3",
  RECHAZAR_PLAN: "C4",
  REVERTIR_PLAN: "C4b",
  OVERRIDE_DIA: "C5",
  APLICAR_BATCH: "C6",
  BATCH_DIA: "C6",
  CERRAR_PERIODO: "C10",
  CIERRE_PERIODO: "C10",
};

export const MOTIVOS_RECHAZO_TEORIA = {
  TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA: "TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA",
  NO_ES_SUPERIOR_JERARQUICO: "NO_ES_SUPERIOR_JERARQUICO",
  PLAN_HABILITADO_REQUIERE_URGENCIA: "PLAN_HABILITADO_REQUIERE_URGENCIA",
  SOLO_JEFE_O_RRHH_PUEDE_EDITAR_PLAN: "SOLO_JEFE_O_RRHH_PUEDE_EDITAR_PLAN",
  PERIODO_CERRADO: "PERIODO_CERRADO",
  SOLO_RRHH: "SOLO_RRHH",
  ACCION_DESCONOCIDA: "ACCION_DESCONOCIDA",
};

/**
 * G3 — RRHH institucional unificado (labor ∨ admin ∨ flag esRrhh en contexto).
 * @param {{ esRrhh?: boolean, esRrhhLabor?: boolean, esRrhhAdmin?: boolean } | null | undefined} actor
 */
export function esRrhhOperativo(actor) {
  if (!actor || typeof actor !== "object") return false;
  if (actor.esRrhh === true) return true;
  return actor.esRrhhLabor === true || actor.esRrhhAdmin === true;
}

/**
 * @param {string} accion
 * @param {object} contexto
 * @returns {{ permitido: boolean, motivoRechazo: string | null }}
 */
export function evaluarPermisoTeoria(accion, contexto) {
  const ctx = contexto && typeof contexto === "object" ? contexto : {};
  const { actor, target, planEstado, esUrgenciaOperativa, periodo } = ctx;
  const esRrhh = esRrhhOperativo(actor);

  switch (accion) {
    case CANALES_TEORIA.APROBAR_PLAN:
    case CANALES_TEORIA.REVERTIR_PLAN:
    case CANALES_TEORIA.CERRAR_PERIODO:
    case CANALES_TEORIA.CIERRE_PERIODO:
      if (esRrhh) return { permitido: true, motivoRechazo: null };
      return { permitido: false, motivoRechazo: MOTIVOS_RECHAZO_TEORIA.SOLO_RRHH };

    case CANALES_TEORIA.GUARDAR_PLAN:
    case CANALES_TEORIA.ENVIAR_PLAN:
      if (esRrhh || actor?.esJefe === true) {
        return { permitido: true, motivoRechazo: null };
      }
      return {
        permitido: false,
        motivoRechazo: MOTIVOS_RECHAZO_TEORIA.SOLO_JEFE_O_RRHH_PUEDE_EDITAR_PLAN,
      };

    case CANALES_TEORIA.OVERRIDE_DIA:
    case CANALES_TEORIA.APLICAR_BATCH:
    case CANALES_TEORIA.BATCH_DIA:
      if (target && actor?.id && actor.id === target.id) {
        return {
          permitido: false,
          motivoRechazo: MOTIVOS_RECHAZO_TEORIA.TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA,
        };
      }

      if (!esRrhh && planEstado === "HABILITADO" && esUrgenciaOperativa !== true) {
        return {
          permitido: false,
          motivoRechazo: MOTIVOS_RECHAZO_TEORIA.PLAN_HABILITADO_REQUIERE_URGENCIA,
        };
      }

      if (!esRrhh) {
        const nivelActor = actor?.nivelJerarquico ?? 0;
        const nivelTarget = target?.nivelJerarquico ?? 0;
        if (target && nivelActor <= nivelTarget) {
          return {
            permitido: false,
            motivoRechazo: MOTIVOS_RECHAZO_TEORIA.NO_ES_SUPERIOR_JERARQUICO,
          };
        }

        if (periodo && (periodo.cerrado === true || periodo.ventanaM1 === true)) {
          return { permitido: false, motivoRechazo: MOTIVOS_RECHAZO_TEORIA.PERIODO_CERRADO };
        }
      }

      return { permitido: true, motivoRechazo: null };

    default:
      return { permitido: false, motivoRechazo: MOTIVOS_RECHAZO_TEORIA.ACCION_DESCONOCIDA };
  }
}
