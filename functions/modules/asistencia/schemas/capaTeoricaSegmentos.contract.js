/** @typedef {object} SegmentoTeorico
 * @property {string} segmento_id
 * @property {string} ingreso_iso
 * @property {string} egreso_iso
 * @property {string} fecha_base
 * @property {string} persona_titular_id
 * @property {string} persona_ejecutante_id
 * @property {"plan_base"|"override_cobertura"|"licencia_ajuste"} origen_segmento
 */
/** Contrato espejo: web/src/schemas/capaTeoricaSegmentos.schema.js */
export const CAPA_TEORICA_SEGMENTOS_CONTRACT_VERSION = "v2.0.0-rfc-turnos-compuestos";