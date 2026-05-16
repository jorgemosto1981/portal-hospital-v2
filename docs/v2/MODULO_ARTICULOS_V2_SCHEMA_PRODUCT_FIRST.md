# Módulo Artículos V2 — Schema producto-first

**Propósito:** contrato canónico de datos para artículos (licencias y franquicias), enfocado en operación del hospital y con Decreto 1919/89 como referencia de validación normativa.

**Fecha:** 11 de mayo de 2026.  
**Estado:** borrador activo para implementación por fases.

**Documentos base relacionados:**
- [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)
- [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md)
- [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md)
- [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)

**Antes de cambiar estructura de datos o desplegar triple capa:** [`PROTOCOLO_SEGURIDAD_REVERSION_ARTICULOS_V2.md`](./PROTOCOLO_SEGURIDAD_REVERSION_ARTICULOS_V2.md) (tag Git, export Firestore, rama aislada, rollback).

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

### 1.6 Semáforo de estados (jerarquía cerrada)

Separar **`activo`** (borrado técnico), **`estado_articulo_id`** (disponibilidad operativa en portal) y **`estado_version_id`** (ciclo de edición/publicación de la versión) evita bloqueos cuando RRHH mantiene definiciones: cada eje se actualiza sin pisar a los otros.

- En la **raíz** `cfg_articulos`: `activo` (boolean) = **borrado lógico** únicamente.
- En la **raíz** `cfg_articulos`: `estado_articulo_id` → `cfg_estado_articulo` = **disponibilidad en el portal** (p. ej. `VIGENTE`, `OBSOLETO`); no reemplaza a `activo`.
- En **`versiones/{ver_id}`**: ciclo de vida de **edición/publicación** mediante `estado_version_id` → `cfg_estado_version_articulo` (valores cerrados: `BORRADOR`, `PUBLICADA`).

**Lectura de los tres ejes:** `activo` responde **¿sigue existiendo el registro técnico?**; `estado_articulo_id` responde **¿se puede usar hoy en el portal / nuevas solicitudes?**; `estado_version_id` responde **¿esta definición está en borrador o publicada?** (quién/edición sin confundir con vigencia operativa).

**Caso operativo:** un artículo puede seguir **legal o históricamente válido** para licencias ya otorgadas, pero marcarse **`OBSOLETO`** en portal porque fue reemplazado por otra definición: las solicitudes antiguas conservan `version_id_aplicada` y no se invalidan; las nuevas no deben tomar el código obsoleto como destino por defecto.

### 1.7 Matriz lógica vs persistencia (`versiones` y subcolecciones)

La **§4** describe el **contrato de producto** (qué datos existen y qué significan). En **Firestore**, los campos de la matriz anotados como **arrays de tamaño arbitrario** —en particular en **Bloque 3** (`filtros_*[]`) y **Bloque 6** (`ingreso_permitido_por_rol_ids[]`, `pasos_aprobacion[]`, `sla_por_paso[]`)— **no** deben persistirse como arrays grandes en el documento principal de `versiones/{ver_id}`.

- Esas colecciones lógicas viven en **subcolecciones** bajo `cfg_articulos/{articulo_id}/versiones/{ver_id}/…` (nombres de ruta y documentos hijos se fijan en implementación: `web/.../articulo.schema.js`, reglas e índices).
- El documento `versiones` conserva **metadatos de versión** (`estado_version_id`, `publicada_*`, etc.) y objetos `bloque_*` **acotados** (scalars, flags, objetos embebidos pequeños). Donde la UI necesite “el array”, el cliente o la Function **ensambla** la vista leyendo doc + subcolecciones.
- **Bloque 4** `topes[]`: misma regla si el volumen crece; si el equipo acota N fijo pequeño, puede documentarse excepción explícita en el schema de implementación.
- **Bloque 7** `articulos_incompatibles_ids[]` / `articulos_compatibles_ids[]`: la **fuente de verdad** normativa sigue siendo el **grafo** `cfg_articulo_relaciones`; listas en versión son solo materialización opcional o entradas en subcolección, no sustituto del grafo.

