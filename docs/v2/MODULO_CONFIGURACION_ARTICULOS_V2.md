# Módulo — Configuración de artículos (licencias, justificaciones, franquicias) — V2

**Propósito:** especificar el contrato funcional y de datos del **ABM de definición de artículos** y su relación con **solicitudes**, **ticketera**, **asistencia (MDC/RDA)**, **eventos RRHH** y normativa (Decreto 1919/89, SARH, Ley 8525), sin implementación en este documento.

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador** alineado al plan integral del módulo; las fuentes normativas PDF viven fuera del repo; la trazabilidad detallada va en [ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md).

**Relación:** cumple principios de `[MODULO_CONFIGURACION_V2.md](./MODULO_CONFIGURACION_V2.md)` (catálogos `cfg_*`, ids estables, sin strings mágicos de negocio en Firestore).

---

## 1. Alcance y principios

- **Hospital único**; la variación operativa se resuelve con **filtros de elegibilidad** sobre datos laborales (`hlc_*`, `hld_*`, `hlg_*`), no con reglas ad hoc por pantalla.
- **Ancla de persona:** `persona_id` (`per_<ULID>`); no usar DNI ni email como FK entre módulos salvo flujos Auth explícitos (ver reglas de proyecto).
- **Sin hardcoding:** todo comportamiento configurable referencia `***_id`** a colecciones `cfg_*`.
- **Pantalla de configuración:** rol **RRHH**, **solo escritorio** (no se diseña variante mobile para este ABM en esta fase).
- **Decreto → SARH:** relación **1:N** posible; ver sección 4 y [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md).

---

## 2. Jerarquía normativa (orden de lectura)

1. **Decreto 1919/89** — derechos, plazos, procedimientos, LAO, franquicias y justificaciones. Referencia documental: `[DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md)`. **Trazabilidad artículo a artículo (configurador + motor):** `[LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md](./LINEAMIENTOS_DECRETO_1919_89_POR_ARTICULO_V2.md)` bajo `[PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md](./PLAN_LINEAMIENTOS_DECRETO_1919_MOTOR_SOLICITUDES_V2.md)`. **Extensiones ABM épica 1919 (sin hardcode):** `[RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md](./RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md)`.
2. **SARH** — puente operativo norma ↔ código de ausencias (quién ingresa, N.L., convención, reemplazo, afectación sueldo). Un artículo normativo puede derivar en **varias filas/códigos SARH**.
3. **Ley 8525** — marco del personal; complemento para coherencia disciplinaria y procedimientos; no sustituye el detalle del decreto por licencia. Referencia: `[LEY_8525_1979_EGAP_SANTA_FE_V2.md](./LEY_8525_1979_EGAP_SANTA_FE_V2.md)`.

**Regla de producto:** toda regla configurable debe poder citar **referencia primaria** (decreto/SARH/ley) y **fragmento** (artículo, inciso o código SARH). Divergencias decreto vs práctica hospitalaria se documentan como **política institucional explícita** con vigencia, no como ramas en código.

---

## 3. Entidades principales

### 3.1 Definición operativa del artículo

- **Colección:** `cfg_articulos`
- **Id de documento:** `art_<ULID>`
- Documento **rico** (no es solo “un valor de catálogo”): parametriza workflow, elegibilidad, documentación, superposición, SLA, etc.

### 3.2 Solicitud / trámite

- **Colección:** `solicitudes_articulo`
- **Id:** `sol_<ULID>`
- Interfaz principal con ticketera y máquina de estados; conserva **snapshot mínimo** de definición aplicable (`version_aplicada`).

### 3.3 Catálogos del dominio

Inventario y prefijos: [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md).

---

## 4. Identidad normativa y SARH (1:N)

