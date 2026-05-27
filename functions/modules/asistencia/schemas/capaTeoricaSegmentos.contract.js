"use strict";

/**
 * Contrato JSDoc espejo de web/src/schemas/capaTeoricaSegmentos.schema.js
 * Functions no empaqueta Zod; validación runtime en web y gates en workers.
 *
 * @see docs/v2/CAPA_TEORICA_SEGMENTOS_V2.md
 */

/** @typedef {"plan_base"|"override_cobertura"|"licencia_ajuste"} OrigenSegmento */
/** @typedef {"laborable"|"franco"|"guardia"|"no_laborable"} TipoDiaOperativo */
/** @typedef {"salida_momentanea"} TipoExpectativaFichada */
/** @typedef {"egreso"|"ingreso"} PatronFichada */

/**
 * Tramo efectivo del día (SoT).
 * @typedef {object} SegmentoTurno
 * @property {string} segmento_id — Id en cfg_regimen_horario.turnos_disponibles
 * @property {string} ingreso_iso — ISO 8601 UTC
 * @property {string} egreso_iso — ISO 8601 UTC
 * @property {string} fecha_base — YYYY-MM-DD
 * @property {string} [fecha_fin_real] — YMD egreso si cruza medianoche
 * @property {boolean} [cruza_medianoche]
 * @property {string} persona_titular_id — per_*
 * @property {string} persona_ejecutante_id — per_*
 * @property {OrigenSegmento} origen_segmento
 * @property {string|null} [tipo_compensacion_id] — cfg_tcc_* si override_cobertura
 * @property {Record<string, unknown>|null} [flags_liquidacion]
 */

/**
 * Campos derivados desde segmentos[] (recalculables).
 * @typedef {object} ResumenOperativoDerivado
 * @property {string|null} ingreso_teorico_final
 * @property {string|null} egreso_teorico_final
 * @property {number} horas_teoricas_totales
 * @property {string|null} turno_compuesto_id
 * @property {boolean} tiene_huecos
 */

/**
 * @typedef {object} ExpectativaFichadaExtra
 * @property {TipoExpectativaFichada} tipo
 * @property {string} fecha_base — YYYY-MM-DD
 * @property {number} cantidad_fichadas_esperadas
 * @property {PatronFichada[]} patron_esperado
 * @property {string} [solicitud_id]
 * @property {string} [articulo_id]
 */

/**
 * Raíz capa_teorica en asistencia_diaria / vis_*.
 * @typedef {object} CapaTeoricaSegmentada
 * @property {string} fecha_base
 * @property {SegmentoTurno[]} segmentos
 * @property {string|null} ingreso_teorico_final
 * @property {string|null} egreso_teorico_final
 * @property {number} horas_teoricas_totales
 * @property {string|null} [turno_compuesto_id]
 * @property {boolean} tiene_huecos
 * @property {string} clasificacion_dia_calendario_id — cfg_cdc_*
 * @property {string|null} [calendario_evento_ref]
 * @property {number|null} [multiplicador_institucional]
 * @property {TipoDiaOperativo} tipo_dia
 * @property {boolean} [es_feriado]
 * @property {number} [version_capa_teorica]
 * @property {ExpectativaFichadaExtra[]} [expectativas_fichada_extra]
 * @property {number} [fichadas_esperadas]
 */

/**
 * Override cobertura parcial en overrides_turno[].
 * @typedef {object} CoberturaParcialOverride
 * @property {string} tipo_override_id — cfg_tov_*
 * @property {string} tipo_compensacion_id — cfg_tcc_*
 * @property {string} persona_origen_id
 * @property {string} persona_cobertura_id
 * @property {string[]} segmentos_cubiertos
 * @property {string} motivo
 * @property {true} [es_override_manual]
 */

/** @type {"v2.0.0-rfc-turnos-compuestos"} */
const CAPA_TEORICA_SEGMENTOS_CONTRACT_VERSION = "v2.0.0-rfc-turnos-compuestos";

module.exports = {
  CAPA_TEORICA_SEGMENTOS_CONTRACT_VERSION,
};
