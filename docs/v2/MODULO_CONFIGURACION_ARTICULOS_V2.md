# Módulo — Configuración de artículos (licencias, justificaciones, franquicias) — V2

**Propósito:** especificar el contrato funcional y de datos del **ABM de definición de artículos** y su relación con **solicitudes**, **ticketera**, **asistencia (MDC/RDA)**, **eventos RRHH** y normativa (Decreto 1919/89, SARH, Ley 8525), sin implementación en este documento.

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador** alineado al plan integral del módulo; las fuentes normativas PDF viven fuera del repo; la trazabilidad detallada va en [ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md).

**Relación:** cumple principios de [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) (catálogos `cfg_*`, ids estables, sin strings mágicos de negocio en Firestore).

---

## 1. Alcance y principios

- **Hospital único**; la variación operativa se resuelve con **filtros de elegibilidad** sobre datos laborales (`hlc_*`, `hld_*`, `hlg_*`), no con reglas ad hoc por pantalla.
- **Ancla de persona:** `persona_id` (`per_<ULID>`); no usar DNI ni email como FK entre módulos salvo flujos Auth explícitos (ver reglas de proyecto).
- **Sin hardcoding:** todo comportamiento configurable referencia **`*_id`** a colecciones `cfg_*`.
- **Pantalla de configuración:** rol **RRHH**, **solo escritorio** (no se diseña variante mobile para este ABM en esta fase).
- **Decreto → SARH:** relación **1:N** posible; ver sección 4 y [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md).

---

## 2. Jerarquía normativa (orden de lectura)

1. **Decreto 1919/89** — derechos, plazos, procedimientos, LAO, franquicias y justificaciones. Referencia documental: [`DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md`](./DECRETO_1919_89_ANTIGUEDAD_Y_LAO_V2.md).
2. **SARH** — puente operativo norma ↔ código de ausencias (quién ingresa, N.L., convención, reemplazo, afectación sueldo). Un artículo normativo puede derivar en **varias filas/códigos SARH**.
3. **Ley 8525** — marco del personal; complemento para coherencia disciplinaria y procedimientos; no sustituye el detalle del decreto por licencia. Referencia: [`LEY_8525_1979_EGAP_SANTA_FE_V2.md`](./LEY_8525_1979_EGAP_SANTA_FE_V2.md).

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

- Campo **`codigo_sarh`:** compatible con artículo de **código único**; puede convivir con variantes o actuar como código “principal” según política de datos acordada en inventario.
- **`variantes_sarh[]` (opcional):** cuando un mismo marco normativo/operativo mapea a **varias filas SARH** sin duplicar todo el artículo. Estructura obligatoria por elemento:

  `{ codigo_sarh, etiqueta_ui, afecta_sueldo_porcentaje, activo }`

- Si cambian **workflow**, **impacto** o reglas críticas no expresables en variantes: **nuevo** `art_<ULID>` y uso del flujo **Duplicar base** en configuración.

En solicitudes, cuando aplica elección operativa: **`sarh_variante_codigo`** (opcional), elegido por RRHH al resolver remanente o destino final; debe coincidir con un `codigo_sarh` **activo** entre las variantes del artículo aplicable.

---

## 5. Vigencia y versionado operativo

- Campos **`vigente_desde`**, **`vigente_hasta`** (admite `null`; `vigente_desde = null` = vigente desde origen según decisión de producto cerrada en plan).
- Campo **`activo`** (soft disable).
- Las solicitudes nuevas aplican la definición vigente al **momento de creación** según ventana y activación.

---

## 6. Documentación diferida y plazos

- **Ancla del temporizador:** el cómputo de días para entrega de documentación **inicia el día posterior al último día de la licencia** aprobada en la solicitud. No depende de acción de “reintegro” hasta que exista ese flujo explícito.
- **Vencimiento sin documentación (default institucional):** **solo alerta + evento RRHH**; sin rechazo automático salvo política explícita del artículo (`accion_vencimiento_documental_id`).
- **`plazo_documental_tipo_dias_id`** referencia **`cfg_tipo_computo_plazo`** (`cfg_tcp_<ULID>`), no valores libres en motor.

