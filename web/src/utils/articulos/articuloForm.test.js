import { describe, expect, it, vi } from 'vitest';
import {
  cfgArticuloBorradorSchema,
  cfgArticuloPublicableSchema,
} from '../../schemas/articulo.schema.js';
import { applyDuplicacionLimpia } from './articuloFormDuplicate.js';
import { createInitialArticuloFormState } from './articuloFormInitialState.js';
import {
  ARTICULO_TITULO_PREFIJO_COPIA,
  getNormalizedTitleForDuplicado,
} from './articuloFormNormalize.js';
import { createArticuloFormUpdate } from './articuloFormUpdate.js';
import {
  canPublishArticulo,
  isArticuloReadinessOk,
  parseArticuloBorrador,
  parseArticuloPublicable,
} from './articuloFormValidation.js';
import { mapCatalogoRowToOption } from './mapCatalogoRowToOption.js';

describe('getNormalizedTitleForDuplicado', () => {
  it('no duplica el prefijo si el título ya empieza con [COPIA]', () => {
    const t = '[COPIA] Enfermedad Corta';
    expect(getNormalizedTitleForDuplicado(t)).toBe(t);
  });

  it('añade prefijo si falta', () => {
    expect(getNormalizedTitleForDuplicado('Licencia')).toBe(
      `${ARTICULO_TITULO_PREFIJO_COPIA} Licencia`,
    );
  });

  it('usa título por defecto si viene vacío', () => {
    expect(getNormalizedTitleForDuplicado('')).toContain(
      ARTICULO_TITULO_PREFIJO_COPIA,
    );
    expect(getNormalizedTitleForDuplicado(null)).toContain(
      ARTICULO_TITULO_PREFIJO_COPIA,
    );
  });
});

describe('createInitialArticuloFormState', () => {
  it('cumple cfgArticuloBorradorSchema', () => {
    const state = createInitialArticuloFormState();
    const r = cfgArticuloBorradorSchema.safeParse(state);
    expect(r.success).toBe(true);
  });

  it('no cumple publicable sin tipo/unidad', () => {
    const state = createInitialArticuloFormState();
    expect(cfgArticuloPublicableSchema.safeParse(state).success).toBe(false);
  });
});

describe('articuloFormValidation — doble puerta', () => {
  it('canPublish exige borrador y publicable', () => {
    const borradorOk = {
      titulo: 'X',
      tipo_articulo_id: 'cfg_tipo_01',
      unidad_medida_id: 'cfg_um_01',
      variantes_sarh: [
        {
          codigo_sarh: 'A',
          etiqueta_ui: 'A',
          afecta_sueldo_porcentaje: 0,
          activo: true,
        },
      ],
      filtros_elegibilidad: {},
    };
    expect(parseArticuloBorrador(borradorOk).success).toBe(true);
    expect(parseArticuloPublicable(borradorOk).success).toBe(true);
    expect(canPublishArticulo(borradorOk)).toBe(true);
    expect(isArticuloReadinessOk(borradorOk)).toBe(true);
  });

  it('readiness falla sin variantes SARH activas', () => {
    const data = {
      titulo: 'X',
      tipo_articulo_id: 'cfg_tipo_01',
      unidad_medida_id: 'cfg_um_01',
      variantes_sarh: [
        {
          codigo_sarh: 'A',
          etiqueta_ui: 'A',
          afecta_sueldo_porcentaje: 0,
          activo: false,
        },
      ],
      filtros_elegibilidad: {},
    };
    expect(parseArticuloPublicable(data).success).toBe(false);
    expect(isArticuloReadinessOk(data)).toBe(false);
  });

  it('canPublish es false si borrador falla aunque publicable pase', () => {
    const malBorrador = {
      titulo: 'X',
      tipo_articulo_id: 'cfg_tipo_01',
      unidad_medida_id: 'cfg_um_01',
      variantes_sarh: [],
      filtros_elegibilidad: {},
    };
    expect(parseArticuloBorrador(malBorrador).success).toBe(false);
    expect(canPublishArticulo(malBorrador)).toBe(false);
  });
});

describe('applyDuplicacionLimpia', () => {
  it('limpia id, vigencia, activo y normaliza título', () => {
    const origen = {
      id: 'art_01ARANDOMULIDVALUEHERE123',
      titulo: 'Original',
      activo: true,
      vigente_desde: '2025-01-01',
      vigente_hasta: '2025-12-31',
      creado_en: {},
      variantes_sarh: [
        {
          codigo_sarh: 'Z',
          etiqueta_ui: 'Z',
          afecta_sueldo_porcentaje: 10,
          activo: true,
        },
      ],
      filtros_elegibilidad: {},
      metadata: { x: 1 },
    };
    const next = applyDuplicacionLimpia(origen, {
      personaId: 'per_01ULIDVALUEHERE123456',
    });
    expect(next.id).toBeUndefined();
    expect(next.titulo.startsWith(ARTICULO_TITULO_PREFIJO_COPIA)).toBe(true);
    expect(next.activo).toBe(false);
    expect(next.vigente_desde).toBeNull();
    expect(next.vigente_hasta).toBeNull();
    expect(next.creado_en).toBeUndefined();
    expect(next.actualizado_por_persona_id).toBe('per_01ULIDVALUEHERE123456');
    expect(next.version).toBe(1);
    expect(next.metadata).toEqual({ x: 1 });
  });
});

describe('mapCatalogoRowToOption', () => {
  it('prioriza nombre y cae a id', () => {
    expect(mapCatalogoRowToOption({ id: 'cfg_ta_01', nombre: 'Licencia' })).toEqual({
      value: 'cfg_ta_01',
      label: 'Licencia',
    });
    expect(mapCatalogoRowToOption({ id: 'x', titulo_ui: 'UI' })).toEqual({ value: 'x', label: 'UI' });
    expect(mapCatalogoRowToOption({})).toBe(null);
  });
});

describe('createArticuloFormUpdate', () => {
  it('rechaza variantes_sarh en field', () => {
    let state = createInitialArticuloFormState();
    const setData = vi.fn((fn) => {
      state = fn(state);
    });
    const update = createArticuloFormUpdate(setData);
    expect(() =>
      update.field('variantes_sarh', []),
    ).toThrow(/variante o update.section/);
  });

  it('actualiza variante por índice', () => {
    let state = createInitialArticuloFormState();
    const setData = (fn) => {
      state = fn(state);
    };
    const update = createArticuloFormUpdate(setData);
    update.variante(0, { codigo_sarh: 'Nuevo' });
    expect(state.variantes_sarh[0].codigo_sarh).toBe('Nuevo');
  });

  it('fusiona section filtros_elegibilidad', () => {
    let state = createInitialArticuloFormState();
    const setData = (fn) => {
      state = fn(state);
    };
    const update = createArticuloFormUpdate(setData);
    update.section('filtros_elegibilidad', { escalafon_ids: ['cfg_esc_1'] });
    expect(state.filtros_elegibilidad.escalafon_ids).toEqual(['cfg_esc_1']);
  });
});
