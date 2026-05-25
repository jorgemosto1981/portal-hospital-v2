# Plan de desarrollo — Versión 2 del portal

> **Documento maestro (plan previo a codificar).** Aquí vive la **visión, reglas, flujos y modelo de datos** de la V2. El trabajo **por módulos** (contratos, listas, flujos detallados) se amplía en **[`docs/v2/`](./docs/v2/README.md)**. El **mapeo de nombres** (cuando otra redacción difirió) está en **[`docs/v2/REVISION_ALINEACION_PLAN_V2.md`](./docs/v2/REVISION_ALINEACION_PLAN_V2.md)**. La **documentación histórica de la app en producción (V1)** está en el repo hermano [referencia V1 (solo consulta)](../portal-hospital-v1/portal-hospital/docs/referencia_v1/README.md). La V2 **no** comparte proyecto Firebase ni datos con la V1.
>
> **Estado del plan (abril 2026):** no hay **cierres temáticos ni aprobaciones finales**. Todo el contenido —incluidas reglas, esquemas, listas de estados y criterios de salida— es **borrador** sujeto a **nueva revisión por módulo** (transversal, identidad y cuenta, datos personales, laborales, configuración, ticket/solicitudes, acceso Firestore, QA) hasta alinear `PLAN_DESARROLLO_VERSION2`, `docs/v2` y el Rulebook.

## Índice (lectura sugerida)

| Parte | Secciones más abajo | Rol |
|-------|---------------------|-----|
| A | *Trabajo en paralelo — Plan V2* + tabla de módulos | Cómo se reparte el plan por área y enlaces a `docs/v2` |
| B | *Tareas y línea base* + estándar de IDs + reglas ticket (alto nivel) | Cimientos: identificadores, DNI, flujo genérico *(borrador)* |
| C | *PLAN V2 CONSOLIDADO* | Módulo **Ticket / artículos / SLA** (estados, reglas) |
| D | *ESTRUCTURA DE BASE DE DATOS V2* | Esquema de colecciones (identidad, laboral, tickets, `cfg_*`, …) |
| E | Continuidad, *V2-CIERRE*, *V2-REAP*, paquete, criterios de salida (borrador) | Propuestas de cierre, reapertura, metas de planificación *(pend. revisión)* |
| F | *Tareas completadas* en código V1, pendientes, archivos clave | **Anexo:** trabajo ya hecho sobre el monolito (referencia) |

---

## Trabajo en paralelo — Plan V2 (abril 2026)

### Mapa de módulos (área → dónde se baja a detalle)

| Área / módulo | Contenido en este archivo (resumen) | Documento en `docs/v2` |
|---------------|----------------------------------------|------------------------|
| **Transversal** | IDs, prefijos, reglas de negocio global | [`RULEBOOK_V2.md`](./docs/v2/RULEBOOK_V2.md), [`PLAN_MODULOS_V2.md`](./docs/v2/PLAN_MODULOS_V2.md) |
| **Login y cuenta** | `usuarios_cuenta`, acceso | [`MODULO_LOGIN_V2.md`](./docs/v2/MODULO_LOGIN_V2.md) |
| **Datos personales** | `personas`, DDJJ, formación | [`MODULO_DATOS_PERSONALES_V2.md`](./docs/v2/MODULO_DATOS_PERSONALES_V2.md) |
| **Datos laborales** | `grupos_de_trabajo` (`gdt_*`), catálogo de efectores en **`cfg_efectores`**, `historial_laboral_*` | [`MODULO_DATOS_LABORALES_V2.md`](./docs/v2/MODULO_DATOS_LABORALES_V2.md), [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./docs/v2/DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) |
| **Configuración** | `cfg_*`, semillas | [`MODULO_CONFIGURACION_V2.md`](./docs/v2/MODULO_CONFIGURACION_V2.md) |
| **Ticket / solicitudes** | Máquina de estados, *V2-CIERRE*, *V2-REAP* | [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./docs/v2/UNIFICACION_OTRA_PC_Y_TICKET.md), cuestiones Ticket / RRHH / roles |
| **Reglas y acceso Firestore** | (orientación) | [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./docs/v2/ACCESO_Y_RULES_FIRESTORE_V2.md) |

- **Enfoque modular:** la V2 se planifica **por módulos** antes de fijar la BD y el código; el índice completo está en [`docs/v2/README.md`](./docs/v2/README.md). Cada usuario del sistema tiene **un ID único e inmutable** (`persona_id` / `per_<ULID>`).
- **Módulo Ticket / Solicitudes:** **máquina de estados (`EST_*`), reglas, SLA, ítems por grupo, reapertura** en *§ PLAN V2 CONSOLIDADO* y reglas *V2-CIERRE-06* / *V2-REAP* más abajo. Cuestiones puntuales: [`docs/v2/UNIFICACION_OTRA_PC_Y_TICKET.md`](./docs/v2/UNIFICACION_OTRA_PC_Y_TICKET.md), [`docs/v2/CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./docs/v2/CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md).
- **Módulo Datos Personales (formal en repo):** [`docs/v2/MODULO_DATOS_PERSONALES_V2.md`](./docs/v2/MODULO_DATOS_PERSONALES_V2.md).
- **Acuerdo de unificación** entre documentos: [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./docs/v2/UNIFICACION_OTRA_PC_Y_TICKET.md) y [`REVISION_ALINEACION_PLAN_V2.md`](./docs/v2/REVISION_ALINEACION_PLAN_V2.md).
- **Login + datos personales (V2):** flujos y DoD: [`docs/v2/FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./docs/v2/FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md), [`docs/v2/MODULO_CONFIGURACION_V2.md`](./docs/v2/MODULO_CONFIGURACION_V2.md), [`docs/v2/V1_VS_V2_LOGIN_DATOS.md`](./docs/v2/V1_VS_V2_LOGIN_DATOS.md), [`docs/v2/PLAN_MODULOS_V2.md`](./docs/v2/PLAN_MODULOS_V2.md). **V2 independiente de V1** (nueva BD y proyecto). *Fase código:* [`docs/v2/INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./docs/v2/INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md), [`docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md).