**Escudo — por qué no arrays monolíticos en el documento de versión:**

- **Límite de tamaño (Firestore):** un documento tiene techo práctico (~1 MiB). Muchos filtros (escalafones, roles, pasos) en un solo array **rompe** el modelo; las subcolecciones reparten el crecimiento en documentos hijos acotados.
- **Costos y rendimiento de lectura:** al listar artículos o versiones no hace falta traer todo el detalle de elegibilidad ni workflow; esas subcolecciones se leen **solo** al editar o al evaluar reglas cuando el flujo lo requiere, reduciendo lecturas innecesarias.

### 1.8 Motor de saldos y cómputo (Bloques 4 y 5 — decisión autónoma)

Los campos `reinicio_ciclo_id`, `accion_saldo_id`, `origen_saldo_id`, `depende_rda` y `meses_arrastre` (p. ej. Art. 70 bis) permiten que una **Cloud Function** (o proceso batch) resuelva saldos y cadencias **sin ramas hardcodeadas** por artículo: la semántica vive en `cfg_*` y en la versión publicada.

**Plan de ahorro de lecturas / CPU:** `origen_saldo_id` indica **de qué “bolsa”** proviene el saldo (interno vs externo informado vs externo calculado — p. ej. compensatorios Art. 68 vs LAO Art. 40). El motor **despacha** a la fuente correcta en lugar de recorrer indiscriminadamente todo el historial laboral del agente.

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
- `es_sancion`
- `es_inasistencia`
- `es_sin_goce`
- `requiere_dictamen`
- `activo` (borrado lógico; si `false`, el artículo no debe usarse en operación)
- `estado_articulo_id` (disponibilidad en portal: `cfg_estado_articulo`, p. ej. `VIGENTE` / `OBSOLETO`)
- `vigente_desde`
- `vigente_hasta`
- `version_actual_id`

**Nota (Paso 0 LAO):** `es_lao_anual` **no** vive en la raíz del núcleo; la fuente de verdad es `bloque_identidad_naturaleza.es_lao_anual` en el documento de **versión** apuntado por `version_actual_id` (listados: resolver vía versión o callable).

### 2.2 Versionado de parámetros

- **Subcolección:** `cfg_articulos/{articulo_id}/versiones/{ver_<ULID>}`
- **Rol:** snapshot parametrizable de comportamiento (7 bloques), más **subcolecciones hijas** para listas largas según **§1.7**.

Campos estructurales:
- `version_semantica` (ej. `1.0.0`)
- `estado_version_id` → `cfg_estado_version_articulo` (ciclo de edición/publicación; valores cerrados: `BORRADOR`, `PUBLICADA`)
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

### 2.5 Arquitectura de datos: triple capa (lectura optimizada)

**Restricción de producto:** el bajo costo en Firebase (plan Blaze) **no es opcional**; es requisito de arquitectura. Queda **prohibido** calcular saldos o agregar historial de solicitudes en el **cliente** para pantallas operativas.

El sistema se apoya en **tres capas** de documentos (patrón *read-optimized snapshots*):

| Capa | Colección / patrón de documento | Rol | Lectura típica |
|------|-----------------------------------|-----|------------------|
| **Operativa** | `solicitudes_articulo` / `sol_<ULID>` | Cada licencia o trámite; verdad de detalle por solicitud | Por **ID** al abrir un trámite o auditar una fila |
| **Contable** | Colección dedicada de **saldos agregados** (nombre de implementación a fijar, p. ej. `saldos_articulo_agente`): **un documento por `(persona_id, año_calendario)`**, id estable p. ej. `sal_<YYYY>_per_<ULID>` | Fuente de verdad para **topes y consumos** del año; se actualiza en **servidor** | Validación de cupos sin barrer `solicitudes_articulo` |
| **Vista (gestión)** | Colección dedicada de **vista mensual** (p. ej. `vistas_grilla_mes_agente`): **un documento por `(persona_id, año, mes)`**, id p. ej. `vis_<YYYY>_<MM>_per_<ULID>` | Mapa del mes (RDA + licencias aplicadas + proyección de saldo según diseño); pensado para **grillas** | **Una lectura por persona y mes** visible |

