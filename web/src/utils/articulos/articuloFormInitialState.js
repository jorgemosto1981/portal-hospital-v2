/** Fila nueva al pulsar “Agregar variante” (strings no vacíos para Zod). */
export const VARIANTE_SARH_FILA_NUEVA = Object.freeze({
  codigo_sarh: 'Nuevo código SARH',
  etiqueta_ui: 'Etiqueta variante',
  afecta_sueldo_porcentaje: 0,
  activo: true,
});

/**
 * Estado inicial del formulario compatible con `cfgArticuloBorradorSchema` (semillas, sin strings vacíos en campos .min(1)).
 * @returns {Record<string, unknown>}
 */
export function createInitialArticuloFormState() {
  return {
    titulo: 'Nuevo Artículo',
    activo: false,
    vigente_desde: null,
    vigente_hasta: null,
    variantes_sarh: [
      {
        codigo_sarh: 'Código SARH',
        etiqueta_ui: 'Etiqueta variante',
        afecta_sueldo_porcentaje: 0,
        activo: true,
      },
    ],
    filtros_elegibilidad: {},
    reglas_elegibilidad_ampliada: {},
    reglas_cadencia: {},
    metadata: {},
  };
}