- Campo `**codigo_sarh`:** compatible con artículo de **código único**; puede convivir con variantes o actuar como código “principal” según política de datos acordada en inventario.
- `**variantes_sarh[]` (opcional):** cuando un mismo marco normativo/operativo mapea a **varias filas SARH** sin duplicar todo el artículo. Estructura obligatoria por elemento:
  `{ codigo_sarh, etiqueta_ui, afecta_sueldo_porcentaje, activo }`
- Si cambian **workflow**, **impacto** o reglas críticas no expresables en variantes: **nuevo** `art_<ULID>` y uso del flujo **Duplicar base** en configuración.

En solicitudes, cuando aplica elección operativa: `**sarh_variante_codigo`** (opcional), elegido por RRHH al resolver remanente o destino final; debe coincidir con un `codigo_sarh` **activo** entre las variantes del artículo aplicable.

---

## 5. Vigencia y versionado operativo

- Campos `**vigente_desde`**, `**vigente_hasta**` (admite `null`; `vigente_desde = null` = vigente desde origen según decisión de producto cerrada en plan).
- Campo `**activo**` (soft disable).
- Las solicitudes nuevas aplican la definición vigente al **momento de creación** según ventana y activación.

### 5.1 Ciclo de vida ABM (épica 1919 — regla de oro)

El configurador debe exponer **operaciones completas** sobre cada artículo/licencia del decreto, **sin borrado físico** de definiciones ni de solicitudes históricas. Toda regla de negocio sigue en `cfg_articulos` + `versiones` + catálogos `cfg_*`.


| Operación                        | Qué hace RRHH                                        | Persistencia                                                                                               | Efecto operativo                                                                                         |
| -------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Alta (crear)**                 | Nuevo `art_<ULID>` + primera versión en **borrador** | Núcleo + `versiones/{ver_*}`                                                                               | No visible en ticketera hasta **publicar** + ventana de vigencia                                         |
| **Modificar (desde fecha X)**    | Editar parámetros que cambian comportamiento         | **Nueva** versión publicada (o republicación con `vigente_desde` en versión/núcleo según política cerrada) | Solicitudes **nuevas** desde X usan `version_id` vigente; las ya creadas conservan `version_id_aplicada` |
| **Deshabilitar (desde fecha X)** | Fin de vida operativa del artículo en portal         | `activo = false` y/o `estado_articulo_id` → obsoleto + `**vigente_hasta = X`** (o equivalente acordado)    | No listado en hub; no nuevas solicitudes desde X; histórico y grilla pasada intactos                     |
| **Rehabilitar** (excepcional)    | Reapertura con nueva ventana                         | Actualizar vigencias + `activo` / estado                                                                   | Solo con acta RRHH; evitar reutilizar código obsoleto sin revisión                                       |


**Tres ejes (no mezclar):** ver `[MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md)` §1.6 — `activo` (técnico), `estado_articulo_id` (portal), `estado_version_id` (borrador/publicada).

**Versionado vs vigencia calendario:**

- **Publicar versión** = congelar snapshot de los 7 bloques para auditoría y motor.
- `**vigente_desde` / `vigente_hasta`** = cuándo el artículo (o la versión publicada, según implementación única acordada) aplica a **nuevas** altas de solicitud.
- **Modificar desde fecha X** = preferir **nueva versión publicada** con `vigente_desde = X` en lugar de editar silenciosamente la versión ya usada por solicitudes en curso.

**Prohibido:** eliminar documentos `cfg_articulos` o `versiones` con tráfico operativo; sustituir por deshabilitación fechada.

**UI objetivo** (`ArticuloConfigTabs` / listado RRHH): acciones explícitas **Crear artículo**, **Guardar borrador**, **Publicar versión**, **Nueva versión (vigente desde…)**, **Deshabilitar desde…**, **Duplicar base** (nuevo `art_*` normativo distinto). Detalle UX en §8.

**Gap implementación (jun-2026):** vigencias `vigente_desde`/`vigente_hasta` y flujo **Deshabilitar desde fecha** deben quedar **visibles y obligatorios** en pantalla antes de masificar altas 1919; ver `[RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md](./RFC_CONFIGURADOR_ARTICULOS_1919_EXTENSIONES_P0_V2.md)` §2.5.