**Objetivo de lecturas (grilla):** para un grupo de **20** agentes en un mismo mes, la carga de la grilla operativa debe ser del orden de **20 lecturas** de documentos de la **capa Vista** (más un margen acotado de metadatos si aplica); **techo duro: ≤ 25 lecturas** Firestore para ese escenario bajo contrato de implementación (incluye p. ej. un doc de contexto de grupo o mes, si se modela explícitamente).

**Escritura en cadena:** toda mutación relevante en `solicitudes_articulo` debe disparar (vía **Cloud Functions**, triggers o flujos transaccionales) la actualización **atómica** del documento de **Saldos** y del de **Vista mensual** afectados, de modo que el cliente **no** recompute saldos leyendo historial.

**Bloqueo por RDA:** si `depende_rda` exige diagrama para el periodo, la validación debe **fallar en servidor antes** de escrituras costosas o de cascadas innecesarias cuando no exista plantilla RDA para ese periodo (criterio alineado a §4 Bloque 4).

### 2.6 Inmutabilidad de versiones y ancla temporal

- Los cambios en parámetros publicados de un artículo **no** recalculan solicitudes pasadas: solo afectan **solicitudes nuevas** (ancla: `version_id_aplicada` + reglas según `createdAt` / instante de creación acordado).
- Una versión **PUBLICADA** es **inmutable** en su contenido normativo; un cambio normativo implica **nueva** fila en `versiones` (o nuevo `art_*` si el producto lo exige), con vigencia futura. Esto evita jobs masivos de recálculo de saldos históricos.

### 2.7 Almacenamiento frío y auditoría (≥ 24 meses)

- Datos de licencias con **antigüedad ≥ 24 meses** se consideran **históricos** para operación diaria.
- Debe preverse **exportación** a almacén analítico (p. ej. **BigQuery**) para auditorías masivas a costo controlado y, según política institucional, **purga o compresión** en Firestore para mantener la base ágil (detalle de job y retención en RFC de operaciones).

---

## 3. Catálogos `cfg_*` requeridos (enums y operadores)

### 3.1 Catálogos de semántica general

- `cfg_origen_normativo_articulo`
- `cfg_tipo_articulo`
- `cfg_unidad_medida_articulo`
- `cfg_tipo_relacion_articulo`
- `cfg_estado_version_articulo` (filas mínimas: `BORRADOR`, `PUBLICADA`)
- `cfg_estado_articulo` (disponibilidad en portal; filas mínimas: `VIGENTE`, `OBSOLETO`)

### 3.2 Catálogos de cómputo y límites

- `cfg_regla_computo_dias`
- `cfg_regla_computo_horas`
- `cfg_tipo_tope`
- `cfg_tipo_acumulacion`
- `cfg_tipo_caducidad` (FK `caducidad_tipo_id` — política de vencimiento de bolsa; separado de acumulación)
- `cfg_tipo_fraccionamiento`
- `cfg_unidad_plazo`
- `cfg_operador_comparacion`
- `cfg_reinicio_ciclo_cuota` (p. ej. reinicio anual/mensual/diario/nunca)
- `cfg_accion_saldo` (p. ej. descuenta bolsa vs acumula uso)
- `cfg_origen_saldo` (interno vs externo informado vs externo calculado)

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
- `cfg_nivel_ocupacion_dia` (ocupación de celda en grilla / convivencia intradía; distinto de incompatibilidades normativas entre artículos)
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
| `visualizacion.codigo_grilla` | string | no | `null` | RRHH (código corto en celda mensual, p. ej. 14-0, 70-bis) |
| `visualizacion.color_ui` | string (hex) | no | `null` | RRHH / UI (fondo de celda; validar en cliente) |

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

