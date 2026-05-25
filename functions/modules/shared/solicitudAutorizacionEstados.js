"use strict";

/**
 * Máquina de estados TO-BE — Oleada A (autorización + toma de conocimiento).
 * AS-IS sigue en bandejas hasta A3/A4; este módulo documenta el contrato objetivo.
 *
 * @see docs/v2/RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md §5.1
 */

const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_APROBADA,
} = require("./solicitudesArticuloEstados");

/** Flujo normal: RRHH no usa `cfg_esa_en_revision_rrhh` como paso obligatorio. */
const TRANSICIONES_TO_BE = Object.freeze({
  /** Trigger Patrón B OK + MDC PROYECTAR_PENDIENTE */
  MOTOR_ALTA_OK: {
    desde: ESTADO_SOLICITUD_BORRADOR,
    hacia: ESTADO_SOLICITUD_EN_REVISION_JEFE,
    actor: "sistema",
    mdc: "PROYECTAR_PENDIENTE",
  },
  /** Autorizador jerárquico aprueba (revisor ∈ autorizadores_elegibles_ids) */
  JEFE_AUTORIZA: {
    desde: ESTADO_SOLICITUD_EN_REVISION_JEFE,
    hacia: ESTADO_SOLICITUD_APROBADA,
    actor: "autorizador_jerarquico",
    mdc: "CONSOLIDAR_APROBADO",
    notas: "Cierre sustantivo; no pasa por en_revision_rrhh.",
  },
  /** Autorizador jerárquico rechaza */
  JEFE_RECHAZA: {
    desde: ESTADO_SOLICITUD_EN_REVISION_JEFE,
    hacia: ESTADO_SOLICITUD_RECHAZADA,
    actor: "autorizador_jerarquico",
    mdc: "REVERTIR_PROYECCION",
  },
  /** RRHH sustituta (huérfana) aprueba desde en_revision_jefe */
  RRHH_SUSTITUTA_AUTORIZA: {
    desde: ESTADO_SOLICITUD_EN_REVISION_JEFE,
    hacia: ESTADO_SOLICITUD_APROBADA,
    actor: "rrhh_sustituta",
    mdc: "CONSOLIDAR_APROBADO",
    requiere: "autorizacion_rrhh_sustituta === true",
  },
  /**
   * Toma de conocimiento (A4): no cambia estado sustantivo.
   * Campos previstos: rrhh_toma_conocimiento_persona_id, rrhh_toma_conocimiento_en.
   */
  RRHH_TOMA_CONOCIMIENTO: {
    desde: ESTADO_SOLICITUD_APROBADA,
    hacia: ESTADO_SOLICITUD_APROBADA,
    actor: "rrhh_toma_conocimiento",
    mdc: null,
  },
});

module.exports = {
  TRANSICIONES_TO_BE,
};