### 5.2 LAO (Art. 40) — esquema actual sin cambio estructural

**Decisión épica 1919:** mantener el **modelo ya operativo** de LAO / Art. 40 del decreto: **un** `art_*` LAO, **múltiples versiones publicadas** en subcolección `versiones`, selección por `**correspondencia_anio`** y `**version_id**` en solicitud/check-in — **no** unificar LAO al patrón “un artículo = un inciso nuevo por año” ni sustituir versionado por solo `vigente_desde` en núcleo.


| Aspecto            | Esquema actual (conservar)                                                                                   | Referencia                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Identidad          | Un `art_*` (`LAO_ARTICULO_ID` operativo); `es_lao_anual` en **versión**                                      | `[ARTICULOS_BASICOS_OPERATIVOS_V2.md](./ARTICULOS_BASICOS_OPERATIVOS_V2.md)`                                                         |
| Versiones          | **Una versión publicada por año** de derecho (`correspondencia_anio`), aunque la matriz Art. 40 sea idéntica | `[LAO_VERSIONES_RRHH_BACKLOG.md](./LAO_VERSIONES_RRHH_BACKLOG.md)`                                                                   |
| Parámetros Art. 40 | `matriz_antiguedad_reglas[]`, `fecha_corte_antiguedad`, motor TSE/apertura en Bloque 4                       | `[MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md)` §4.1                                  |
| Patrón saldo       | **A** — `resolvePatronSaldo`, bolsas `sal_{A}_per_*`, `version_id_origen` en check-in                        | `[RFC_SALDOS_PATRONES_ABC_V2.md](./RFC_SALDOS_PATRONES_ABC_V2.md)`, `[RFC_LAO_CHECKIN_SALDOS_V2.md](./RFC_LAO_CHECKIN_SALDOS_V2.md)` |
| UI versiones       | Grilla/historial de versiones (no solo `version_actual_id`)                                                  | `[CUESTION_VER_VERSIONES_ARTICULO_V2.md](./CUESTION_VER_VERSIONES_ARTICULO_V2.md)`                                                   |


**ABM LAO dentro de §5.1:** RRHH sigue **creando/publicando versiones** por ejercicio, **sin borrar** versiones usadas en check-in o solicitudes; deshabilitación del **artículo LAO** completo sigue siendo excepcional (acta). Los artículos **Patrón B/C** nuevos (63.c–k, 64, 68…) usan el mismo contenedor `cfg_articulos` + `versiones`, pero **sin** mezclar campos LAO (`matriz_antiguedad_reglas`, `correspondencia_anio`) salvo `es_lao_anual === true`.

**Épica 1919:** extensiones de configurador (opciones duelo, vigencias genéricas) **no** refactorizan el cableado LAO v2 ni el contrato de check-in.

---

## 6. Documentación diferida y plazos

- **Ancla del temporizador:** el cómputo de días para entrega de documentación **inicia el día posterior al último día de la licencia** aprobada en la solicitud. No depende de acción de “reintegro” hasta que exista ese flujo explícito.
- **Vencimiento sin documentación (default institucional):** **solo alerta + evento RRHH**; sin rechazo automático salvo política explícita del artículo (`accion_vencimiento_documental_id`).
- `**plazo_documental_tipo_dias_id`** referencia `**cfg_tipo_computo_plazo**` (`cfg_tcp_<ULID>`), no valores libres en motor.

### 6.1 Hábil compuesto (cerrado)

**Filtro sustractivo:**

1. **Base:** días laborables del agente según **Asistencia/MDC** (RDA/plantilla: días en que el agente “debería” trabajar), obtenidos por **contrato entre módulos**, no recalculados en ticketera ni en esta pantalla.
2. **Resta:** fechas que coincidan con `**cfg_calendario_feriados_institucional`** (`cfg_cfi_<ULID>`) aplicables por `**alcance_efector_id**`.