*Nota §1.7: los `filtros_*[]` son contrato lógico; en Firestore → subcolecciones bajo la versión, no array en el doc principal.*

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
| `reinicio_ciclo_id` | string (`cfg_*`) | sí | - | RRHH (`cfg_reinicio_ciclo_cuota`) |
| `depende_rda` | boolean | sí | `false` | producto (si true, bloquear solicitud sin RDA cargado para el periodo) |
| `accion_saldo_id` | string (`cfg_*`) | sí | - | RRHH (`cfg_accion_saldo`) |
| `origen_saldo_id` | string (`cfg_*`) | sí | - | RRHH (`cfg_origen_saldo`) |
| `cupo_dias_por_ciclo` | number (entero >= 0) | no | `null` | RRHH (cupo fijo para artículos no-LAO; en LAO el cupo sale de `matriz_antiguedad_reglas`) |
| `tope_frecuencia_mensual` | number (entero >= 0) | no | `null` | RRHH (máximo de solicitudes aprobables en un mes calendario) |
| `tope_dias_por_evento` | number (entero >= 0) | no | `null` | RRHH (máximo de días que se pueden pedir en una sola solicitud) |
| `correspondencia_anio` | number (entero) | no | `null` | RRHH (LAO: año fiscal del derecho; invariante con `anio_origen` de bolsas) |
| `fecha_corte_antiguedad` | string (ISO fecha) | no | `null` | RRHH (LAO: corte antigüedad; `null` → default `obtenerFechaCorteLao`) |
| `matriz_antiguedad_reglas[]` | array filas | no | `null` | RRHH (LAO: escala acotada; excepción §1.7; `operador_id` → `cfg_operador_comparacion`, `valor_anos`, `dias_otorgados`; motor = último escalón que cumple) |

### 4.0 Semántica: Ámbito de consumo, cupos y frecuencia

**`ambito_consumo_id`** define la **ventana temporal** donde se mide el consumo de días para aplicar topes. No se refiere al "quién" (agente/servicio) sino al "cuándo" (período de cómputo):

- **Año calendario** (`cfg_ac_anio_calendario`): el contador se reinicia el 1 de enero. Ej: licencias por trámites (Art. 55 Ley 8525).
- **Año laboral / ciclo institucional** (`cfg_ac_anio_laboral`): el contador sigue una fecha de corte que no coincide con el año civil. Ej: LAO (Art. 40).
- **Mes corriente** (`cfg_ac_mes_corriente`): solo cuenta lo usado en el mes en curso. Ej: permisos con tope mensual.

**Motor de validación (Fase 7)** — pseudocódigo de evaluación:

1. Determinar **cupo**: si `es_lao_anual` = true, calcular desde `matriz_antiguedad_reglas`; si no, usar `cupo_dias_por_ciclo`.
2. Sumar días consumidos del agente en la ventana definida por `ambito_consumo_id`.
3. Si `dias_consumidos + dias_solicitados > cupo` -> RECHAZAR.
4. Si `tope_frecuencia_mensual` definido: contar solicitudes aprobadas en el mes actual; si `count >= tope_frecuencia_mensual` -> RECHAZAR.
5. Si `tope_dias_por_evento` definido: si `dias_solicitados > tope_dias_por_evento` -> RECHAZAR.

**Ejemplo Art. 64a**: `ambito_consumo_id` = año calendario, `cupo_dias_por_ciclo` = 6, `tope_frecuencia_mensual` = 1, `tope_dias_por_evento` = 1.

