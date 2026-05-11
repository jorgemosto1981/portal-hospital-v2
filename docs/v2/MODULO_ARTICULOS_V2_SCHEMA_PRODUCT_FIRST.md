# Módulo Artículos V2 — Schema producto-first

**Propósito:** contrato canónico de datos para artículos (licencias y franquicias), enfocado en operación del hospital y con Decreto 1919/89 como referencia de validación normativa.

**Fecha:** 11 de mayo de 2026.  
**Estado:** borrador activo para implementación por fases.

**Documentos base relacionados:**
- [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)
- [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md)
- [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md)
- [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)

---

## 1. Decisiones de arquitectura (cerradas)

1. El diseño es **producto-first**: reglas operativas del hospital primero; decreto y normativa como trazabilidad/validación.
2. La entidad de artículo se separa en:
   - **identidad estable** (`cfg_articulos`)
   - **parámetros versionados** (`versiones` por artículo)
   - **relaciones entre artículos** (`cfg_articulo_relaciones`)
3. Sin strings mágicos: comportamiento gobernado por `*_id` hacia `cfg_*`.
4. Sin borrado físico en catálogos: `activo` + vigencias.
5. La solicitud de negocio siempre referencia:
   - `articulo_id`
   - `version_id_aplicada`

---

## 2. Colecciones finales del módulo

### 2.1 Núcleo de definición

- **Colección:** `cfg_articulos`
- **Id documento:** `art_<ULID>`
- **Rol:** identidad y metadatos estables del artículo.

Campos mínimos:
- `codigo`
- `inciso_normativo`
- `nombre`
- `descripcion`
- `origen_normativo_id`
- `es_lao_anual`
- `es_sancion`
- `es_inasistencia`
- `es_sin_goce`
- `requiere_dictamen`
- `activo`
- `vigente_desde`
- `vigente_hasta`
- `version_actual_id`

### 2.2 Versionado de parámetros

- **Subcolección:** `cfg_articulos/{articulo_id}/versiones/{ver_<ULID>}`
- **Rol:** snapshot parametrizable de comportamiento (7 bloques).

Campos estructurales:
- `version_semantica` (ej. `1.0.0`)
- `estado_version` (`BORRADOR|PUBLICADA|DESHABILITADA`)
- `publicada_en`
- `publicada_por_persona_id`
- `bloque_identidad_naturaleza`
- `bloque_impacto_economico`
- `bloque_elegibilidad_filtros`
- `bloque_topes_plazos_computo`
- `bloque_acumulacion_sucesion`
- `bloque_workflow_sla_cobertura`
- `bloque_documentacion_convivencia`

### 2.3 Relaciones entre artículos

- **Colección:** `cfg_articulo_relaciones`
- **Id documento:** `car_<ULID>`
- **Rol:** grafo normativo/operativo entre artículos.

Campos:
- `articulo_origen_id`
- `articulo_destino_id`
- `tipo_relacion_id` (`prorroga_de`, `incompatible_con`, `compatible_con`, `consume_de`)
- `condicion_relacion`
- `prioridad`
- `activo`
- `vigente_desde`
- `vigente_hasta`

### 2.4 Operación (solicitudes)

- **Colección de consumo operativo:** `solicitudes_articulo`
- **Id documento:** `sol_<ULID>`
- **Campos de anclaje al schema:**
  - `articulo_id`
  - `version_id_aplicada`
  - `estado_solicitud_id`
  - `paso_actual_workflow_id`

---

## 3. Catálogos `cfg_*` requeridos (enums y operadores)

### 3.1 Catálogos de semántica general

- `cfg_origen_normativo_articulo`
- `cfg_tipo_articulo`
- `cfg_unidad_medida_articulo`
- `cfg_tipo_relacion_articulo`
- `cfg_estado_version_articulo`

### 3.2 Catálogos de cómputo y límites

- `cfg_regla_computo_dias`
- `cfg_regla_computo_horas`
- `cfg_tipo_tope`
- `cfg_tipo_acumulacion`
- `cfg_tipo_fraccionamiento`
- `cfg_unidad_plazo`
- `cfg_operador_comparacion`

### 3.3 Catálogos de workflow/SLA/documentación

- `cfg_circuito_ingreso`
- `cfg_rol_aprobador`
- `cfg_estado_solicitud_articulo`
- `cfg_paso_workflow_articulo`
- `cfg_accion_vencimiento`
- `cfg_tipo_documentacion`
- `cfg_accion_incumplimiento_documental`

### 3.4 Catálogos de elegibilidad y convivencia

- `cfg_tipo_filtro_elegibilidad`
- `cfg_tipo_convivencia_articulo`
- `cfg_tipo_incompatibilidad_articulo`
- `cfg_tipo_evento` (filas `cfg_tev_art_<ULID>` para eventos del dominio)

---

## 4. Matriz de campos por bloque (schema mínimo)

## Bloque 1: Identidad y Naturaleza

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `codigo` | string | sí | - | RRHH |
| `inciso_normativo` | string | sí | - | RRHH / normativa |
| `nombre` | string | sí | - | RRHH |
| `normativa_habilitante.decreto` | string | no | `null` | normativa |
| `normativa_habilitante.resolucion` | string | no | `null` | normativa |
| `normativa_habilitante.interno_efector` | string | no | `null` | efector |
| `es_lao_anual` | boolean | sí | `false` | RRHH |
| `es_sancion` | boolean | sí | `false` | RRHH |
| `es_inasistencia` | boolean | sí | `false` | RRHH |
| `es_sin_goce` | boolean | sí | `false` | RRHH |
| `requiere_dictamen` | boolean | sí | `false` | RRHH / auditoría |

