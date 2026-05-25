# Cuestión — «Ver versiones» por artículo (configurador RRHH)

**Fecha:** actualizado **16 de mayo de 2026**.  
**Estado:** **implementado** — listado visible en primera pantalla (grilla) + página opcional de listado por ruta + callable **`listarVersionesCfgArticulo`** (Admin) por **Rules/claims** que impedían contar/leer todas las versiones desde el cliente SDK.  
**Origen:** clon manual LAO 2023/2024 — la grilla solo mostraba `version_actual_id`; las versiones anteriores existían en Firestore pero «parecían desaparecer».

**Relación:** [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) §1.6–1.7, [`LAO_VERSIONES_RRHH_BACKLOG.md`](./LAO_VERSIONES_RRHH_BACKLOG.md), [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md).

---

## Problema

| Hoy | Efecto |
|-----|--------|
| Un `articulo_id`, N docs en `versiones/{ver_id}` | Correcto en datos |
| Grilla + **Gestionar** usan solo `version_actual_id` | Tras guardar 2023, 2024 «no se ve» sin URL manual |
| Clon = Generar `ver_*` + Guardar | Funciona pero RRHH no tiene inventario visible |

**Caso real (LAO):** `art_01KRNYDN5WR7RER7MWXRZ817E7` con `ver_01KRNYDP…` (2024) y `ver_01KRPPTZ86XK1GR4MNCJA804TE` (2023) — ambas en Firestore, confirmado.

---

## Objetivo de producto

**Habilitar «Ver versiones»** en cada artículo del configurador: listado de todas las versiones del artículo, con acceso directo a editar/abrir cada una **sin** confundir con «versión actual» del núcleo.

---

## Alcance MVP (propuesta)

### Entrada UI

- En [`ArticuloListadoGrilla.jsx`](../../web/src/pages/ArticuloListadoGrilla.jsx): botón o acción secundaria **«Ver versiones»** junto a **Gestionar** (por fila).
- Alternativa: dentro de [`ArticuloConfiguracion.jsx`](../../web/src/pages/ArticuloConfiguracion.jsx) — enlace fijo en cabecera del artículo.

### Pantalla / panel «Versiones del artículo»

Lectura de `cfg_articulos/{articuloId}/versiones` (query o `listar` existente si aplica).

| Columna | Fuente |
|---------|--------|
| `version_id` | id documento |
| Estado | `estado_version_id` → label catálogo |
| Versión semántica | `version_semantica` |
| Año fiscal (LAO) | `bloque_topes_plazos_computo.correspondencia_anio` si `es_lao_anual` |
| Publicada | `publicada_en` (opcional) |
| ¿Es actual? | chip si `version_id === version_actual_id` del núcleo |

### Acciones por fila

| Acción | Comportamiento |
|--------|----------------|
| **Abrir** | Navegar a configurador con `?versionId=ver_…` |
| *(fase 2)* **Duplicar como borrador** | Cargar datos en formulario + Generar `ver_*` (automatizar clon manual) |

### Reglas

- **No** borrar versiones desde UI (política sin borrado físico).
- **No** cambiar `version_actual_id` al solo listar/abrir.
- Orden sugerido: `correspondencia_anio` DESC (LAO) o `publicada_en` / id DESC.

---

## Fuera de alcance MVP

- Comparación diff entre dos versiones.
- Publicar/despublicar masivo.
- Historial de auditoría por campo.

---

## Criterios de aceptación

1. RRHH abre LAO y ve **al menos** 2023 y 2024 en la misma lista.
2. **Abrir** 2024 lleva a `correspondencia_anio = 2024` sin editar la 2023 por error.
3. La fila marcada como **actual** coincide con `version_actual_id` del documento núcleo.
4. Artículos no LAO listan versiones igual (sin columna año o con «—»).

---

## Implementación (mayo 2026)

| Pieza | Ubicación / nota |
|-------|------------------|
| Grilla primera pantalla | [`ArticuloListadoGrilla.jsx`](../../web/src/pages/ArticuloListadoGrilla.jsx) — tarjeta por artículo con mosaico de versiones, **«N en Firestore»**, **Refrescar listado**. |
| Listado opcional por URL | [`ArticuloVersionesListado.jsx`](../../web/src/pages/ArticuloVersionesListado.jsx) + ruta en `App.jsx`. |
| Servicio | [`articuloVersionesListService.js`](../../web/src/services/articuloVersionesListService.js) — `loadVersionesSubcoleccion` → callable. |
| Callable | `listarVersionesCfgArticulo` en [`catalogosCore.js`](../../functions/modules/catalogosCore.js); front [`callables.js`](../../web/src/services/callables.js). |
| Año fiscal en fila | `correspondencia_anio` desde `bloque_topes_plazos_computo` aunque falte `es_lao_anual` en documentos viejos (solo display/orden). |

**Handoff detallado:** [`HANDOFF_SESION_2026-05-16.md`](./HANDOFF_SESION_2026-05-16.md).

---

## Prioridad sugerida (histórico)

Cumplida para MVP de inventario visible; extensión futura: **Duplicar como borrador** desde listado (tabla arriba).