### 4.1 LAO (Art. 40) — bifurcación Stock / Proporcional, bolsa y zona horaria

- **Invariante bolsa ↔ versión:** al generar una bolsa en `saldos_articulo_agente`, `anio_origen` debe ser **igual** a `correspondencia_anio` de la **versión** que originó el saldo (auditoría).
- **Año de solicitud:** extraído de `fecha_desde` de la solicitud en zona **`America/Argentina/Buenos_Aires`** (no depender de UTC silencioso del servidor).
- **Regla (misma bolsa):** comparar año de solicitud con `anio_origen` de la bolsa consumida:

| Relación | Camino | Lógica |
|----------|--------|--------|
| Año solicitud **>** `anio_origen` | **Stock** | Consumo de saldo cerrado; sin guardas 01/07 ni proporcional. |
| Año solicitud **==** `anio_origen` | **Proporcional** | Guardas 01/07 + TSE ≥ 6 meses; cupo con `floor` según matriz y meses trabajados. |
| Año solicitud **<** `anio_origen` | **Error** | No consumir “vacaciones del futuro” contra esa bolsa. |

- **Gating configuración:** si `bloque_identidad_naturaleza.es_lao_anual !== true`, los tres campos LAO del Bloque 4 se persisten en **`null`** (servicio guardián).

## Bloque 5: Acumulación y Sucesión

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `caducidad_tipo_id` | string (`cfg_cad_*` → `cfg_tipo_caducidad`) | sí | - | RRHH |
| `caducidad_limite_meses` | number | no | `null` | RRHH |
| `permite_prorroga` | boolean | sí | `false` | RRHH |
| `prorroga_articulo_relacion_id` | string | no | `null` | relación artículos |
| `meses_arrastre` | number (entero ≥ 0) | no | `0` | RRHH (ventana rolling post mes de origen; p. ej. Art. 70 bis = `1`) |

## Bloque 6: Workflow, SLA y Cobertura

*Nota §1.7: `ingreso_permitido_por_rol_ids[]`, `pasos_aprobacion[]` y `sla_por_paso[]` son contrato lógico; en Firestore → subcolecciones bajo la versión.*

| Campo | Tipo | Obligatorio | Default | Fuente |
|---|---|---|---|---|
| `ingreso_permitido_por_rol_ids[]` | array ids | sí | `[]` | RBAC |
| `plazo_preaviso_normativa_dias` | number | no | `null` | RRHH |
| `plazo_preaviso_interno_dias` | number | no | `null` | RRHH |
| `pasos_aprobacion[]` | array ids | sí | `[]` | workflow |
| `sla_por_paso[]` | array | no | `[]` | SLA |
| `logistica_aviso_habilitada` | boolean | sí | `false` | RRHH |
| `toma_conocimiento_limitada` | boolean | sí | `false` | RRHH |
| `niveles_burbujeo` | number (entero ≥ 1) | no | `null` | RRHH |

### Semántica operativa — campos de cobertura y burbujeo

**`logistica_aviso_habilitada`** — Identifica artículos que generan necesidad de cobertura de puesto. Cuando está activo, el sistema señaliza que al aprobarse una solicitud de este tipo debe gestionarse un aviso de reemplazo o contratación de personal suplente (ej. Art. 16-0 Tareas Diferentes Definitivas, licencias prolongadas). No dispara el reemplazo por sí solo; el módulo de Reemplazos/Contrataciones (Escenario 8, backlog) consumirá esta señal para orquestar el flujo. Campos futuros relacionados: `admite_reemplazo`, `dispara_evento_contrataciones`.

**`toma_conocimiento_limitada`** — Controla el alcance del burbujeo de la notificación de acuse ("toma de conocimiento") tras la aprobación de una solicitud. Si es `false`, el acuse escala por toda la cadena jerárquica de grupos de trabajo (del grupo del agente hasta la dirección). Si es `true`, el burbujeo se corta según `niveles_burbujeo`.