## Bloque 2: Impacto Económico y Carrera

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `justifica_sueldo_id` | string (`cfg_*`) | sí | `cfg_js_no` | RRHH |
| `suma_para_sac` | boolean | sí | `false` | RRHH |
| `afecta_presentismo` | boolean | sí | `false` | RRHH |
| `acumula_reparto_obra_social` | boolean | sí | `false` | RRHH |
| `invalida_reparto_obra_social` | boolean | sí | `false` | RRHH |
| `suma_antiguedad_lao` | boolean | sí | `false` | RRHH |

## Bloque 3: Elegibilidad y Filtros

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `filtros_personales[]` | array regla | no | `[]` | personas |
| `filtros_antiguedad[]` | array regla | no | `[]` | laboral |
| `filtros_hlc[]` | array regla | no | `[]` | `hlc_*` |
| `filtros_hlg[]` | array regla | no | `[]` | `hlg_*` |
| `requiere_declaracion_familiar` | boolean | sí | `false` | DDJJ |
| `edad_limite_familiar` | number | no | `null` | DDJJ |

Estructura de regla recomendada:
- `campo_objetivo`
- `operador_id`
- `valor`
- `unidad_id`
- `obligatorio`

## Bloque 4: Topes, Plazos y Cómputos

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `regla_computo_dias_id` | string (`cfg_*`) | sí | - | RRHH |
| `ambito_consumo_id` | string (`cfg_*`) | sí | - | RRHH |
| `topes[]` | array | no | `[]` | RRHH |
| `fraccionamiento_habilitado` | boolean | sí | `false` | RRHH |
| `intervalo_gracia_dias` | number | no | `0` | RRHH |
| `regla_computo_horas_id` | string (`cfg_*`) | no | `null` | RRHH |

## Bloque 5: Acumulación y Sucesión

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `caducidad_tipo_id` | string (`cfg_*`) | sí | - | RRHH |
| `caducidad_limite_meses` | number | no | `null` | RRHH |
| `permite_prorroga` | boolean | sí | `false` | RRHH |
| `prorroga_articulo_relacion_id` | string | no | `null` | relación artículos |

## Bloque 6: Workflow, SLA y Cobertura

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `ingreso_permitido_por_rol_ids[]` | array ids | sí | `[]` | RBAC |
| `plazo_preaviso_normativa_dias` | number | no | `null` | RRHH |
| `plazo_preaviso_interno_dias` | number | no | `null` | RRHH |
| `pasos_aprobacion[]` | array ids | sí | `[]` | workflow |
| `sla_por_paso[]` | array | no | `[]` | SLA |
| `logistica_aviso_habilitada` | boolean | sí | `false` | RRHH |
| `toma_conocimiento_limitada` | boolean | sí | `false` | RRHH |

## Bloque 7: Documentación y Convivencia

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `requiere_doc_previa` | boolean | sí | `false` | RRHH |
| `plazo_doc_previa_dias` | number | no | `null` | RRHH |
| `requiere_doc_posterior` | boolean | sí | `false` | RRHH |
| `plazo_doc_posterior_dias` | number | no | `null` | RRHH |
| `accion_incumplimiento_doc_id` | string (`cfg_*`) | sí | - | RRHH |
| `articulos_incompatibles_ids[]` | array ids | no | `[]` | RRHH |
| `articulos_compatibles_ids[]` | array ids | no | `[]` | RRHH |

---

## 5. Integración con módulos V2 (compatibilidad)

## Laboral (`hlc_*`, `hlg_*`, `efectores`, `grupos_de_trabajo`)
- Los filtros de elegibilidad deben consumir referencias existentes:
  - `efector_*_id`
  - `escalafon_id`
  - `agrupamiento_id`
  - `cargo_funcional_id`
  - `grupo_de_trabajo_id`
- No se duplica modelo laboral dentro de artículos; solo reglas de selección.

## RRHH / identidad (`personas`, `usuarios_cuenta`)
- Actor y titular siempre por `persona_id`.
- Alta delegada compatible con:
  - `titular_persona_id`
  - `actor_alta_persona_id`
  - `origen_alta_id`

## Ticket / solicitudes
- `solicitudes_articulo` mantiene separación con ticket transversal.
- El motor de estado consume `cfg_estado_solicitud_articulo` y `cfg_paso_workflow_articulo`.
- Eventos de artículos se registran en `cfg_tipo_evento` (prefijo `cfg_tev_art_`).

---

## 6. Secuencia de implementación recomendada

1. Seed de catálogos `cfg_*` base (operadores, tipos de filtro, estados, pasos).
2. Alta de `cfg_articulos` con identidad y una primera `versiones/{ver_id}`.
3. Habilitar `cfg_articulo_relaciones` para prórrogas/incompatibilidades.
4. Integrar `solicitudes_articulo` con `version_id_aplicada`.
5. Recién después activar reglas/funciones para evaluación automática.

---

## 7. Criterios de aceptación del schema

- Cada solicitud nueva puede reconstruir reglas por `version_id_aplicada`.
- No hay campos críticos con texto libre donde corresponda `*_id`.
- Relaciones entre artículos no requieren duplicar definiciones enteras.
- Filtros de elegibilidad consumen solo fuentes de verdad existentes (`personas`, `hlc_*`, `hlg_*`, `cfg_*`).