### 6.1 Hábil compuesto (cerrado)

**Filtro sustractivo:**

1. **Base:** días laborables del agente según **Asistencia/MDC** (RDA/plantilla: días en que el agente “debería” trabajar), obtenidos por **contrato entre módulos**, no recalculados en ticketera ni en esta pantalla.
2. **Resta:** fechas que coincidan con **`cfg_calendario_feriados_institucional`** (`cfg_cfi_<ULID>`) aplicables por **`alcance_efector_id`**.

**Regla conceptual:** el feriado institucional **anula** ese día como hábil para **plazos administrativos**, salvo **excepciones explícitas** documentadas en RFC.

En **aprobación parcial/split**, el ancla documental usa el **último día del tramo efectivamente aprobado** del artículo que exige documentación.

---

## 7. Estados, SLA, superposición y eventos (resumen)

- **Estados** de solicitud en catálogo `cfg_estado_solicitud_articulo`; transiciones solo por matriz acordada; responsables por tramo (jefe, auditoría, RRHH, sistema).
- **SLA y burbujeo:** por paso en `cfg_paso_workflow_articulo`; acciones en `cfg_accion_vencimiento`.
- **Superposición:** políticas en `cfg_politica_superposicion`; prioridad normativa en `cfg_prioridad_normativa`; **rango mixto incompatible:** **BLOQUEAR_TOTAL** por defecto (ajuste manual del rango antes de continuar).

**Eventos RRHH:** `modulo_origen = articulos`; tipos nuevos del dominio con prefijo de documento **`cfg_tev_art_<ULID>`** en la colección global `cfg_tipo_evento`. Contrato: [`PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md`](./PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md).

**MVP de nueve `codigo_interno`:** listado canónico en [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md) (sección eventos).

**Mantenimiento de `cfg_articulos`:** eventos de configuración solo en **hitos** (publicar/activar, deshabilitar, duplicar base), no en cada borrador intermedio.

**Fuera de MVP:** recordatorios **proactivos** antes del vencimiento documental (evaluar fase v2.2 con job programado).

---

## 8. UX de pantalla (blueprint)

Tabs mínimos: General (incluye variantes SARH si hay 1:N), Elegibilidad, Plazos, Workflow y SLA, Superposición, Documentación, Impacto, Auditoría/rechazos; FAB glosario dual (RRHH vs IT); acciones Guardar borrador, Publicar versión, Duplicar, Deshabilitar. Detalle no normativo puede ampliarse en una revisión UX sin cambiar contrato de datos.

---

## 9. Documentos relacionados

| Documento | Contenido |
|-----------|-----------|
| [DICCIONARIO_CFG_ARTICULOS_V2.md](./DICCIONARIO_CFG_ARTICULOS_V2.md) | Colecciones, prefijos, campos núcleo |
| [ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md](./ANEXO_NORMATIVO_ARTICULOS_1919_SARH_8525_V2.md) | Mapa fuentes y reglas |
| [MATRIZ_ESCENARIOS_ARTICULOS_V2.md](./MATRIZ_ESCENARIOS_ARTICULOS_V2.md) | Ocho escenarios → parámetros |
| [BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md](./BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md) | Dependencias entre módulos |
| [ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md) | Asistencia / MDC / RDA |
| [CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) | Alta por jefe / delegación |

---

## 10. No negociables (gate RFC)

Antes de cerrar implementación o contradecir estos puntos en otros documentos, revisar el plan maestro y el gate acordado: catálogo **`cfg_tipo_computo_plazo`**, calendario **`cfg_calendario_feriados_institucional`**, delegación de **francos/laborables del agente** a Asistencia/MDC, modelo **1:N SARH** (`variantes_sarh[]` vs artículo duplicado), **sin recordatorios proactivos** en MVP.