**Regla conceptual:** el feriado institucional **anula** ese día como hábil para **plazos administrativos**, salvo **excepciones explícitas** documentadas en RFC.

En **aprobación parcial/split**, el ancla documental usa el **último día del tramo efectivamente aprobado** del artículo que exige documentación.

---

## 7. Estados, SLA, superposición y eventos (resumen)

- **Estados** de solicitud en catálogo `cfg_estado_solicitud_articulo`; transiciones solo por matriz acordada; responsables por tramo (jefe, auditoría, RRHH, sistema).
- **SLA y burbujeo:** por paso en `cfg_paso_workflow_articulo`; acciones en `cfg_accion_vencimiento`.
- **Superposición:** políticas en `cfg_politica_superposicion`; prioridad normativa en `cfg_prioridad_normativa`; **rango mixto incompatible:** **BLOQUEAR_TOTAL** por defecto (ajuste manual del rango antes de continuar).

**Eventos RRHH:** `modulo_origen = articulos`; tipos nuevos del dominio con prefijo de documento `**cfg_tev_art_<ULID>`** en la colección global `cfg_tipo_evento`. Contrato: `[PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md](./PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md)`.

**MVP de nueve `codigo_interno`:** listado canónico en [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md) (sección eventos).

**Mantenimiento de `cfg_articulos`:** eventos de configuración solo en **hitos** (publicar/activar, deshabilitar, duplicar base), no en cada borrador intermedio.

**Fuera de MVP:** recordatorios **proactivos** antes del vencimiento documental (evaluar fase v2.2 con job programado).

---

## 8. UX de pantalla (blueprint)

Tabs mínimos: General (incluye variantes SARH si hay 1:N), Elegibilidad, Plazos, Workflow y SLA, Superposición, Documentación, Impacto, Auditoría/rechazos; FAB glosario dual (RRHH vs IT).

**Barra de acciones ABM (obligatoria épica 1919):**


| Acción                        | RRHH                                               | Notas                                    |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------- |
| Guardar borrador              | Versión en `BORRADOR`                              | No afecta operación                      |
| Publicar versión              | `PUBLICADA` + `version_actual_id`                  | Snapshot para motor                      |
| Nueva versión (vigente desde) | Clonar bloques → editar → publicar con **fecha X** | Modificar sin romper solicitudes previas |
| Deshabilitar desde fecha      | `vigente_hasta` / obsoleto                         | No delete                                |
| Duplicar base                 | Nuevo `art_*`                                      | Otro inciso o política distinta          |
| Crear artículo                | Alta núcleo + primera versión                      | —                                        |


Detalle no normativo puede ampliarse en revisión UX sin cambiar contrato §5.1.

---

## 9. Documentos relacionados


| Documento                                                                                                                      | Contenido                            |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md)                                                           | Colecciones, prefijos, campos núcleo |
| [ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md)                             | Mapa fuentes y reglas                |
| [MATRIZ_ESCENARIOS_ARTICULOS_V2.md](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md)                                                       | Ocho escenarios → parámetros         |
| [BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md)                                       | Dependencias entre módulos           |
| [ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md) | Asistencia / MDC / RDA               |
| [CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md)               | Alta por jefe / delegación           |


---

## 10. No negociables (gate RFC)

Antes de cerrar implementación o contradecir estos puntos en otros documentos, revisar el plan maestro y el gate acordado: catálogo `**cfg_tipo_computo_plazo`**, calendario `**cfg_calendario_feriados_institucional**`, delegación de **francos/laborables del agente** a Asistencia/MDC, modelo **1:N SARH** (`variantes_sarh[]` vs artículo duplicado), **sin recordatorios proactivos** en MVP, **ABM completo con vigencias y deshabilitación fechada** (§5.1, sin borrado físico).