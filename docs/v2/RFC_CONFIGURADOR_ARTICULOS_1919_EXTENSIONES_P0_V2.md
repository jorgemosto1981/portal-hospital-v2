# RFC — Extensiones configurador artículos (épica 1919, P0)

**Estado:** borrador para implementación **P5** (UI + schema + seed); **bloqueante** para wizard 63.j y cobertura decreto sin hardcode.  
**Regla de oro:** si una regla aparece en [`LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md`](./LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md), debe existir **campo o catálogo `cfg_*`** editable en [`ArticuloConfigTabs.jsx`](../../web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx) y validación en [`articulo.schema.js`](../../web/src/schemas/articulo.schema.js).

---

## 1. Ya en schema / parcialmente en UI

| Capacidad | Campo / catálogo | Gap UI |
|-----------|------------------|--------|
| Topes Patrón B | Bloque 4 (`cupo_*`, `tope_*`, `regla_computo_*_id`) | OK en pestaña Impacto y saldo |
| Elegibilidad | Bloque 3 `*_ids`, antigüedad | OK; usar filtros restrictivos por artículo |
| RDA | `depende_rda` | OK |
| Grilla | `nivel_ocupacion_dia_id`, `visualizacion.codigo_grilla` | OK |
| Plazos documentales | `cfg_tipo_computo_plazo` (`cfg_tcp_*`), bloque 7 | Exponer plazo **5 hábiles** post-licencia por artículo |
| Goce / SAC / presentismo | Bloque 2 | OK |

---

## 2. Extensiones nuevas (prioridad oleada 63)

### 2.1 Opciones de solicitud con consumo (63.j y similares)

**Problema:** un solo `art_*` duelo con tope 5; el agente elige **vínculo** en wizard; los **días** (5/3/2/1) deben venir de la **versión publicada**, no de código.

**Propuesta (producto-first):** subestructura en versión (Bloque 7 o Identidad), persistida en doc o subcolección según §1.7:

`opciones_consumo_solicitud[]` — cada fila:

| Campo | Tipo | Ejemplo 63.j |
|-------|------|----------------|
| `id` | string estable | `oc_63j_conyuge_hijos_padres` |
| `etiqueta_ui` | string | Cónyuge / conviviente, hijos, padres |
| `codigo_sarh` | string | alinear SARH |
| `dias_por_evento` | number | 5 |
| `regla_computo_id` | `cfg_rcd_*` opcional | `cfg_rcd_corridos` (default artículo si null) |
| `activo` | boolean | true |

**UI:** editor tabla en Avanzado (como futuro `variantes_sarh`).  
**Motor B:** lee `opcion_consumo_id` del payload solicitud → fija cantidad de días y cómputo.  
**Wizard:** desplegable generado desde versión (sin lista fija en JS).

**Alternativa rechazada para piloto:** cinco `art_*` duplicados (mantenimiento RRHH alto).

### 2.2 `variantes_sarh[]` en pantalla

Ya en [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) §4. **Falta UI** (plan C2). Para % haberes (Art. 14) y códigos SARH múltiples.

### 2.3 Ayuda versionada

`texto_ayuda_solicitante`, `texto_ayuda_jefe`, `checklist_documentacion[]` — RFC brecha #5; textos de fichas LINEAMIENTOS deben poder copiarse al ABM.

### 2.4 Catálogos `cfg_*` a sembrar si faltan

- Filas `cfg_regla_computo_dias`: `cfg_rcd_corridos`, `cfg_rcd_habiles_compuesto` (ya en seed propuesto).
- Tipos plazo documental para **5 hábiles post último día licencia**.

---

## 3. Fuera de configurador (motor / bandeja, no ABM)

| Tema | Decisión RRHH | Implementación |
|------|---------------|----------------|
| Superposición artículos | Manual bandeja P2 | Sin `articulos_incompatibles_ids` en P2 |
| Identificación concurso 63.k | Manual RRHH al aprobar | Sin `id_concurso` en schema hasta RFC |
| 63.a mesas examen | Fuera oleada | Backlog |

---

## 4. Criterio de aceptación RFC

- RRHH puede **alta/publicar** 63.j con tabla vínculo→días **solo** en configurador.
- Cambio normativo futuro = editar versión + republicar; **cero** deploy por inciso.
- Tests: motor B preview con `opcion_consumo_id` mock desde versión.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-24 | Borrador P0 tras acta RRHH Bloque E (63.c–k, duelo, regla de oro). |
