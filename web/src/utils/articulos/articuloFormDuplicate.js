import { getNormalizedTitleForDuplicado } from './articuloFormNormalize.js';

/**
 * Vuelve al estado de borrador documentos publicados o con flags (si existen en el payload).
 * No forma parte del schema Zod actual; se limpian por compatibilidad futura.
 */
const CLAVES_PUBLICACION_OPCIONALES = [
  'esta_publicado',
  'snapshot_vinculado',
  'snapshot_vinculado_id',
];

/**
 * Transforma el JSON de un artículo origen en estado de formulario para **nuevo** documento (sin persistir aún).
 *
 * @param {Record<string, unknown>} source — típicamente datos leídos de `cfg_articulos`.
 * @param {{ personaId?: string }} [opciones]
 * @returns {Record<string, unknown>}
 */
export function applyDuplicacionLimpia(source, opciones = {}) {
  const next = structuredClone(source ?? {});

  delete next.id;

  next.titulo = getNormalizedTitleForDuplicado(
    typeof next.titulo === 'string' ? next.titulo : '',
  );
  next.activo = false;
  next.vigente_desde = null;
  next.vigente_hasta = null;

  delete next.creado_en;
  delete next.actualizado_en;

  if (opciones.personaId != null && opciones.personaId !== '') {
    next.actualizado_por_persona_id = opciones.personaId;
  } else {
    delete next.actualizado_por_persona_id;
  }

  next.version = 1;

  for (const k of CLAVES_PUBLICACION_OPCIONALES) {
    delete next[k];
  }

  return next;
}
