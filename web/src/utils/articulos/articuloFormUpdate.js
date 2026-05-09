import {
  ARTICULO_FORM_FIELD_KEY_SET,
  ARTICULO_FORM_FORBIDDEN_FIELD_KEYS,
  ARTICULO_FORM_SECTION_KEY_SET,
} from './articuloFormKeys.js';

function assertFieldKey(key) {
  if (typeof key !== 'string') {
    throw new TypeError('update.field: la clave debe ser string');
  }
  if (ARTICULO_FORM_FORBIDDEN_FIELD_KEYS.has(key)) {
    throw new Error(
      `update.field: "${key}" está prohibido; usar update.variante o update.section según corresponda.`,
    );
  }
  if (!ARTICULO_FORM_FIELD_KEY_SET.has(key)) {
    throw new Error(`update.field: clave no permitida "${key}"`);
  }
}

function assertSectionKey(key) {
  if (typeof key !== 'string') {
    throw new TypeError('update.section: la clave debe ser string');
  }
  if (!ARTICULO_FORM_SECTION_KEY_SET.has(key)) {
    throw new Error(`update.section: clave no permitida "${key}"`);
  }
}

/**
 * Fábrica de actualizadores inmutables para el formulario cfg_articulos.
 *
 * @template T
 * @param {React.Dispatch<React.SetStateAction<T>> | ((updater: (prev: T) => T) => void)} setData
 * @returns {{
 *   field: (key: string, value: unknown) => void,
 *   section: (key: string, patch: Record<string, unknown>) => void,
 *   variante: (index: number, patch: Record<string, unknown>) => void,
 * }}
 */
export function createArticuloFormUpdate(setData) {
  return {
    field(key, value) {
      assertFieldKey(key);
      setData((prev) => ({ ...prev, [key]: value }));
    },

    section(key, patch) {
      assertSectionKey(key);
      if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new TypeError('update.section: patch debe ser un objeto plano');
      }
      setData((prev) => {
        const prevSection =
          prev[key] != null && typeof prev[key] === 'object' && !Array.isArray(prev[key])
            ? prev[key]
            : {};
        return {
          ...prev,
          [key]: { ...prevSection, ...patch },
        };
      });
    },

    variante(index, patch) {
      if (!Number.isInteger(index) || index < 0) {
        throw new RangeError('update.variante: index inválido');
      }
      if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new TypeError('update.variante: patch debe ser un objeto plano');
      }
      setData((prev) => {
        const variantes = Array.isArray(prev.variantes_sarh)
          ? [...prev.variantes_sarh]
          : [];
        if (index >= variantes.length) {
          throw new RangeError('update.variante: índice fuera de rango');
        }
        const actual = variantes[index];
        const base =
          actual != null && typeof actual === 'object' && !Array.isArray(actual)
            ? actual
            : {};
        variantes[index] = { ...base, ...patch };
        return { ...prev, variantes_sarh: variantes };
      });
    },
  };
}