### Trabajo en paralelo sin bloquear el núcleo (Login + datos + laborales + cfg)

Mientras se completa el módulo Ticket en `docs/v2/`, avanzar en paralelo **Rulebook** ([`docs/v2/RULEBOOK_V2.md`](./docs/v2/RULEBOOK_V2.md)), **datos laborales** ([`docs/v2/MODULO_DATOS_LABORALES_V2.md`](./docs/v2/MODULO_DATOS_LABORALES_V2.md)), **revisión nombres** ([`docs/v2/REVISION_ALINEACION_PLAN_V2.md`](./docs/v2/REVISION_ALINEACION_PLAN_V2.md)), seeds Fase 0–2 ([`docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md)), **tests de reglas** en emulador, y **CUESTIONES_*** en `docs/v2/` (Ticket, RRHH, roles).

## Tareas y línea base (en curso; revisión por módulo)

### Objetivo estratégico
Iniciar planificación de **V2 desde cero** (nueva base de datos + nueva estructura), reutilizando solo lógica útil de la versión actual y evitando repetir errores históricos.

### Contexto
- Se evaluó la versión actual (V1) y se detectó deuda acumulada (ruido de repositorio, reglas desalineadas, pruebas/lint con fallas y complejidad incremental).
- Línea de trabajo: **arranque limpio** en V2, con diseño por IDs técnicos y gobernanza estricta de reglas/cambios (*a refinar por módulo*).

### Tareas a continuar en la próxima sesión (sin codificar)
1. Definir `Rulebook v2` único y canónico (reglas, estados, permisos, auditoría).
2. Diseñar modelo de identidad v2:
   - `persona_id` (interno estable)
   - `auth_uid` (referencia de autenticación)
   - `dni` (clave de integración estable y única)
3. Diseñar esquema de nueva base de datos:
   - Relaciones por `*_id`
   - Sin campos derivados duplicados (SSoT)
   - Auditoría/eventos inmutables
4. Definir matriz de transiciones de estado y validaciones por rol.
5. ~~Armar plan de migración funcional por vertical slices~~ **(obsoleto frente a V2 greenfield).** Sustituido por **verticales de producto solo en BD V2** (sin datos V1): p. ej. vertical 1 = identidad + login + onboarding datos; vertical 2 = ticket mínimo cuando exista doc unificada; etc. Ver [`docs/v2/PLAN_MODULOS_V2.md`](./docs/v2/PLAN_MODULOS_V2.md).
6. Definir checklist anti-regresiones basado en errores históricos:
   - Auto-aprobación bloqueada
   - Detección jefe/intermedio correcta
   - Consistencia UID/DNI/persona_id
   - Prohibición de "N/A" por falta de joins

### Definición acordada: Estándar de IDs V2

#### Regla base
- Todas las entidades del sistema se crean con un ID técnico inmutable al alta.
- Formato: `<prefijo>_<ULID>`
- Ejemplos:
  - `per_01JQW6K9W8M4B7T2Y3C5D6E7F8` (persona)
  - `art_01JQW6M2Q9N8V7C6X5Z4A3B2C1` (artículo)
  - `avi_01JQW6R8P3L2K1J9H8G7F6D5S4` (aviso/ticket)

#### Propuesta de prefijos iniciales *(pendiente de revisión — módulo transversal / Rulebook)*
- `per_` persona
- `usr_` usuario/cuenta interna
- `art_` artículo normativa
- `avi_` aviso/solicitud
- `gdt_` grupo de trabajo (unidad / organigrama / asignación operativa; colección `grupos_de_trabajo`)
- Efector institucional: documentos en colección **`cfg_efectores`** (ids de documento estables, p. ej. `CFG_EFE_*` en semillas, o `efe_<ULID>` en altas gobernadas por Rulebook). *La colección homónima legacy `efectores` queda deprecada para V2; ver módulo laboral §4.2.*
- `rol_` rol
- `cfg_` configuración/catálogo
- `evt_` evento auditoría
- `doc_` documento adjunto

#### Regla de ciclo de vida (sin borrado físico)
- Nada se elimina físicamente de la base de datos.
- Se usa deshabilitación lógica (`activo=false` o `estado=DESHABILITADO`) con trazabilidad.
- El ID original se conserva siempre para auditoría histórica.

#### Regla especial para DNI (lección aprendida)
- Puede existir más de un registro histórico con el mismo DNI, pero solo uno activo.
- Al deshabilitar una persona, se permite crear una nueva `persona_id` con el mismo DNI.
- Las validaciones de unicidad de DNI deben considerar solo registros activos.

### Reglas V2 para flujo de solicitudes de artículos (modelo tipo ticket)

#### Enfoque funcional
- El proceso de solicitud se modela como ticket con estados explícitos y trazabilidad total.
- Cada solicitud (`avi_`) conserva historial completo desde creación hasta cierre.

#### Flujo base (inicio a fin)
1. **Creado**: usuario inicia solicitud de artículo.
2. **Validación inicial**: chequeos automáticos (datos mínimos, permisos, consistencia).
3. **Asignación**: se determina validador según jerarquía/rol/reglas.
4. **En revisión**: etapa de validación/autorización (jefe, auditoría, RRHH según aplique).
5. **Resolución**:
   - Aprobado
   - Rechazado
   - Requiere información/documentación
   - Reasignado
6. **Cierre**: ticket finalizado con motivo y evidencia auditada.

#### Reglas de control del flujo
- Nunca permitir auto-aprobación.
- Toda transición de estado debe registrar actor, fecha, motivo y contexto.
- Toda excepción (override, fuerza bruta, cambio manual) requiere justificación obligatoria.
- La visibilidad del ticket debe respetar jerarquía y roles.
- Estados y transiciones se gobiernan por matriz central (no hardcode distribuido en UI).

#### Reglas de auditoría para tickets
- Cada acción crítica genera evento `evt_` inmutable.
- Se guarda snapshot mínimo de decisión en cada transición.
- Debe poder reconstruirse la historia completa del caso sin depender de datos temporales de UI.

### Criterios previstos (cuando el plan se considere listo para implementación; *pend. revisión*)
- Documento de arquitectura v2 consensuado.
- Catálogo de entidades/campos obligatorios v2 consensuado.
- Plan de ejecución por fases con riesgos y validaciones consensuado.

## PLAN V2 CONSOLIDADO (borrador operativo; *pend. revisión — módulo Ticket / artículos*)

> Contenido de referencia; la máquina de estados, tipos y reglas se validan en conjunto con `docs/v2` y el Rulebook antes de cualquier implementación.

### 1) Máquina de estados del ticket (`avi_`)
- `EST_CREADO`
- `EST_VALIDACION_INICIAL`
- `EST_PENDIENTE_ASIGNACION`
- `EST_PENDIENTE_JEFE`
- `EST_PENDIENTE_AUDITORIA`
- `EST_PENDIENTE_RRHH`
- `EST_PENDIENTE_INFO`
- `EST_REASIGNADO`
- `EST_PENDIENTE_IMPUTACION`
- `EST_APROBADO`
- `EST_RECHAZADO`
- `EST_CANCELADO`
- `EST_CERRADO`

### 2) Tipos de artículo base (`cfg_tipos_articulo`)
- `TIPO_GENERAL`
- `TIPO_PREDEFINIDO`
- `TIPO_MEDICO_AUDITABLE`
- `TIPO_GENERICO_IMPUTABLE`
- `TIPO_ADMINISTRATIVO_EXCEPCIONAL`

### 3) Reglas de proceso (modelo tipo ticket)
- Nunca auto-aprobación.
- `TOMAR_CONOCIMIENTO` no resuelve (solo acuse).
- Reasignación y override con justificación obligatoria.
- Toda transición genera evento `evt_` inmutable.
- Estados/permisos/transiciones gobernados por configuración (sin hardcode UI).

### 4) SLA y escalamiento
- SLA por estado y tipo de artículo.
- Alertas en 70% / 90% / 100%.
- Escalamiento automático por niveles jerárquicos.
- Pausa de SLA en espera de información (`EST_PENDIENTE_INFO`).

### 5) Cambios de grupo/jefatura con tickets en curso
- Se conserva snapshot de cadena de validación al crear.
- No recalcular por defecto en cada lectura.
- Recalcular solo por evento administrativo trazado y justificado.

---

## ESTRUCTURA DE BASE DE DATOS V2 (detallada; *borrador — pend. revisión por módulo de datos*)

> **Nota:** El detalle por módulo y el mapeo de nombres frente a borradores antiguos: [`docs/v2/REVISION_ALINEACION_PLAN_V2.md`](./docs/v2/REVISION_ALINEACION_PLAN_V2.md). Los apartados A–I son un **borrador** de esquema; se revisan **por módulo** (identidad, laboral, normativa, tickets, cfg, documentación) antes de fijar el modelo canónico.

> Todas las entidades usan IDs inmutables con formato `<prefijo>_<ULID>`.
> No hay borrado físico: solo deshabilitación lógica y trazabilidad.

### A. Identidad y usuarios

#### `personas` (`per_`)
Campos:
- `id` (per_..., PK)
- `dni` (string)
- `dni_normalizado` (string)
- `nombre`, `apellido`, `nombre_completo`
- `email_principal` (nullable)
- `telefono` (nullable)
- `fecha_nacimiento` (nullable)
- `activo` (bool)
- `estado` (`ACTIVO|DESHABILITADO`)
- `motivo_deshabilitacion` (nullable)
- `fecha_deshabilitacion` (nullable)
- `created_at`, `updated_at`, `created_by`, `updated_by`

Reglas:
- DNI único solo en registros activos.
- Puede haber múltiples históricos deshabilitados con mismo DNI.

#### `usuarios_cuenta` (`usr_`)
Campos:
- `id` (usr_..., PK)
- `persona_id` (FK -> personas.id)
- `auth_uid` (string, puede cambiar)
- `username` (nullable)
- `ultimo_login_at` (nullable)
- `estado_acceso` (`HABILITADO|BLOQUEADO|DESHABILITADO`)
- `activo` (bool)
- `created_at`, `updated_at`, `created_by`, `updated_by`

### B. Estructura organizacional, efectores y laboral

> **Abril 2026 — acuerdo de dominio:** **grupo de trabajo** y **efector** son entidades distintas. `grupos_de_trabajo` (`gdt_*`) = unidades de dependencia / organigrama / base para asignación, burbujeo y ticket. El **catálogo** de efectores (lugares de designación / cumplimiento) vive en **`cfg_efectores`** (Database-First, panel de configuración; **sin** listas fijas en código). En `historial_laboral_cargos` hay **dos** FK al **id de documento** en `cfg_efectores` (designación y cumplimiento) y **una** FK a `grupos_de_trabajo`. *Actualización 27/04/2026:* la colección suelta `efectores` queda **obsoleta** frente a `cfg_efectores` — [`docs/v2/MODULO_DATOS_LABORALES_V2.md`](./docs/v2/MODULO_DATOS_LABORALES_V2.md) §4.2. Detalle y nombres de atributo: módulo laboral y [`docs/v2/DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./docs/v2/DECISIONES_REVISION_PERSONALES_LABORALES_V2.md). La redacción anterior con una sola colección `grupos` queda **reemplazada** por este modelo.

#### `grupos_de_trabajo` (`gdt_`)
Colección de **unidades de trabajo y organigrama** (servicio, sector, nodo de jerarquía operativa).
Campos (base):
- `id` (gdt_..., PK)
- `codigo` (opcional)
- `nombre`
- `parent_group_id` (nullable, FK -> grupos_de_trabajo.id)
- `nivel_arbol` (number)
- `activo` (bool)
- `vigente_desde`, `vigente_hasta` (nullable)
- `created_at`, `updated_at`, `created_by`, `updated_by`
- *(Tipificación opcional: `tipo_grupo_id` → `cfg_*` según módulo de configuración.)*

#### `cfg_efectores` (catálogo de efectores; prefijos de id según Rulebook, p. ej. `CFG_EFE_*` o `efe_<ULID>`)
Colección `cfg_*` de **efectores institucionales**; **una sola fuente de verdad** para el panel/ABM y para los desplegables de asignación laboral. **Deprecada** para nuevos despliegues la colección homónima suelta `efectores` (ver [`docs/v2/MODULO_DATOS_LABORALES_V2.md`](./docs/v2/MODULO_DATOS_LABORALES_V2.md) §4.2).
Campos (base):
- `id` (PK: id de documento; convención estable)
- `codigo` (opcional)
- `nombre`
- `es_efector_institucional` (según producto)
- `activo` (bool)
- `vigente_desde`, `vigente_hasta` (nullable)
- *Norma transversal `cfg_*` alineada a* [`docs/v2/MODULO_CONFIGURACION_V2.md`](./docs/v2/MODULO_CONFIGURACION_V2.md) §1–§2*.*
- `created_at`, `updated_at`, `created_by`, `updated_by`

#### `historial_laboral_cargos` (`hlc_`)
Cada documento = **un cargo** del agente (vigencia y causal; carga en horas; referencias legales según módulo laboral).
Campos (resumen alineado al acuerdo; el listado canónico está en el módulo):
- `id` (hlc_..., PK)
- `persona_id` (FK -> personas)
- `grupo_de_trabajo_id` (FK -> `grupos_de_trabajo.id`) — dependencia / unidad de encuadre del cargo
- `efector_designacion_id` (FK -> documento en `cfg_efectores`) — marco **normativo** de designación
- `efector_cumplimiento_id` (FK -> documento en `cfg_efectores`) — lugar de **cumplimiento** de funciones (puede coincidir o no con `efector_designacion_id`)
- Resto: categorías y catálogos vía `*_id` → `cfg_*` (cargo funcional, vínculo, escalafón, fechas, `carga_horaria_total` en **horas**, causales, etc.); ver módulo laboral.
- `activo` (bool)
- `created_at`, `updated_at`, `created_by`, `updated_by`

#### `historial_laboral_datos` (`hld_`)  [Nivel 2]
Campos:
- `id` (PK)
- `cargo_id` (FK -> historial_laboral_cargos.id)
- `persona_id` (FK)
- `rol_id`, `escalafon_id`, `agrupamiento_id`, `funcion_real_id`, `muro_id` (FK cfg)
- `nivel_jerarquico` (number **1–99**, **opcional**; si el flujo usa `hld_*`, puede duplicar hint; el valor que gobierna **burbuja/organigrama** respecto de un `grupo_de_trabajo` es **`hlg_*.nivel_jerarquico` (1–99)**, **sin** colección `cfg_nivel_jerarquia` — **C10** en [`docs/v2/MODULO_DATOS_LABORALES_V2.md`](./docs/v2/MODULO_DATOS_LABORALES_V2.md) §4.4)
- `carga_horaria_diaria` (nullable; desglose preferente en `hlg_*.carga_por_dia_semana`)
- `fecha_inicio`, `fecha_fin` (nullable)
- `activo` (bool)
- `created_at`, `updated_at`, `created_by`, `updated_by`

#### `historial_laboral_grupos` (`hlg_`)  [Nivel 3]
Una fila = asignación del agente a un **grupo de trabajo** (`gdt_*`) con vigencia, **nivel en esa burbuja** y **carga horaria por día de semana** (C10).

Campos:
- `id` (PK)
- `dato_laboral_id` (FK -> historial_laboral_datos.id)
- `persona_id` (FK)
- `grupo_de_trabajo_id` (FK -> `grupos_de_trabajo.id`)
- `fecha_inicio`, `fecha_fin` (nullable)
- `nivel_jerarquico` (number **1–99**): jerarquía del `persona_id` **en este** `grupo_de_trabajo_id` (burbuja). **No** es FK a `cfg_*`.
- `carga_por_dia_semana` (array: cada ítem `dia_semana_id` -> **`cfg_dia_semana`**, `horas` number)
- `activo` (bool)
- `created_at`, `updated_at`, `created_by`, `updated_by`

### C. Artículos y configuración normativa

#### `articulos` (`art_`)
Campos base obligatorios:
- `id` (art_..., PK)
- `tipo_articulo_id` (FK -> cfg_tipos_articulo.id)
- `codigo_normativo`
- `nombre`
- `descripcion`
- `activo` (bool)
- `vigente_desde`, `vigente_hasta` (nullable)
- `unidad_medida_id`, `tipo_acumulacion_id` (FK cfg)
- `permite_solapamiento` (bool)
- `requiere_documentacion` (bool)
- `requiere_justificacion` (bool)
- `estado_configuracion` (`BORRADOR|INCOMPLETO|VALIDADO|PUBLICADO|DESHABILITADO`)
- `estado_inicial_ticket_id` (FK -> cfg_estados_ticket.id)
- `requiere_validacion_jefe` (bool)
- `requiere_validacion_rrhh` (bool)
- `requiere_auditoria` (bool)
- `permite_override_rrhh` (bool)
- `permite_toma_conocimiento` (bool)
- `prioridad_resolucion_id` (FK cfg)
- `created_at`, `updated_at`, `created_by`, `updated_by`

Campos específicos por tipo (ejemplos):
- `dias_predefinidos`, `tipo_dias_predefinidos`, `fecha_fin_auto`
- `es_generico_ingreso`, `requiere_imputacion`, `tipos_articulo_destino_ids[]`
- `plazo_auditoria_horas`
- `motivos_excepcion_ids[]`

#### `cfg_tipos_articulo` (`cfg_`)
Campos:
- `id`
- `codigo`
- `nombre`
- `descripcion`
- `activo`
- `version`
- `vigente_desde`, `vigente_hasta` (nullable)
- `created_at`, `updated_at`, `created_by`, `updated_by`

#### `cfg_parametros_articulo` (`cfg_`)
Campos:
- `id`
- `tipo_articulo_id` (FK)
- `parametro_clave`
- `obligatorio` (bool)
- `tipo_dato` (`string|number|bool|date|array|map`)
- `default_value` (nullable)
- `regla_validacion` (nullable, descriptor)
- `activo`, `version`
- `created_at`, `updated_at`, `created_by`, `updated_by`

### D. Tickets / solicitudes

#### `tickets` (`avi_`)
Campos:
- `id` (avi_..., PK)
- `solicitante_persona_id` (FK -> personas.id)
- `solicitante_dni` (string snapshot)
- `articulo_id` (FK -> articulos.id)
- `tipo_articulo_id` (FK cfg)
- `estado_id` (FK -> cfg_estados_ticket.id)
- `grupo_contexto_id` (FK -> `grupos_de_trabajo.id` — unidad de contexto de la solicitud; id `gdt_*`)
- `fecha_inicio_solicitud`, `fecha_fin_solicitud` (nullable)
- `requiere_imputacion` (bool)
- `articulo_origen_id` (nullable)
- `articulo_final_id` (nullable)
- `responsable_actual_id` (FK -> personas.id, nullable)
- `rol_responsable_actual_id` (FK cfg, nullable)
- `cadena_validacion_snapshot` (array/map)
- `resolver_version` (string)
- `justificacion_solicitante` (nullable)
- `prioridad_resolucion_id` (FK cfg)
- `activo` (bool)
- `created_at`, `updated_at`, `created_by`, `updated_by`

### E. SLA y operación

#### `ticket_sla` (`sla_`)
Campos:
- `id`
- `ticket_id` (FK -> tickets.id)
- `sla_plan_id` (FK -> cfg_sla_planes.id)
- `sla_inicio_at`, `sla_vence_at`
- `sla_estado` (`EN_TERMINO|EN_RIESGO|VENCIDO|PAUSADO`)
- `sla_minutos_objetivo`, `sla_minutos_consumidos`
- `escalado_nivel` (number)
- `pausas` (array/map)
- `activo`
- `created_at`, `updated_at`, `created_by`, `updated_by`

### F. Auditoría y trazabilidad

#### `eventos_ticket` (`evt_`)
Campos:
- `id` (evt_..., PK)
- `ticket_id` (FK -> tickets.id)
- `tipo_evento_id` (FK -> cfg_tipos_evento.id)
- `actor_persona_id` (FK)
- `actor_rol_id` (FK cfg)
- `fecha_evento`
- `estado_origen_id` (nullable)
- `estado_destino_id` (nullable)
- `motivo` (nullable/obligatorio según acción)
- `origen_accion` (`UI|API|JOB|SISTEMA`)
- `resolver_version`
- `payload` (map)
- `hash_integridad` (nullable)
- `activo`
- `created_at`, `created_by`

Regla:
- Append-only (no edición histórica).

### G. Configuración maestra (`cfg_`)

Colecciones recomendadas:
- `cfg_estados_ticket`
- `cfg_transiciones_ticket`
- `cfg_permisos_rbac`
- `cfg_sla_planes`
- `cfg_prioridades`
- `cfg_documentos_requeridos`
- `cfg_motivos_rechazo`
- `cfg_motivos_override`
- `cfg_reglas_jerarquia`
- `cfg_feature_flags`
- `cfg_tipos_evento`

Campos comunes en toda `cfg_*`:
- `id`, `codigo`, `nombre`, `descripcion`
- `activo`, `version`, `estado_publicacion` (`BORRADOR|VALIDADA|PUBLICADA`)
- `vigente_desde`, `vigente_hasta` (nullable)
- `created_at`, `updated_at`, `created_by`, `updated_by`

### H. Documentación adjunta

#### `documentos_ticket` (`doc_`)
Campos:
- `id`
- `ticket_id` (FK)
- `tipo_documento_id` (FK cfg)
- `storage_path`
- `mime_type`
- `tamano_bytes`
- `hash_archivo`
- `fecha_subida`
- `subido_por_persona_id`
- `activo`
- `created_at`, `created_by`

### I. Índices lógicos mínimos (a definir en detalle)
- `tickets`: por `estado_id`, `responsable_actual_id`, `created_at`
- `tickets`: por `solicitante_persona_id`, `created_at`
- `tickets`: por `grupo_contexto_id`, `estado_id`
- `eventos_ticket`: por `ticket_id`, `fecha_evento`
- `personas`: por `dni_normalizado`, `activo`
- `historial_laboral_grupos`: por `persona_id`, `grupo_de_trabajo_id`, `fecha_inicio/fecha_fin`

---

## Propuesta de diseño — identidad *(pendiente de revisión — módulo Identidad y cuenta)*
- V2 operaría con `persona_id` como eje de identidad interna.
- `dni` sería clave de integración estable (única en activos).
- `auth_uid` sería referencia de autenticación (no eje de negocio).
- Toda operación crítica quedaría auditada por eventos `evt_`.

## 🔄 PUNTO DE CONTINUIDAD (PRÓXIMA SESIÓN)

### Tema en curso: Estructura laboral/jerárquica V2 (resolución operativa)

Propuesta en discusión *(módulo laboral / jerarquía; no cerrada)*:
- El `nivel_jerarquico` (1..99) se evalúa en contexto de **grupo de trabajo + fecha**.
- La jerarquía se resuelve por grupo contextual del ticket:
  1. cargar activos en grupo y fecha,
  2. ordenar por jerarquía operativa,
  3. determinar validador/es en ese grupo,
  4. si no alcanza, escalar al grupo padre y repetir hasta tope.
- La dinámica de jerarquía vive en la **asignación operativa persona-grupo-período** (no como atributo fijo del grupo).

Modelo funcional en discusión:
- Nivel Legal: contiene datos del cargo (incluye `escalafon_id`, `agrupamiento_id`, etc.).
- Nivel Operativo: asignaciones a uno o más grupos con periodos propios, horas propias y posible `nivel_jerarquico` diferente por grupo/período.

Puntos abiertos (módulo laboral / jerarquía / ticket; *pend. revisión*):
1. Regla final de desempate cuando existan múltiples candidatos en el mismo grupo.
2. Política final de recalculo de cadena en tickets ya abiertos.
3. Especificación final de “Reglas de Resolución Jerárquica Operativa V2” para anexar al Rulebook.

## Propuesta de regla — cierre por rechazo con propagación de conocimiento *(pend. revisión — módulo Ticket)*

### V2-CIERRE-06 (borrador)

Cuando un `item_grupo` rechaza una solicitud:
- El ticket padre (`avi_`) pasa a `RECHAZADO` (rechazo bloqueante).
- Todos los demás `item_grupo` en estados `APROBADO` o `PENDIENTE_*` deben pasar a:
  - `ITM_PENDIENTE_CONOCIMIENTO_RECHAZO`
- Se genera notificación obligatoria a esos grupos con:
  - quién rechazó (persona/rol/grupo),
  - motivo del rechazo,
  - fecha/hora de decisión.
- El acuse de cada grupo cierra en:
  - `ITM_CONOCIMIENTO_RECHAZO_REGISTRADO`

Reglas complementarias:
- Esta propagación se ejecuta una sola vez por rechazo final (evitar loops).
- No modifica el resultado final del ticket (permanece `RECHAZADO`).
- Todo el proceso debe quedar auditado en `evt_` y `tgh_`.

## Propuesta de regla — reapertura: inline vs nueva versión *(pend. revisión — módulo Ticket)*

### V2-REAP-01 (Regla de oro; borrador)
Si un cambio puede afectar resultado final, participantes de validación, cálculos de fechas/saldo o cumplimiento normativo:
- **NO** se permite corrección inline.
- Se exige **nueva versión encadenada** del ticket.

### V2-REAP-02 (Inline permitido solo para correcciones menores)
Se permite corrección inline únicamente para metadatos no decisorios (comentarios internos, etiquetas administrativas, texto auxiliar), sin alterar:
- estado final,
- cadena de validación,
- decisiones por grupo,
- cálculo normativo.

### V2-REAP-03 (Nueva versión obligatoria)
Casos con nueva versión encadenada obligatoria:
- nueva evidencia que puede cambiar decisión,
- error de proceso/asignación que afectó validación,
- cambio normativo posterior al cierre,
- corrección de fechas o datos que impactan reglas/cálculos,
- cambio de artículo imputado/final,
- cualquier caso que pueda cambiar `APROBADO/RECHAZADO`.

### V2-REAP-04 (Trazabilidad de reapertura)
Eventos mínimos:
- `EVT_REAPERTURA_VERSIONADA`
- `EVT_TICKET_ENCADENADO`
- `EVT_CIERRE_VERSION_ANTERIOR`
- `EVT_CORRECCION_ADMINISTRATIVA` (solo inline)

### V2-REAP-05 (Preconfiguración en base de datos; borrador)
*Si se mantiene este criterio en el diseño final:* todos los estados, acciones, transiciones, motivos y tipos de evento del circuito deberían existir como configuración base inicial (`seed`) en `cfg_*` al inicializar V2, y no como estados críticos fijos en UI o servicios. Sujeto a **revisión** junto con el módulo Configuración.

## Paquete de salida de planificación V2 (objetivo de implementación; *borrador — pend. revisión*)

> Lista de entregables **propuestos**; no implica plan cerrado ni listo para producción.

### Componentes incluidos en el paquete
1. **Checklist QA funcional post-seed** (15 casos críticos y no críticos).
2. **Acta de validación formal** (tabla de ejecución, evidencias y cierre).
3. **Matriz de transiciones**:
   - `cfg_transiciones_ticket`
   - `cfg_transiciones_item_grupo`
4. **Seeds mínimos iniciales (`cfg_*`)**:
   - estados (padre e item),
   - acciones (padre e item),
   - tipos de evento (padre e item),
   - tipos y parámetros de artículo,
   - planes SLA y objetivos por estado,
   - permisos RBAC,
   - motivos de rechazo/reasignación/override/reapertura,
   - reglas jerárquicas y feature flags.

### Criterio previsto para “planificación lista” (*pend. revisión global*; no es cierre aprobado)
*Si el equipo acordara criterios de cierre, podría evaluarse algo como: planificación alineada cuando* exista una versión consensuada (no forzosamente “única final”) del Rulebook V2, *cuando* estén definidos seeds base y códigos, *cuando* la matriz de transiciones esté completa en el diseño, *cuando* exista checklist QA y acta. **Hoy todo ello sigue en desarrollo.**

## Borrador de definiciones V2 — *pendiente de nueva revisión por módulo*

*Las decisiones de esta sección son **propuestas** (marzo 2026 y sucesivas iteraciones). Ninguna sustituye una aprobación formal: cada punto debe revisarse en su módulo correspondiente (Rulebook, seeds, ticket, jerarquía, config, QA).*

Fecha de esta redacción borrador: 2026-03-31 (actualizable)

### Punto 1 — Rulebook V2 (índice propuesto) *(pend. revisión)*
Índice de trabajo (puede variar):
1. Identidad e IDs
2. Modelo de datos y SSoT
3. Jerarquía operativa
4. Flujo de tickets (padre + items por grupo)
5. Permisos RBAC + ámbito
6. SLA y escalamiento
7. Auditoría y eventos
8. Reapertura/versionado
9. Gobernanza de configuración (`cfg_*`)
10. QA y criterios de salida

### Punto 2 — Códigos de seeds (convención propuesta) *(pend. revisión)*
Convención de trabajo (no fija hasta **revisión** conjunta módulo Configuración + Rulebook):
- Estados ticket: `EST_*`
- Estados item: `ITM_*`
- Acciones ticket: `ACC_*`
- Acciones item: `ACC_ITM_*`
- Eventos ticket/item: `EVT_*`, `EVT_ITM_*`
- Motivos: `MOT_*`
- Roles: `ROL_*`
- SLA: `SLA_*`

### Punto 3 — Desempate jerárquico *(pend. revisión)*
Secuencia dentro del grupo evaluado:
1. Mayor `nivel_jerarquico_grupo`
2. Mayor antigüedad vigente en el grupo
3. Prioridad de rol (configurable)
4. Empate persistente: resolución RRHH + evento forense

### Punto 4 — Recalculo en tickets abiertos *(pend. revisión)*
- Regla por defecto: NO recalcular (snapshot estable).
- Excepciones: acción administrativa explícita (responsable inactivo, error de asignación u orden RRHH), siempre auditada.

### Punto 5 — Vigencia de configuración *(pend. revisión)*
- Tickets nuevos: configuración `PUBLICADA` vigente (*propuesta*).
- Tickets en curso: snapshot *propuesto* como estable.
- Recalculo en curso: *propuesta* solo por acción autorizada y auditada.

### Punto 6 — Constraints críticos *(pend. revisión)*
- No 2 personas activas con mismo DNI.
- No ticket resolutivo sin responsable.
- No transiciones fuera de matriz.
- No cierre sin `item_grupo` requeridos.
- Rechazo de 1 grupo => rechazo del padre + propagación de conocimiento.

### Punto 7 — Gate de salida QA *(pend. revisión)*
- Checklist QA funcional (15 casos) + acta (*a consensuar cuando el plan avance*).
- Objetivo: 0 fallas en casos críticos (*a validar*).
- Seed base `v1` o equivalente: *a validar y publicar cuando toque* (módulo Configuración + QA).

---

**Última revisión de unificación (estado plan / aprobaciones → borrador):** 23 de abril de 2026  
**Rama de trabajo (referencia):** `refactorizacion-fase1` *(puede variar)*

---

## Anexo F — Tareas completadas (código de la app V1 / monolito)

*Trabajo ya realizado sobre el código en producción; se conserva como **referencia histórica** durante el plan V2. No forma parte del entregable de la nueva app. No implica cierre del plan V2 ni validez de decisiones de producto para la V2.*

## Tareas completadas (V1)

### 1. Normalización de IDs a MAYÚSCULAS
- ✅ Implementada función `normalizarId()` en `src/utils/normalizarId.js`
- ✅ Actualizados servicios para usar normalización:
  - `configuracionService.js`
  - `valoresDefaultService.js`
  - `murosService.js`
  - `escalafonesService.js`
  - `situacionesService.js`
  - `agrupamientosService.js`
  - `familiaresService.js`
- ✅ Creados scripts de normalización:
  - `scripts/normalizar-ids-mayusculas.js` (colecciones específicas)
  - `scripts/normalizar-todas-colecciones.js` (todas las colecciones)
  - `scripts/backup-antes-normalizacion.js` (backup antes de normalizar)
- ✅ Documentación creada: `docs/referencia_v1/REGLAS_IDS_MAYUSCULAS.md`

### 2. Sistema de Resolución de Nombres por ID
- ✅ Creado `src/utils/resolverNombresConfig.js` con hook `useConfigResolver`
- ✅ Implementadas funciones para resolver:
  - `resolverNombreRol(rolId)` → nombre del rol
  - `resolverNombreEscalafon(escalafonId)` → nombre del escalafón
  - `resolverNombreFuncionReal(funcionRealId)` → nombre de función real
  - `resolverNombreCategoria(categoriaId)` → nombre de categoría
  - `resolverNombreAgrupamiento(agrupamientoId)` → nombre de agrupamiento
- ✅ Actualizado `AutorizarNuevos.jsx` para usar resolución por ID
- ✅ Actualizado `DatosAutorizacion.jsx` para mostrar nombres legibles

### 3. Sistema de Verificación de Roles por ID
- ✅ Creado `src/utils/verificarRoles.js` con funciones:
  - `esRol(rolId, nombreRol)` - verificación asíncrona
  - `esRolSync(rolId, nombreRol)` - verificación síncrona
  - `esAlgunRol(rolId, nombresRoles)` - verificación múltiple
  - Cache de roles en memoria
- ✅ Creado hook `src/hooks/useVerificarRoles.js`
- ✅ Actualizados componentes para usar verificación por ID:
  - `Sidebar.jsx`
  - `AppRouter.jsx`
  - `withRoleGuard.jsx`
  - `SeguimientoProcesosView.jsx`
  - `AvisosPendientesView.jsx`
  - `DashboardPage.jsx`

### 4. Corrección Flujo de Completar Datos Personales
- ✅ Corregido `useUserSession.js` para asegurar campos críticos:
  - `necesita_completar_datos`
  - `datos_completados`
  - `estado_registro`
- ✅ Actualizado `App.jsx` para detectar usuarios PENDIENTE correctamente
- ✅ Mejorado `CompletarDatosPersonales.jsx`:
  - Búsqueda por DNI o UID
  - Mejor manejo de errores
- ✅ Actualizado `migrarDatosRegistro()` para asignar UID normalizado
- ✅ Normalizado UID en `obtenerUsuarioMinimo()` y `obtenerUsuarioPorUid()`

### 5. Sistema de Bloqueo de DNIs
- ✅ Creado `src/services/dnisBloqueadosService.js`
- ✅ Implementada lógica de bloqueo:
  - Usuarios PENDIENTE eliminados → DNI NO se bloquea
  - Usuarios REGISTRADO eliminados → DNI SÍ se bloquea
- ✅ Actualizado `usuariosService.js`:
  - `eliminarUsuario()` guarda `estado_registro_anterior`
  - `validarDNIUnico()` verifica DNIs bloqueados
- ✅ Actualizado `estadoUsuarioUtils.js` para usar bloqueo de DNIs

### 6. Reorganización de Documentación
- ✅ Movidos todos los archivos `.md` a carpeta `docs/`
- ✅ Mantenido `README.md` en raíz del proyecto

---

## ⚠️ Tareas Pendientes / Para Verificar

### 1. Normalización de IDs en Base de Datos
- ⚠️ **CRÍTICO:** Verificar si los scripts de normalización se ejecutaron en producción
- ⚠️ Revisar que todos los documentos en Firestore tengan IDs en MAYÚSCULAS
- 📝 Scripts disponibles:
  - `scripts/normalizar-ids-mayusculas.js` - Para colecciones específicas
  - `scripts/normalizar-todas-colecciones.js` - Para todas las colecciones

### 2. Verificación de Referencias Inválidas
- ⚠️ Verificar que no haya referencias a IDs que no existen (roles, escalafones, etc.)
- 📝 Scripts disponibles:
  - `scripts/verificar-referencias-invalidas.js` - Identifica referencias inválidas
  - `scripts/corregir-referencias-invalidas.js` - Corrige referencias automáticamente
  - `scripts/ver-roles.js` - Lista todos los roles
  - `scripts/ver-escalafones.js` - Lista todos los escalafones
  - `scripts/ver-agentes-escalafon-invalido.js` - Busca agentes con escalafón inválido

### 3. Testing del Flujo Completo
- ⚠️ Probar registro completo de usuario nuevo:
  1. RRHH crea usuario en lista blanca
  2. Usuario se registra en Firebase Auth
  3. Usuario completa datos personales
  4. Usuario puede acceder a la aplicación
- ⚠️ Verificar que el campo `uid` se asigne correctamente al documento
- ⚠️ Verificar que los nombres se resuelvan correctamente en la UI

### 4. Validación de Normalización
- ⚠️ Verificar que los servicios normalicen IDs correctamente al crear/actualizar
- ⚠️ Verificar que las búsquedas funcionen con IDs normalizados y originales (compatibilidad)

---

## 📁 Archivos Clave Modificados

### Servicios
- `src/services/usuariosService.js` - Normalización UID, búsquedas mejoradas
- `src/services/configuracionService.js` - Normalización de IDs
- `src/services/escalafonesService.js` - Normalización de IDs
- `src/services/murosService.js` - Normalización de IDs
- `src/services/situacionesService.js` - Normalización de IDs
- `src/services/agrupamientosService.js` - Normalización de IDs
- `src/services/dnisBloqueadosService.js` - **NUEVO** - Gestión de DNIs bloqueados

### Utilidades
- `src/utils/normalizarId.js` - **NUEVO** - Función de normalización
- `src/utils/resolverNombresConfig.js` - **NUEVO** - Resolución de nombres por ID
- `src/utils/verificarRoles.js` - **NUEVO** - Verificación de roles por ID

### Hooks
- `src/hooks/useUserSession.js` - Mejoras en carga de datos
- `src/hooks/useVerificarRoles.js` - **NUEVO** - Hook para verificación de roles

### Componentes
- `src/App.jsx` - Detección de usuarios PENDIENTE
- `src/components/CompletarDatosPersonales.jsx` - Búsqueda mejorada
- `src/components/layout/Sidebar.jsx` - Verificación de roles por ID
- `src/components/routing/AppRouter.jsx` - Verificación de roles por ID
- `src/features/admin/components/AutorizarNuevos.jsx` - Resolución de nombres
- `src/routes/guards/withRoleGuard.jsx` - Verificación de roles por ID

---

## 🚀 Cómo Continuar desde Otra PC

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/jorgemosto1981/portal-hospital.git
   cd portal-hospital
   git checkout refactorizacion-fase1
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Verificar estado actual:**
   ```bash
   git log --oneline -5
   # Deberías ver el commit: 7e54cde fix: Normalización de IDs a mayúsculas...
   ```

4. **Revisar tareas pendientes:**
   - Leer esta sección "Tareas Pendientes"
   - Ejecutar scripts de verificación si es necesario
   - Probar el flujo completo de registro

5. **Si necesitas normalizar IDs en la BD:**
   ```bash
   # IMPORTANTE: Hacer backup primero
   node scripts/backup-antes-normalizacion.js
   
   # Luego normalizar (elegir uno):
   node scripts/normalizar-ids-mayusculas.js  # Colecciones específicas
   # O
   node scripts/normalizar-todas-colecciones.js  # Todas las colecciones
   ```

---

## 🔍 Debugging

Si encuentras problemas:

1. **Usuario no encontrado por UID:**
   - Verificar que el campo `uid` exista en el documento
   - Verificar que el `uid` esté normalizado a MAYÚSCULAS
   - Ver logs en consola del navegador

2. **Nombres no se resuelven:**
   - Verificar que los IDs existen en las colecciones raíz
   - Verificar que se use `useConfigResolver` en el componente
   - Ver logs en consola: `[resolverNombresConfig]`

3. **Roles no se verifican correctamente:**
   - Verificar que el rol del usuario sea un ID válido
   - Ejecutar `node scripts/ver-roles.js` para ver roles disponibles
   - Ver logs en consola: `[useVerificarRoles]`

---

## 📝 Notas Importantes

- **V2 (abril 2026, actual. 27/04/2026):** el catálogo de **efectores** para datos laborales y el panel de configuración es la colección **`cfg_efectores`**; `hlc_*.efector_*_id` resuelven documentos allí. La colección `efectores` quedó **deprecada** en documentación; ver §B y [`docs/v2/MODULO_DATOS_LABORALES_V2.md`](./docs/v2/MODULO_DATOS_LABORALES_V2.md) §4.2.
- **Nivel de jerarquía (misma actualización):** **no** se usa `cfg_nivel_jerarquia`. El nivel en burbuja es **`hlg_*.nivel_jerarquico`** (entero **1–99**). Catálogos laborales avanzados sembrados/ABM: `cfg_modalidad_jornada`, `cfg_estado_asignacion_laboral`, `cfg_causal_fin_asignacion_laboral`, `cfg_tipo_acto_designacion`, `cfg_tipo_grupo` (ver módulo laboral §6).
- **Regla establecida:** TODOS los IDs de documentos en Firestore DEBEN estar en MAYÚSCULAS
- **Compatibilidad:** Las búsquedas funcionan con IDs en mayúsculas y minúsculas (fallback)
- **UID:** El campo `uid` en documentos de usuarios también debe estar normalizado a MAYÚSCULAS
- **DNIs bloqueados:** Los DNIs de usuarios PENDIENTE eliminados NO se bloquean (permite correcciones administrativas)

---

## Documentación de referencia (V1; monolito)

- `docs/referencia_v1/REGLAS_IDS_MAYUSCULAS.md` — regla de normalización de IDs (app en producción)
- `README.md` — información general del proyecto
- `docs/referencia_v1/FLUJO_REGISTRO_PROTEGIDO.md` — flujo de registro de usuarios (V1)

---

**Última actualización de este anexo (V1):** 23 de abril de 2026

