"use strict";

/**
 * Oleada A6 — eventos operativos por solicitud + mapa a cfg_tipo_evento (articulos).
 * @see docs/v2/RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md §9
 */

const TIPO_EVENTO_TICKET = Object.freeze({
  SOLICITUD_CREADA_REVISION_JEFE: "SOLICITUD_CREADA_REVISION_JEFE",
  ESTADO_CAMBIADO: "ESTADO_CAMBIADO",
  TOMA_CONOCIMIENTO_RRHH: "TOMA_CONOCIMIENTO_RRHH",
  /** Umbral EGAP art. 53.a — Art. 77-0 (bandeja alertas RRHH). */
  ALERTA_77_0_UMBRAL_EXCEDIDO: "ALERTA_77_0_UMBRAL_EXCEDIDO",
});

/** @type {Record<string, { codigo_interno: string, tipo_evento_id: string, accion_default: string }>} */
const TIPO_EVENTO_TICKET_CFG = Object.freeze({
  [TIPO_EVENTO_TICKET.SOLICITUD_CREADA_REVISION_JEFE]: {
    codigo_interno: "ART_SOLICITUD_CREADA",
    tipo_evento_id: "cfg_tev_art_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    accion_default: "patron_b_on_create_ok",
  },
  [TIPO_EVENTO_TICKET.ESTADO_CAMBIADO]: {
    codigo_interno: "ART_SOLICITUD_ESTADO_CAMBIADO",
    tipo_evento_id: "cfg_tev_art_01ARZ3NDEKTSV4RRFFQ69G5FB0",
    accion_default: "estado_cambiado",
  },
  [TIPO_EVENTO_TICKET.TOMA_CONOCIMIENTO_RRHH]: {
    codigo_interno: "ART_TOMA_CONOCIMIENTO_REGISTRADA",
    tipo_evento_id: "cfg_tev_art_01ARZ3NDEKTSV4RRFFQ69G5FB8",
    accion_default: "rrhh_toma_conocimiento",
  },
  [TIPO_EVENTO_TICKET.ALERTA_77_0_UMBRAL_EXCEDIDO]: {
    codigo_interno: "ART_ALERTA_77_0_UMBRAL_EXCEDIDO",
    tipo_evento_id: "cfg_tev_art_alerta_77_0_umbral",
    accion_default: "alerta_77_0_umbral",
  },
});

const TICKET_EVENTOS_SCHEMA_VERSION = "ticket_eventos_v1";

const ORIGEN_EVENTO = Object.freeze({
  TRIGGER: "TRIGGER",
  CALLABLE: "CALLABLE",
  SISTEMA: "SISTEMA",
});

module.exports = {
  TIPO_EVENTO_TICKET,
  TIPO_EVENTO_TICKET_CFG,
  TICKET_EVENTOS_SCHEMA_VERSION,
  ORIGEN_EVENTO,
};
