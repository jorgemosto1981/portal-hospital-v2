"use strict";

/**
 * US-13 Fase C — política permisos sobre capa teórica (motor puro, backend).
 * SSoT normativa: docs/v2/CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md (G1–G7).
 * Paridad con web/src/features/grilla/teoriaPermisosGso.js (G4: sin self-override, incluso RRHH).
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { tokenHasRrhhLaborAccess } = require("./laborProfile");

/** @typedef {'BORRADOR'|'EN_REVISION'|'ENVIADO'|'HABILITADO'} PlanEstadoTeoria */

const CANALES_TEORIA = {
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

const MOTIVOS_RECHAZO_TEORIA = {
  TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA: "TITULAR_NO_PUEDE_EDITAR_PROPIA_TEORIA",
  NO_ES_SUPERIOR_JERARQUICO: "NO_ES_SUPERIOR_JERARQUICO",
  PLAN_HABILITADO_REQUIERE_URGENCIA: "PLAN_HABILITADO_REQUIERE_URGENCIA",
  SOLO_JEFE_O_RRHH_PUEDE_EDITAR_PLAN: "SOLO_JEFE_O_RRHH_PUEDE_EDITAR_PLAN",
  PERIODO_CERRADO: "PERIODO_CERRADO",
  SOLO_RRHH: "SOLO_RRHH",
  ACCION_DESCONOCIDA: "ACCION_DESCONOCIDA",
};

/**
 * G3 — RRHH institucional unificado.
 * @param {{ esRrhh?: boolean, esRrhhLabor?: boolean, esRrhhAdmin?: boolean } | null | undefined} actor
 */
function esRrhhOperativo(actor) {
  if (!actor || typeof actor !== "object") return false;
  if (actor.esRrhh === true) return true;
  return actor.esRrhhLabor === true || actor.esRrhhAdmin === true;
}

/**
 * @param {string} accion
 * @param {object} contexto
 * @returns {{ permitido: boolean, motivoRechazo: string | null }}
 */
function evaluarPermisoTeoria(accion, contexto) {
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

/**
 * Actor de teoría desde token de callable + nivel ya resuelto en el GDT de la op (G2).
 * @param {import("firebase-functions/v2/https").DecodedIdToken | Record<string, unknown> | null | undefined} token
 * @param {{ nivelJerarquicoEnGrupo?: number | null }} [opts]
 */
function actorTeoriaDesdeAuthToken(token, opts = {}) {
  const t = token && typeof token === "object" ? token : {};
  const pid = typeof t.persona_id === "string" ? t.persona_id.trim() : "";
  const esRrhhLabor = tokenHasRrhhLaborAccess(t);
  const rawNivel = opts.nivelJerarquicoEnGrupo;
  const nivelJerarquico = Number.isFinite(Number(rawNivel)) ? Number(rawNivel) : null;
  return {
    id: pid || undefined,
    esJefe: t.tiene_subordinados === true,
    esRrhh: esRrhhLabor,
    esRrhhLabor,
    esRrhhAdmin: esRrhhLabor,
    nivelJerarquico: nivelJerarquico ?? 0,
  };
}

/**
 * @param {string | null | undefined} targetPersonaId
 * @param {{ nivelJerarquicoEnGrupo?: number | null }} [opts]
 */
function targetTeoriaDesdePersona(targetPersonaId, opts = {}) {
  const id = String(targetPersonaId || "").trim();
  const rawNivel = opts.nivelJerarquicoEnGrupo;
  const nivelJerarquico = Number.isFinite(Number(rawNivel)) ? Number(rawNivel) : null;
  return {
    id: id || undefined,
    nivelJerarquico: nivelJerarquico ?? 0,
  };
}

/**
 * Portero HTTP para overrides / batch (US-13). Niveles deben ser del `grupoTrabajoId` de la op.
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @param {{
 *   targetPersonaId: string;
 *   grupoTrabajoId?: string;
 *   actorNivelJerarquicoEnGrupo?: number | null;
 *   targetNivelJerarquicoEnGrupo?: number | null;
 *   esUrgenciaOperativa?: boolean;
 *   planEstado?: string | null;
 *   periodo?: { cerrado?: boolean; ventanaM1?: boolean } | null;
 * }} params
 */
function assertTeoriaOverrideAuth(request, params) {
  if (!request || !request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const p = params && typeof params === "object" ? params : {};
  const targetPersonaId = String(p.targetPersonaId || "").trim();
  if (!targetPersonaId) {
    throw new HttpsError("invalid-argument", "targetPersonaId requerido.");
  }

  const token = request.auth.token || {};
  const actor = actorTeoriaDesdeAuthToken(token, {
    nivelJerarquicoEnGrupo: p.actorNivelJerarquicoEnGrupo,
  });
  if (!actor.id) {
    throw new HttpsError("permission-denied", "Sin persona vinculada.");
  }

  const target = targetTeoriaDesdePersona(targetPersonaId, {
    nivelJerarquicoEnGrupo: p.targetNivelJerarquicoEnGrupo,
  });

  const resultado = evaluarPermisoTeoria(CANALES_TEORIA.OVERRIDE_DIA, {
    actor,
    target,
    planEstado: p.planEstado || "BORRADOR",
    esUrgenciaOperativa: p.esUrgenciaOperativa === true,
    periodo: p.periodo || null,
  });

  if (!resultado.permitido) {
    throw new HttpsError(
      "permission-denied",
      resultado.motivoRechazo || MOTIVOS_RECHAZO_TEORIA.ACCION_DESCONOCIDA,
    );
  }
}

/**
 * G6 — guardar / enviar plan mensual (solo jefe o RRHH).
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @param {{ planEstado?: string | null; accion: string }} params
 */
function assertPlanTeoriaAuth(request, params) {
  if (!request || !request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const p = params && typeof params === "object" ? params : {};
  const accion = String(p.accion || "").trim();
  if (!accion) {
    throw new HttpsError("invalid-argument", "accion de plan requerida.");
  }

  const actor = actorTeoriaDesdeAuthToken(request.auth.token || {});
  if (!actor.id) {
    throw new HttpsError("permission-denied", "Sin persona vinculada.");
  }

  const resultado = evaluarPermisoTeoria(accion, {
    actor,
    planEstado: p.planEstado || "BORRADOR",
  });

  if (!resultado.permitido) {
    throw new HttpsError(
      "permission-denied",
      resultado.motivoRechazo || MOTIVOS_RECHAZO_TEORIA.ACCION_DESCONOCIDA,
    );
  }
}

module.exports = {
  CANALES_TEORIA,
  MOTIVOS_RECHAZO_TEORIA,
  esRrhhOperativo,
  evaluarPermisoTeoria,
  actorTeoriaDesdeAuthToken,
  targetTeoriaDesdePersona,
  assertTeoriaOverrideAuth,
  assertPlanTeoriaAuth,
};