**`niveles_burbujeo`** — Solo relevante cuando `toma_conocimiento_limitada = true`. Define cuántos niveles de grupos de trabajo hacia arriba (vía `grupos_de_trabajo` padre) reciben la notificación de toma de conocimiento. Ejemplo: `niveles_burbujeo = 2` significa que solo el grupo inmediato y su padre reciben el acuse; la dirección general no se entera a menos que esté dentro de esos 2 niveles. La Cloud Function de burbujeo usará este valor como tope de su bucle/recursión sobre `hlg_*.nivel_jerarquico`. **Estado actual:** UI-only (campo en formulario, no persistido en Firestore aún); se incorporará al schema Zod y al backend cuando se implemente el módulo de Tomas de Conocimiento.

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
| `nivel_ocupacion_dia_id` | string (`cfg_*`) | sí | - | RRHH (`cfg_nivel_ocupacion_dia`: exclusivo 24h vs parcial por franja vs nulo informativo; **no** sustituye listas de incompatibilidad normativa) |

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
5. Modelar **capa Saldos** y **capa Vista** (**§2.5**), reglas Firestore y **Cloud Functions** (triggers en cadena solicitud → saldo → vista mensual).
6. Cumplimiento de **§8** (presupuesto de lecturas, bloqueo RDA, inmutabilidad).
7. Recién después activar reglas/funciones para evaluación automática ampliada y, en fase posterior, **§2.7** (export frío / BigQuery).

---

## 7. Criterios de aceptación del schema

- Cada solicitud nueva puede reconstruir reglas por `version_id_aplicada`.
- No hay campos críticos con texto libre donde corresponda `*_id`.
- Relaciones entre artículos no requieren duplicar definiciones enteras.
- Filtros de elegibilidad consumen solo fuentes de verdad existentes (`personas`, `hlc_*`, `hlg_*`, `cfg_*`).
- La convivencia **intradía** en grilla se gobierna con `nivel_ocupacion_dia_id`; las incompatibilidades **normativas** siguen en `articulos_incompatibles_ids[]` / grafo `cfg_articulo_relaciones`.
- Listas de §4 marcadas con `[]` en Bloques 3 y 6 cumplen **§1.7** al persistirse (subcolecciones, no arrays monolíticos en el documento `versiones`).
- La grilla operativa y la validación de topes cumplen **§2.5** (triple capa) y **§8** (presupuesto de lecturas, saldos sin barrido histórico, servidor para cómputo).

---

## 8. Restricciones técnicas mandatorias (costo y performance, Firebase Blaze)

1. **Lecturas de grilla:** la carga de la grilla operativa de **N** personas en un mes debe usar la **capa Vista** (**§2.5**); objetivo **N** lecturas, techo **≤ 25** para **N = 20** (incluye margen contractual acotado).
2. **Saldos:** **prohibido** obtener saldos leyendo el historial completo de `solicitudes_articulo`; la fuente de validación es el documento **agregado anual** por agente (**§2.5**), mantenido por **Cloud Functions**.
3. **RDA:** si el artículo depende de RDA, **validación preventiva en servidor** antes de aceptar escrituras costosas o cascadas (**§2.5**).
4. **Inmutabilidad:** versiones publicadas **solo lectura**; cambios normativos → nueva versión con vigencia futura; **sin** recálculo masivo de saldos por cambios de parámetros (**§2.6**).
5. **Cómputo:** reglas de negocio pesadas y actualización de capas **Saldos** / **Vista** en **servidor** (Functions), no en el cliente.
6. **Panel «Mis saldos» (agente):** el remanente y la clasificación por estado de bolsa se entregan vía Callable agregador (`obtenerResumenSaldosAgente`); el cliente **no** recalcula saldos a partir de versiones cacheadas. Contrato: [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) §4 y §11 (enmienda explícita a interpretaciones previas de este §8).
