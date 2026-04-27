# Módulo de Datos Personales — Plan V2

**Plan de desarrollo unificado (criterios y flujo en un solo lugar):** [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md) — **cierre documental del módulo** (§11). **Este archivo** sigue siendo el **anexo** de contrato campo a campo.

**Estado del plan (documentación):** **avanzado** (contrato y flujos de referencia); *pendiente de nueva revisión*; ver [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) y [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) (criterios de alineación). **Orden y encargo de desarrollo:** [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md), [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md). Implementación de código V2: fase posterior; **sin** migración ni conexión técnica con la V1 ([`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) — regla básica).

**Ámbito:** planificación de la **nueva base de datos** y del módulo de datos personales para código V2 (sin arrastrar el modelo físico de V1).  
**Alineación:** nombres de colecciones y prefijos según [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md); convenciones transversales en [`RULEBOOK_V2.md`](./RULEBOOK_V2.md) y [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md). IDs técnicos `per_`, `usr_`, `gf_`, `doc_`, `evt_`, `cfg_`.  
**Marco modular:** este archivo es un módulo del plan general descrito en [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md).  
**Flujo cruzado Login → cierre onboarding (implementación):** [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md).  
**Acceso Firestore / Rules / Callables:** [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md). **Catálogos `cfg_*` (forma y flags):** [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md).  
**ID de usuario:** el identificador **único y fijo** del agente en todo el sistema es el **id del documento** `personas/{per_<ULID>}` (referenciado como **`persona_id`** en otras colecciones). Evitar un segundo id de negocio distinto; ver **§2.2** (anti-duplicidad).

**Fecha de inicio en este archivo:** 22 de abril de 2026.

---

## Acuerdo de trabajo en paralelo

- En **otra PC:** Módulo **Ticket / Solicitudes** (estados, flujo).
- En **esta PC:** este documento = **módulo Datos Personales** + esquema de BD V2.
- **Mañana:** unificación de documentación entre módulos.

---

## 1. Objetivo del módulo (V2)

- Persistir identidad humana, contacto, domicilio, formación y habilitaciones profesionales con **una sola fuente de verdad** por atributo.
- Registrar **consentimientos** (DDJJ personal y normativas) con **versión de texto** y trazabilidad (`evt_`).
- Gestionar **declaración jurada de grupo familiar** como entidad propia, enlazada al titular por `persona_id`.
- Exponer al resto del sistema (p. ej. tickets `avi_`) solo **`persona_id`** y datos agregados mínimos cuando la normativa lo permita.

### 1.1 Orden respecto del login y onboarding (acuerdo con módulo Login)

El orden de trabajo en el portal es el definido en [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§4**:

1. **RRHH** da de alta DNI, nombre y apellido → estado **pendiente de registro / primer login**.
2. El agente hace **primer acceso con DNI**, declara **email** y **contraseña** (fuente de verdad del correo en cuenta; §2 de Login).
3. Debe **completar datos personales** hasta el checklist acordado (`estado_perfil_datos_id` / lista **[P]** y marcas **[O]** de esta especificación) **antes** de ver los **menúes** de la app.
4. La **DDJJ de grupo familiar** puede cargarse **en el mismo onboarding o después**; **no bloquea** el menú principal, pero debe **quedar registrado** si se omitió o en qué estado quedó, para que el **módulo Ticket** pueda exigirla completada en tipos de solicitud configurables (ver §2.1 y [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §4.4).

Este módulo define **qué campos** existen y cuándo son obligatorios al perfil **`COMPLETO`**; el módulo Login define **cuándo** el usuario pasa entre estados de acceso (**solo por `estado_acceso`**, ver [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §5). La **secuencia operativa y el gating de rutas** para codificar V2 están unificados en [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md).

### 1.2 Flujo paso a paso (alta → login → datos): campos por etapa, frecuencia y riesgos

**Regla transversal:** estados y tipos enumerables = **`*_id`** → **`cfg_*`**. Texto solo para datos realmente narrativos (nombre, domicilio, título de carrera).

**Frecuencia relativa (diseño / caché):** en operación diaria lo más leído suele ser **`usuarios_cuenta`** + claims/sesión (Login). **`declaraciones_grupo_familiar`** se consulta **algo más** al validar solicitudes o mostrar resumen familiar. **`personas`** + **`formacion_agente`** son las que **menos** se releen una vez estabilizada la ficha (lecturas puntuales en RRHH, auditoría, tickets que pidan snapshot); conviene **no** inflar esos documentos con datos que deban ir a otras colecciones.

---

#### Paso A — Alta RRHH (sin sesión del agente)

| Dónde | Campos que se definen / actualizan | Notas |
|--------|--------------------------------------|--------|
| **`personas`** | `persona_id`, `dni`, `nombre`, `apellido`, `activo=true`, `schema_version`, `creado_en`, `actualizado_en`; **`estado_perfil_datos_id`** → estado “incompleto / pendiente ficha” en `cfg_estado_perfil_datos`; **`perfil_completitud_version`** | Mínimo viable; resto de persona `null` o ausente según contrato. |
| **`usuarios_cuenta`** | `cuenta_id`, `persona_id`, **`estado_acceso`** → id en `cfg_estado_cuenta_acceso` equivalente a “pendiente registro”; `activo` (cuenta); `creado_en` / `actualizado_en`; **`auth_uid`** puede ser `null` hasta el paso B | Debe existir **lookup** DNI ↔ `persona_id` ↔ `cuenta_id` antes del primer login. |
| **`formacion_agente`** | Normalmente **no** se crea aún (o doc vacío con solo ids y nulls, según política). | Evita documentos huérfanos. |
| **`declaraciones_grupo_familiar`** | **Obligatorio (decisión B7 / plan unificado):** **crear** `gf_*` con `titular_persona_id`, **`estado_declaracion_id`** = “no iniciada” (u otro en `cfg_estado_declaracion_ddjj`), versiones y timestamps | Ticket y reportes leen **siempre** un `estado_declaracion_id`, no ausencia de fila. |

---

#### Paso B — Primer acceso: DNI + email + contraseña

| Dónde | Campos | Notas |
|--------|--------|--------|
| **Proveedor Auth** | Cuenta con **email** + password; `uid` | Firebase u otro: el **DNI** no suele ser el identificador nativo de Auth; hace falta flujo **custom** (Cloud Function que valida DNI contra `personas` y luego crea/vincula usuario email/password). |
| **`usuarios_cuenta`** | `auth_uid`, `username`, **`estado_acceso`** → “onboarding datos”; `actualizado_en` | Transición desde “pendiente registro”. |
| **`personas`** | Sin escribir email de login aquí; solo timestamps si aplica | El correo vive **solo** en `usuarios_cuenta.username` (§2.2). |

**Riesgos del paso B:** (1) **Colisión** si el email ya existe en Auth. (2) **Persona sin cuenta** o cuenta huérfana si falla a mitad. (3) **DNI duplicado** o typo en alta RRHH → bloqueo de reclamo; requiere regla de unicidad y mensaje claro.

---

#### Paso C — Onboarding datos personales (bloquea menú principal)

| Dónde | Campos (ejemplos; el checklist completo sigue §3 / listas P) | Notas |
|--------|---------------------------------------------------------------|--------|
| **`personas`** | `fecha_nacimiento`, `domicilio.*`, `contacto.telefono_celular`, `sexo_genero_id`, `estado_civil_id`, **`foto_rostro`** (map; ver §3.12), …; al cerrar checklist: **`estado_perfil_datos_id`** → id “completo” en `cfg_estado_perfil_datos` | Todos los desplegables = **`*_id`** a `cfg_*`. Foto: cámara o adjunto (decisión **E5**). |
| **`formacion_agente`** | `formacion_id`, `persona_id`, `nivel_estudios_id`, `titulo_completo`, `duracion_anios`, … | Tabla de **baja lectura** recurrente; conviene **1 doc** por persona en V2. |
| **`consentimientos`** | Filas `doc_*` con `tipo_consentimiento_id` / `version_id` / hashes según TyC | Tipos y versiones por **id** a `cfg_*`. |

**Riesgos del paso C:** **`estado_perfil_datos_id`** desincronizado con `estado_acceso` de la cuenta si dos escrituras fallan a medias → **transacción** o job de reconciliación. *(Formación solo en `formacion_agente`, §2.2.)*

---

#### Paso D — DDJJ familiares (opcional para menú; obligatorio persistir estado)

| Dónde | Campos | Notas |
|--------|--------|--------|
| **`declaraciones_grupo_familiar`** | `familiares[]` líneas con `familiar_linea_id`, `parentesco_id`, nombres, etc.; **`estado_declaracion_id`** y `declaracion_version` | Lectura **más frecuente** que `personas` en flujos de beneficios/tickets. |
| **Si el usuario pospone** | Solo cambia **`estado_declaracion_id`** (ej. “omitida onboarding”) + `actualizado_en` + `evt_*` | Nunca persistir la decisión solo como texto libre. |

**Riesgo:** si no existe fila `gf_*` y no hay evento, el Ticket no puede evaluar prerequisitos por **id**.

---

#### Paso E — Acceso a menúes (`ACTIVO_PORTAL`)

| Dónde | Campos |
|--------|--------|
| **`usuarios_cuenta`** | **`estado_acceso`** → id “activo portal” en `cfg_estado_cuenta_acceso` |

**Riesgo:** menú habilitado con **`estado_perfil_datos_id`** aún no “completo” si solo se actualiza la cuenta → la regla debe exigir **ambas** condiciones o una sola fuente de verdad acordada.

---

### 1.3 Edición posterior al onboarding y toma de conocimiento RRHH

Criterio **E1** en [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) (sección **E**).

- Tras el paso **E** (y en general con ficha activa), el **agente** **no** modifica por sí mismo **`dni`**, **`nombre`** ni **`apellido`**; la corrección de identidad pasa por **RRHH** / proceso administrativo.
- El agente **sí** puede actualizar, entre otros, **domicilio**, **teléfono**, **estado civil**, **formación** (`formacion_agente`) y **foto de rostro** (`foto_rostro`), según reglas de negocio y permisos en Rules/Callables.
- Cada cambio relevante debe generar **toma de conocimiento** de **RRHH**: típicamente fila en **`eventos_ticket`** con **`tipo_evento_id`** → `cfg_tipo_evento` (p. ej. “datos personales actualizados” o equivalente) y **`payload`** con **referencias** a campos/ids afectados (**B6**), no copia de documento completo. La **visualización** en bandeja o reporte = implementación.
- El **cambio de contraseña o del correo de acceso** no es parte de la edición de ficha: módulo de **cuenta / seguridad** (p. ej. *usuario y contraseña*), decisión **E2**.

---

## 2. Convenciones para la nueva base de datos

| Convención | Descripción |
|-------------|-------------|
| **ID de documento** | `<prefijo>_<ULID>` inmutable desde el alta. Nunca usar DNI ni email como ID de documento. |
| **Timestamps** | Preferir `Timestamp` de Firestore (o ISO 8601 en string solo si hay razón de interoperabilidad). |
| **Referencias** | Guardar siempre `*_id` string hacia otro documento; no duplicar objetos completos en tickets. Para “¿de qué usuario es?” usar **`persona_id`** (ID de usuario del sistema). |
| **Estados y enumerables** | **Regla básica de la app:** todo lo que sea “estado”, “tipo”, “categoría” o **lista cerrada de negocio** se persiste como **`*_id`** (FK a documentos en **`cfg_*`** u otra colección de configuración). **No** usar texto humano ni “enum en string” libre (`"COMPLETO"`, `"BORRADOR"`) como fuente de verdad en BD si ese valor debe gobernar reglas: la BD guarda el **id del ítem de configuración**; las etiquetas salen de la `cfg_*` en lectura. *(Excepción solo si un campo es texto legalmente exigido como libre, explícitamente documentado.)* |
| **Borrado** | No hay borrado físico de personas; `activo: false` + motivo + `evt_`. |
| **DNI** | Unicidad lógica solo entre personas con `activo === true`. |
| **Nombres de colección** | En minúsculas plural snake_case: `personas`, `formacion_agente`, `usuarios_cuenta`, `consentimientos`, `declaraciones_grupo_familiar`, `eventos_ticket`. *(Ajustable al estándar que definan mañana con el otro módulo.)* |

### 2.1 Composición del módulo: tablas (colecciones) y ancla `persona_id`

**Línea base de arquitectura (acuerdo):** cada agente tiene un **`persona_id`** (`per_<ULID>`) **único y fijo**. Las “tablas” siguientes son **colecciones de primer nivel** (o equivalente en Rulebook) que **referencian** ese id; no se particiona una tabla física por usuario en el sentido SQL, sino que **cada documento** lleva `persona_id` (o `titular_persona_id`) como FK.

| Tabla / colección | Módulo dueño | Ancla | Rol |
|-------------------|--------------|--------|-----|
| **`personas`** | Datos personales | `persona_id` (id del doc) | Identidad civil, contacto, domicilio, estado de perfil, habilitaciones opcionales, metadatos. |
| **`formacion_agente`** | Datos personales | `persona_id` | **Tabla separada** para datos de **formación y nivel de estudios** del agente (un documento vigente por persona en V2, salvo que después se permita historial). Desacoplada de la fila `personas` para claridad operativa y consultas. |
| **`declaraciones_grupo_familiar`** | Datos personales | `titular_persona_id` | DDJJ de grupo familiar (`gf_<ULID>`). |
| **`consentimientos`** | Datos personales | `persona_id` | Aceptaciones legales / TyC (`doc_<ULID>`). |
| **`eventos_ticket`** | Cruzado (varios módulos) | según `tipo_evento_id` | Trazabilidad (`evt_<ULID>`). |
| **`usuarios_cuenta`** | **Login** (especificación en [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §1.1–§2) | `persona_id` | Acceso **DNI + PIN 6** en UI; `username`, `auth_uid`, **`estado_acceso`** (FK `cfg_estado_cuenta_acceso`), **`role_ids`**, etc. |
| **`cfg_efectores`** | **Configuración** ([`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5.1) | id de documento (p. ej. `CFG_EFE_*` o `efe_<ULID>`) | Catálogo de efectores; **`es_efector_institucional`**; consumido por **`historial_laboral_cargos`** (designación y cumplimiento). Sustituye a la fila bajo el nombre `efectores` en versiones anteriores del inventario. |
| **`grupos_de_trabajo`** | **Configuración / operativo laboral** ([`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md)) | — (id `gdt_<ULID>`, `parent_group_id`) | Organigrama / unidad de encuadre; `hlc_*.grupo_de_trabajo_id`. |
| **`historial_laboral_cargos`** | **Datos laborales** ([`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md)) | `persona_id` | Cargos: varios vigentes; FK a **`gdt_*`**, **dos** documentos de **`cfg_efectores`** (designación y cumplimiento); causal; **`carga_horaria_total`** en horas (`hlc_*`). |

**Qué define cada plan:** el **módulo Datos personales** (este documento) define **`personas`**, **`formacion_agente`**, **`declaraciones_grupo_familiar`**, **`consentimientos`** y el uso de **`eventos_ticket`**. El **módulo Login** define **`usuarios_cuenta`**, proveedor Auth y reglas de sesión (incl. §2 email único y §4–§5 onboarding). **Configuración** mantiene catálogos; **datos laborales** define **`grupos_de_trabajo`**, el catálogo de efectores en **`cfg_efectores`**, **`historial_laboral_cargos`** (y el subnivel de reparto cuando cierre **§4.5** del plan laboral). Detalle: [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) §B.

**Tipos de dato (texto vs no texto):**

| Tipo lógico | Uso | Ejemplos de campo |
|-------------|-----|-------------------|
| **Texto libre** (`string`) | Nombres, calles, títulos descriptivos, notas, referencias de domicilio. | `nombre`, `apellido`, `domicilio.calle`, `formacion_agente.titulo_completo`. |
| **Texto normalizado / código** (`string`) | IDs técnicos, DNI normalizado solo dígitos, códigos de catálogo. | `persona_id`, `dni`, `familiar_linea_id`. |
| **Referencia seleccionable** (`string` FK) | Siempre **`*_id`** apuntando a documentos en **`cfg_*`** con **id única** por valor (texto solo en el catálogo; vigencia y bajas lógicas según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2). Incluye **estados**. **Prohibido** hardcodear opciones en código. | `estado_civil_id` → `cfg_estado_civil`; `nivel_estudios_id` → `cfg_nivel_estudios`; `parentesco_id` → `cfg_parentesco`. |
| **Numérico** (`number`) | Duración en años, versiones, `schema_version`. | `formacion_agente.duracion_anios`, `perfil_completitud_version`. |
| **Booleano** (`boolean`) | Flags, preferencias. | `activo`, `convive`, `declaracion_jurada_aceptada`. |
| **Fecha/hora** (`Timestamp`) | Nacimientos, auditoría. | `fecha_nacimiento`, `creado_en`. |
| **Estructurado** (`map` / `array`) | Objetos anidados, listas controladas. | `contacto`, `domicilio`, `familiares[]`. |

**Listas cerradas “de producto”** (`estado_perfil_datos`, acceso a portal, DDJJ, ticket, etc.): en persistencia son siempre **`*_id`** → **`cfg_*`**. Las etiquetas para UI se resuelven por join a configuración. *(Si algún motor interno usa constantes, deben mapearse 1:1 a ids de `cfg_*` en seeds o versionado de catálogos **dentro de V2**; no mezclar strings sueltos en datos nuevos.)*

**DDJJ familiar: opcional en primer login, pero siempre registrada la situación**

- En el **onboarding inicial** el titular **puede** completar la DDJJ **o posponerla**; en ambos casos el sistema debe dejar **trazabilidad consultable** para el **módulo Ticket / Solicitudes** (p. ej. “intentar abrir solicitud tipo X requiere DDJJ en estado cerrado/aceptado según `cfg_requisitos_ticket`”).
- **Patrones posibles** (elegir uno en implementación, documentado en Ticket):
  1. **Documento `declaraciones_grupo_familiar`** siempre existente por titular, con **`estado_declaracion_id`** apuntando al id del registro en **`cfg_estado_declaracion_ddjj`** (nombre tentativo) para el valor “no iniciada”, “omitida en onboarding”, “borrador”, etc.; las transiciones cambian solo el **id** de estado + `evt_*`.
  2. **Evento** `evt_*` con **`tipo_evento_id`** → `cfg_tipo_evento` (no string libre) + `persona_id` + timestamp, si se complementa el patrón (1).
- El módulo Ticket **no** hardcodea la lista de tipos de solicitud que exigen DDJJ: lee **configuración** (p. ej. `cfg_tipo_ticket` con flags `requiere_ddjj_familiar` + estado mínimo requerido como FK a `cfg_estado_declaracion_ddjj`).

**Contrato sugerido `formacion_agente`** (id doc `for_<ULID>`; un vigente por `persona_id` en V2):

| Campo | Tipo | Texto / no | Seleccionable vía `cfg_*` | Notas |
|-------|------|----------------|---------------------------|--------|
| `formacion_id` | string | no (id técnico) | no | Igual al id del documento. |
| `persona_id` | string | no | no | FK `personas`. |
| `nivel_estudios_id` | string | no (es id) | **sí** → `cfg_nivel_estudios` | Obligatorio al `COMPLETO`. |
| `titulo_completo` | string | **texto libre** | no | Denominación del título. |
| `duracion_anios` | number | no | no | Años de cursado. |
| `institucion` | string | **texto libre** | no | Opcional. |
| `creado_en` / `actualizado_en` | Timestamp | no | no | Auditoría. |

### 2.2 Política anti-duplicidad (fuente de verdad única)

Objetivo: **ningún dato de negocio** vive en dos sitios editables; como mucho **id de documento** + FK, o **excepciones** abajo explícitas.

| Dato / concepto | Única fuente de verdad (SSoT) | Qué está **prohibido** en V2 |
|-----------------|-------------------------------|------------------------------|
| **Correo de acceso / “laboral”** | `usuarios_cuenta.username` (+ Auth) | Persistir `personas.contacto.email_laboral` u otro campo espejo del mismo valor. La ficha muestra el mail por **join** `persona_id` → cuenta. |
| **Formación (nivel, título, duración, institución)** | Colección **`formacion_agente`** (`for_*`), 1 doc vigente por `persona_id` | Objeto embebido `personas.formacion` (eliminado del contrato V2). |
| **Identidad titular (DNI, nombre, apellido)** | `personas` | Copiar en `declaraciones_grupo_familiar` como datos editables del titular; solo **`titular_*_snapshot`** al **cierre de envío** de la DDJJ (trazabilidad legal), no como SSoT. |
| **DNI, nombre, apellido (edición en portal)** | Solo **RRHH** / administración (proceso formal) | El **agente** no edita estos campos en la app; ver **§1.3** y **E1** en decisiones. |
| **Cambios de ficha editables por el agente** | `personas` (p. ej. domicilio, contacto, `foto_rostro`, …), `formacion_agente` | Tras el cambio, **toma de conocimiento RRHH** vía **`eventos_ticket`** y `tipo_evento_id` en `cfg_tipo_evento` (payload con referencias, **B6**). |
| **`persona_id` / `cuenta_id` / `declaracion_id` / `formacion_id`** | El **id del path** del documento (`per_*`, `usr_*`, `gf_*`, `for_*`) | Guardar un segundo identificador de negocio distinto (p. ej. otro ULID para la misma persona). Si el campo homónimo existe en el cuerpo del doc, debe ser **igual** al id del path y generarse por convención/trigger, no por entrada humana. |
| **`nombre_completo_legal`** | Opcional en `personas` | Persistirlo si es **redundante** con `nombre` + `apellido`; solo tiene sentido si **difiere legalmente** de la concatenación. |
| **Motivo de baja** | `motivo_baja_id` → `cfg_motivo_baja_persona` | Texto libre solo en `motivo_baja_detalle` opcional, no como sustituto del id. |

**Lecturas frecuentes:** si hace falta el email en listados de `personas`, usar **vista materializada**, **Cloud Function** de solo lectura o **join en API**; no segunda columna persistente en `personas` salvo decisión explícita de caché con TTL y invalidación (fuera del contrato base).

### 2.3 Esquema físico V2 — raíz, colecciones, campos y tipos (datos personales + cuenta)

**Raíz Firestore:** colecciones de **primer nivel** (no hay “un árbol por usuario”; cada doc lleva `persona_id` / `titular_persona_id` como FK).

| Colección | ID documento | Campos principales (nombre → tipo) |
|-------------|--------------|-------------------------------------|
| **`personas`** | `per_<ULID>` | `activo` boolean; `motivo_baja_id` string\|null **[C]**; `dni` string; `cuil` string\|null; `nombre`, `apellido` string; `nombre_completo_legal` string\|null; `fecha_nacimiento` Timestamp\|null; `lugar_nacimiento_id`, `nacionalidad_id`, `sexo_genero_id`, `estado_civil_id` string\|null; **`estado_perfil_datos_id`** string; `perfil_completitud_version` number; flags RRHH opcionales boolean/Timestamp/string; **`foto_rostro`** map opcional (Storage + auditoría, §3.12, **[P]**); **`contacto`** map (`email_personal`, `telefono_celular`, …); **`domicilio`** map; **`habilitacion_salud`**, **`habilitacion_enfermeria`** maps opcionales; `creado_en`, `actualizado_en` Timestamp; `schema_version` number. *(Sin `formacion` embebida; sin email laboral en persona.)* |
| **`formacion_agente`** | `for_<ULID>` | `persona_id` string; `nivel_estudios_id` string\|null; `titulo_completo` string; `duracion_anios` number\|null; `institucion` string\|null; timestamps. |
| **`declaraciones_grupo_familiar`** | `gf_<ULID>` | `titular_persona_id` string; `titular_cuenta_id` string\|null; `declaracion_version` number; **`estado_declaracion_id`** string; `declaracion_jurada_aceptada` boolean; `aceptada_en` Timestamp\|null; snapshots opcionales string; **`familiares`** array de mapas (cada ítem: `familiar_linea_id`, `parentesco_id`, nombres, `dni`, fechas, flags, **`estado_auditoria_familiar_id`** string, …). |
| **`consentimientos`** | `doc_<ULID>` | `persona_id`, `cuenta_id` string\|null; **`tipo_consentimiento_id`** string; `version_id`, `texto_hash` string; `aceptado` boolean; `aceptado_en` Timestamp; `ip_origen` string\|null; … |
| **`eventos_ticket`** | `evt_<ULID>` | **`tipo_evento_id`** string; `persona_id` string\|null; `payload` map; `actor_persona_id` string\|null; `ocurrido_en` Timestamp. |
| **`usuarios_cuenta`** *(módulo Login)* | `usr_<ULID>` | `persona_id` string; **`auth_uid`** string\|null (**`null`** solo antes de vincular Auth; ver §3.7 ítem 56); **`auth_proveedor_id`** string\|null; **`username`** string\|null (ver §3.7 ítem 58); `activo` boolean; **`estado_acceso`** string; **`role_ids`** array de string; timestamps. |

**`cfg_*` (configuración):** colecciones hermana(s) con documentos `{ id, … }` referenciados por todos los `*_id` de negocio (estados, tipos, catálogos geográficos, roles, textos legales, etc.).

### 2.4 Auditoría de campos (innecesarios, duplicidad, problemas, regla ID, módulo de configuración)

#### A) Campos redundantes o prescindibles

| Campo / situación | Motivo |
|-------------------|--------|
| **`persona_id`**, **`cuenta_id`**, **`consentimiento_id`**, **`declaracion_id`**, **`formacion_id`**, **`evento_id`** en el **cuerpo** del documento | Son **iguales al id del path** del mismo prefijo; la preferencia V2 es **no repetirlos** en el mapa (§2.2). Si Firestore/Rulebook exigen el campo, debe generarse por convención, no por entrada manual. |
| **Ítem #25** `contacto.email_laboral` | **Suprimido**; solo permanece en la lista §3 como **recordatorio** de que no debe existir en BD. |
| **`nombre_completo_legal`** | **Innecesario** si siempre equivale a `nombre` + `apellido`; solo aporta valor si difiere legalmente (§2.2). |
| **`lugar_nacimiento_texto`** si existe **`lugar_nacimiento_id`** | Riesgo de **doble verdad**; definir regla: o id, o texto, o texto solo como respaldo cuando id es null (producto). |
| **`historial_cambios`** embebido en `familiares[]` **y** filas en `eventos_ticket` | Posible **duplicación** de historia; preferir **solo `evt_*`** o solo array compacto, no ambos sin criterio. |
| **`titular_cuenta_id`** en DDJJ | A menudo **derivable** de la sesión al enviar; útil para auditoría, no SSoT del vínculo (ya está `titular_persona_id` → cuenta). |

#### B) Duplicidad de información (riesgo residual)

| Riesgo | Mitigación ya acordada |
|--------|-------------------------|
| Email en persona y en cuenta | **Eliminado** en V2 (solo `username`). |
| Formación en `personas` y en `formacion_agente` | **Eliminado** objeto embebido. |
| Titular en DDJJ vs `personas` | Solo **snapshots** al cierre, no edición paralela. |
| DNI/nombre del familiar vs titular | Son **entidades distintas**; no es duplicidad. |

#### C) Problemas / situaciones a cerrar en implementación

| Problema | Detalle |
|----------|---------|
| **`auth_uid`** vs primer login | **Definido en §3.7 ítem 56 y §5:** `null` permitido hasta vinculación con proveedor; **obligatorio no-null** tras vinculación (coherente con §2.1 / flujo Login). |
| **`habilitacion_salud.especialidad_id` / `colegio_id`** (texto paralelo) | **Definido en §4.6 y §9:** solo FK a `cfg_especialidad` / `cfg_colegio`; sin “catálogo o texto” ni nombre como sustituto del id. |
| **`idioma`** en `consentimientos` como string `es-AR` | Para alinear regla básica: evolucionar a **`idioma_id`** → `cfg_idioma` (o mantener string **solo** si se documenta como código BCP-47 técnico, no “estado de negocio”). |
| **`revocado`** boolean + `revocado_en` | Coherente; si en el futuro hay más estados de revocación, valorar **`estado_consentimiento_id`** en cfg en lugar de boolean. |
| **`payload`** en `eventos_ticket` | Debe contener **ids**, no copias grandes de documentos; riesgo de **duplicar** ficha entera si no se acota el contrato del map. |
| **`perfil_completitud_version`** (number) vs checklist en cfg | La **definición** de qué exige cada versión debería vivir en **configuración** (ej. `cfg_perfil_completitud_version` con lista de campos requeridos) para no hardcodear en app. *(Pendiente módulo configuración / producto.)* |

#### D) Regla básica “ID en todo”: qué ya cumple y qué conviene evolucionar

**Ya modelado como `*_id` → `cfg_*`:** `motivo_baja_id`, `estado_perfil_datos_id`, `sexo_genero_id`, `estado_civil_id`, `lugar_nacimiento_id`, `nacionalidad_id`, `nivel_estudios_id`, `parentesco_id`, `domicilio.localidad_id` / `provincia_id` / `pais_id`, `matricula_jurisdiccion_id`, `especialidad_id`, `colegio_id`, `tipo_consentimiento_id`, `estado_declaracion_id`, `estado_auditoria_familiar_id`, `tipo_evento_id`, `auth_proveedor_id`, `estado_acceso`, elementos de `role_ids`.

**Revisar / endurecer:** `idioma` → `idioma_id`; textos en habilitación que actúen como categoría; booleanos que en realidad son “estado” de negocio (`revocado`) si el hospital pide trazabilidad fina.

#### E) Campos **seleccionables** — alcance para el **módulo de configuración**

El desarrollador del módulo de configuración debe poder **CRUD** de documentos en cada colección (con versionado / publicación si aplica), **sin** re-deploy del portal para cambiar opciones.

| Colección `cfg_*` | Consumido por (campo) | Notas para el módulo |
|-------------------|-------------------------|----------------------|
| `cfg_estado_civil` | `personas.estado_civil_id` | Etiquetas sensibles; orden; posible inactivar valor sin borrar. |
| `cfg_nacionalidad` | `personas.nacionalidad_id` | |
| `cfg_nivel_estudios` | `formacion_agente.nivel_estudios_id` | |
| `cfg_parentesco` | `familiares[].parentesco_id` | |
| `cfg_localidad`, `cfg_provincia`, `cfg_pais` | `domicilio.*_id`, `lugar_nacimiento_id` | Jerarquía país→provincia→localidad; dependencias en UI. |
| **`cfg_sexo_genero`** *(o nombre acordado)* | `personas.sexo_genero_id` | Hoy el doc dice “`cfg_*`”; **nombrar** colección explícita en seeds. |
| `cfg_motivo_baja_persona` | `personas.motivo_baja_id` | |
| `cfg_estado_perfil_datos` | `personas.estado_perfil_datos_id` | Incluir flags meta en doc cfg: `permite_acceso_menu`, `exige_revisión`, etc., si el producto los usa. |
| `cfg_estado_cuenta_acceso` | `usuarios_cuenta.estado_acceso` | Transiciones válidas (grafo) opcional en cfg o en Rulebook. |
| `cfg_metodo_auth` | `usuarios_cuenta.auth_proveedor_id` | |
| `cfg_rol` | `usuarios_cuenta.role_ids[]` | Permisos agregados en otro doc si hace falta (`cfg_permiso` enlazado a rol). |
| `cfg_tipo_consentimiento` | `consentimientos.tipo_consentimiento_id` | |
| `cfg_textos_legales` (+ versiones) | `consentimientos.version_id`, hash | El texto mostrado sale de aquí; integridad con `texto_hash`. |
| **`cfg_idioma`** *(recomendado)* | `consentimientos.idioma` → migrar a `idioma_id` | Códigos `es-AR`, etc. |
| `cfg_estado_declaracion_ddjj` | `declaraciones_grupo_familiar.estado_declaracion_id` | Incluir estado “no iniciada” / omitida onboarding si aplica. |
| `cfg_estado_auditoria_familiar` | `familiares[].estado_auditoria_familiar_id` | |
| `cfg_tipo_evento` | `eventos_ticket.tipo_evento_id` | Catálogo ampliable (login, datos, DDJJ, consentimiento). |
| `cfg_colegio` | `habilitacion_*.colegio_id` | |
| **`cfg_especialidad`** | `habilitacion_salud.especialidad_id` | Eliminar alternativa “texto libre” en reglas. |
| **`cfg_jurisdiccion_matricula`** *(nombre tentativo)* | `habilitacion_salud.matricula_jurisdiccion_id` | Si hoy no existe, crear en cfg. |
| `cfg_requisitos_ticket` (+ tipos solicitud) | Módulo Ticket | Referencia FK a `cfg_estado_declaracion_ddjj` para prerequisitos. |

---

## 3. Detalle de cada campo (uno por uno)

A continuación, cada **nombre de campo** que la nueva base debe contemplar para el **módulo de datos personales**, con **dónde vive** (colección / objeto anidado), **tipo lógico** y **para qué sirve**. Los tipos se implementan en Firestore como `string`, `number`, `boolean`, `Timestamp`, `map`, `array`, según corresponda.

**Contrato V2 (persistencia):** estados y tipos enumerables van como **`*_id`** → `cfg_*` (§2). Los ítems **1–103** usan ya esos nombres finales salvo anotación explícita.

**Leyenda de marcas (obligatoriedad):**

| Marca | Significado |
|-------|-------------|
| **[O]** | **Obligatorio** en el contrato del módulo (no dar de alta / no cerrar perfil sin valor válido, salvo que el campo sea explícitamente nullable por diseño). |
| **[P]** | **Política de producto / hospital**: el equipo decide si es obligatorio en checklist; hasta entonces no forzar en esquema como `NOT NULL` lógico universal. |
| **[C]** | **Condicional**: obligatorio solo si se cumple otra condición (ej. `activo === false`, o `es_profesional === true`). |
| **[X]** | **Opcional**: puede quedar ausente o `null`. |
| **[R]** | **Recomendado**: no suele bloquear el primer alta, pero se espera en operación (informes, auditoría, UX). |

### 3.1 Colección `personas` — identidad, estado del perfil y metadatos

1. **[O]** **`persona_id`** — Raíz del documento `personas`. Tipo `string`. **Obligatorio** si se incluye en el cuerpo: debe ser **idéntico** al id del path `per_<ULID>`. *Preferencia V2:* usar solo el **document id** como `persona_id` en APIs y **omitir** el campo duplicado en el mapa si las reglas de acceso lo permiten.

2. **[O]** **`activo`** — Raíz. Tipo `boolean`. **Obligatorio.** Indica si la persona está habilitada en el sistema. En `false` la ficha sigue existiendo (historial, auditoría, vínculos viejos); no se borra el documento.

3. **[C]** **`motivo_baja_id`** — Raíz. Tipo `string` o `null`. **Condición:** obligatorio si `activo === false`; si `activo === true`, `null`. FK **`cfg_motivo_baja_persona`**. Texto libre adicional solo si negocio lo exige en campo aparte `motivo_baja_detalle` **[X]** (no sustituye al id).

4. **[O]** **`dni`** — Raíz. Tipo `string`. **Obligatorio.** Documento nacional de identidad del agente. Debe guardarse en **formato normalizado** (por convención: solo dígitos, sin puntos). Es dato de negocio e integración; **no** sustituye al `persona_id` técnico. La unicidad se exige solo entre personas `activo === true`.

5. **[R]** **`cuil`** — Raíz. Tipo `string` o `null`. *Recomendado.* CUIL AR; validar dígitos verificadores si está presente. **No obligatorio** para `COMPLETO` salvo norma interna RRHH.

6. **[O]** **`nombre`** — Raíz. Tipo `string`. **Obligatorio.** Nombre(s) de pila como figuran en la identidad del agente.

7. **[O]** **`apellido`** — Raíz. Tipo `string`. **Obligatorio.** Apellido(s).

8. **[R]** **`nombre_completo_legal`** — Raíz. Tipo `string` o `null`. *Recomendado.* Nombre completo tal como debe figurar en documentos oficiales cuando no basta con `nombre` + `apellido` (compuestos, orden legal). Si el producto decide que siempre se deriva en lectura, puede omitirse en BD.

9. **[O]** **`fecha_nacimiento`** — Raíz. Tipo `Timestamp` o `null`. **Obligatorio al perfil `COMPLETO`**. Fecha de nacimiento; permite calcular edad, mayoría de edad y reglas de artículos que dependan de edad. En fases previas puede ser `null`.

10. **[X]** **`lugar_nacimiento_id`** — Raíz. Tipo `string` o `null`. Opcional. Referencia a catálogo (`cfg_localidad` u otro) si el nacimiento se codifica cerrado.

11. **[X]** **`lugar_nacimiento_texto`** — Raíz. Tipo `string` o `null`. Opcional. Texto del lugar de nacimiento si no hay catálogo o como respaldo.

12. **[X]** **`nacionalidad_id`** — Raíz. Tipo `string` o `null`. Opcional. Referencia a `cfg_nacionalidad`.

13. **[O]** **`sexo_genero_id`** — Raíz. Tipo `string` o `null`. **Obligatorio al perfil `COMPLETO`**. Selección desde catálogo del **módulo de configuración** (`cfg_*`). En fases previas puede ser `null`.

14. **[O]** **`estado_civil_id`** — Raíz. Tipo `string` o `null`. **Obligatorio al perfil `COMPLETO`**. Selección desde **`cfg_estado_civil`**. En fases previas puede ser `null`.

15. **[O]** **`estado_perfil_datos_id`** — Raíz. Tipo `string`. **Obligatorio.** FK **`cfg_estado_perfil_datos`**: completitud / validez de la ficha personal. Las etiquetas (`BORRADOR`, `COMPLETO`, …) viven solo en cfg. No confundir con estados de ticket.

16. **[O]** **`perfil_completitud_version`** — Raíz. Tipo `number`. **Obligatorio.** Versión del “checklist” obligatorio de datos personales; si RRHH sube requisitos, se incrementa y se puede forzar re-carga de datos.

17. **[X]** **`perfil_validado_por_rrhh`** — Raíz. Tipo `boolean` o `null`. Opcional. Indica si RRHH dio conformidad a la ficha personal.

18. **[X]** **`perfil_validado_en`** — Raíz. Tipo `Timestamp` o `null`. Opcional. Momento de esa validación.

19. **[X]** **`perfil_validado_por_persona_id`** — Raíz. Tipo `string` o `null`. Opcional. `persona_id` del operador RRHH que validó.

20. **[O]** **`creado_en`** — Raíz. Tipo `Timestamp`. **Obligatorio.** Momento de creación del registro persona.

21. **[X]** **`creado_por`** — Raíz. Tipo `string` o `null`. Opcional. `persona_id` quien creó el registro o constante `SISTEMA`.

22. **[O]** **`actualizado_en`** — Raíz. Tipo `Timestamp`. **Obligatorio.** Última modificación de cualquier campo del documento (o política de “touch” acordada).

23. **[X]** **`actualizado_por`** — Raíz. Tipo `string` o `null`. Opcional. Quién realizó el último cambio.

24. **[O]** **`schema_version`** — Raíz. Tipo `number`. **Obligatorio.** Versión del esquema de este documento para migraciones controladas de estructura.

### 3.2 Colección `personas` — objeto `contacto`

25. **[X]** **`contacto.email_laboral`** — **Suprimido en V2 (no persistir).** El correo institucional de la ficha se muestra leyendo **`usuarios_cuenta.username`** vía `persona_id` (anti-duplicidad, ver §2.2 y [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §2).

26. **[X]** **`contacto.email_personal`** — Tipo `string` o `null`. Opcional. Correo personal de contacto.

27. **[P]** **`contacto.telefono_celular`** — Tipo `string`. *Política (usualmente obligatorio para completar perfil).* Móvil con formato acordado (E.164 o prefijo AR).

28. **[X]** **`contacto.telefono_fijo`** — Tipo `string` o `null`. Opcional. Teléfono fijo.

29. **[X]** **`contacto.recibe_notificaciones_sms`** — Tipo `boolean`. Opcional. Preferencia de notificación; por defecto `false` si no hay canal SMS.

### 3.3 Colección `personas` — objeto `domicilio`

30. **[P]** **`domicilio.calle`** — Tipo `string`. *Política / completitud de perfil:* suele ser obligatoria al dar por completa la ficha. Calle del domicilio de notificación o legal.

31. **[P]** **`domicilio.numero`** — Tipo `string`. *Idem.* Altura / número de puerta (puede incluir letra bis según convención local).

32. **[X]** **`domicilio.piso`** — Tipo `string` o `null`. Opcional.

33. **[X]** **`domicilio.departamento`** — Tipo `string` o `null`. Opcional. Unidad habitacional / departamento.

34. **[P]** **`domicilio.codigo_postal`** — Tipo `string`. *Idem completitud.* Código postal.

35. **[X]** **`domicilio.localidad_id`** — Tipo `string` o `null`. Opcional. FK a catálogo de localidad.

36. **[X]** **`domicilio.provincia_id`** — Tipo `string` o `null`. Opcional. FK a provincia.

37. **[X]** **`domicilio.pais_id`** — Tipo `string` o `null`. Opcional. FK a país; por defecto puede setearse el país del hospital.

38. **[X]** **`domicilio.referencia`** — Tipo `string` o `null`. Opcional. Indicaciones para ubicar el domicilio (“frente a plaza”, etc.).

### 3.4 Colección `formacion_agente` (no embebida en `personas`)

Los ítems 39–42 viven en el documento **`formacion_agente/{for_*}`** con FK `persona_id` → `personas`. **No** existen campos `personas.formacion.*` en V2 (§2.2).

39. **[O]** **`formacion_agente.nivel_estudios_id`** — Tipo `string` o `null`. **Obligatorio al perfil `COMPLETO`**. Selección desde **`cfg_nivel_estudios`**. En fases previas puede ser `null`.

40. **[P]** **`formacion_agente.titulo_completo`** — Tipo `string`. *Política (casi siempre obligatorio en completar perfil).* Denominación del título o carrera completada.

41. **[P]** **`formacion_agente.duracion_anios`** — Tipo `number` o `null`. *Política.* Duración del cursado en años (número, no string ambiguo).

42. **[X]** **`formacion_agente.institucion`** — Tipo `string` o `null`. Opcional. Casa de estudios (universidad, instituto).

### 3.5 Colección `personas` — objeto `habilitacion_salud`

43. **[C]** **`habilitacion_salud.es_profesional`** — Tipo `boolean`. Obligatorio **si el objeto `habilitacion_salud` está presente** en el documento. Si es `false`, el resto del bloque se ignora o no se persiste.

44. **[C]** **`habilitacion_salud.titulo_habilitante`** — Tipo `string` o `null`. Obligatorio si `es_profesional === true`. Título habilitante para ejercicio (médico, bioquímico, etc., según negocio).

45. **[C]** **`habilitacion_salud.matricula_numero`** — Tipo `string` o `null`. Obligatorio si `es_profesional === true`. Número de matrícula.

46. **[X]** **`habilitacion_salud.matricula_jurisdiccion_id`** — Tipo `string` o `null`. Opcional. FK **`cfg_jurisdiccion_matricula`** (u homónimo en configuración).

47. **[X]** **`habilitacion_salud.especialidad_id`** — Tipo `string` o `null`. Opcional. FK **`cfg_especialidad`** si se declara especialidad; sin texto libre paralelo.

48. **[X]** **`habilitacion_salud.colegio_id`** — Tipo `string` o `null`. Opcional. FK **`cfg_colegio`**.

### 3.6 Colección `personas` — objeto `habilitacion_enfermeria`

49. **[C]** **`habilitacion_enfermeria.es_enfermero_profesional`** — Tipo `boolean`. Obligatorio **si el objeto `habilitacion_enfermeria` está presente**. Activa el sub-bloque de enfermería (separado de `habilitacion_salud`).

50. **[C]** **`habilitacion_enfermeria.titulo`** — Tipo `string` o `null`. Obligatorio si `es_enfermero_profesional === true`.

51. **[C]** **`habilitacion_enfermeria.universidad`** — Tipo `string` o `null`. Obligatorio si `es_enfermero_profesional === true`.

52. **[C]** **`habilitacion_enfermeria.matricula_numero`** — Tipo `string` o `null`. Obligatorio si `es_enfermero_profesional === true`. Matrícula de enfermería (distinta de `habilitacion_salud`).

53. **[C]** **`habilitacion_enfermeria.colegio_id`** — Tipo `string` o `null`. Obligatorio si `es_enfermero_profesional === true`. Colegio de matriculación de enfermería.

### 3.7 Colección `usuarios_cuenta` (vínculo login ↔ persona; necesaria para el flujo del módulo)

*Resumen en el plan de Login:* [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§3.1** (misma tabla de campos).

54. **[O]** **`cuenta_id`** — Raíz. Tipo `string`. **Obligatorio** si se incluye en el cuerpo: debe ser **idéntico** al id del path `usr_<ULID>`. *Preferencia V2:* usar solo el **document id** y **omitir** este campo (§2.2).

55. **[O]** **`persona_id`** — Raíz. Tipo `string`. **Obligatorio.** FK a la ficha en `personas`; es el mismo “usuario del sistema” que referencian laboral y ticket.

56. **[C]** **`auth_uid`** — Raíz. Tipo `string` o `null`. **Condición:** puede ser **`null`** mientras la cuenta exista en estados previos a la vinculación con el proveedor de identidad (p. ej. `estado_acceso` = pendiente registro / onboarding sin Auth). **Obligatorio no-null** una vez vinculada la cuenta al proveedor (post primer login / §4.2 según [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md)). La ancla de negocio sigue siendo `persona_id`.

57. **[X]** **`auth_proveedor_id`** — Raíz. Tipo `string` o `null`. Opcional. FK **`cfg_metodo_auth`** (p. ej. password, OIDC Microsoft). **No** persistir string libre de proveedor salvo excepción acordada por **RFC** y solo en el **ciclo de vida de datos V2** (no confundir con datos de la V1).

58. **[C]** **`username`** — Raíz. Tipo `string` o `null`. **Condición:** **`null`** (o ausente) solo entre **alta RRHH (paso A)** y **registro de credenciales (paso B)**; desde el fin del paso B, **obligatorio no-null** y único como correo de acceso (**fuente de verdad**; no hay copia en `personas`). Ver [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §2–§3.1 y [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) **§11**.

59. **[O]** **`activo`** — Raíz (cuenta). Tipo `boolean`. **Obligatorio.** Habilita o bloquea el acceso sin borrar la cuenta. En el **mismo documento** **`estado_acceso`** **[O]** (tipo `string`, FK **`cfg_estado_cuenta_acceso`**: pendiente registro, onboarding datos, activo portal, bloqueado, …; ver [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §5).

60. **[O]** **`creado_en` / `actualizado_en`** — Raíz. Tipo `Timestamp`. **Obligatorios.** Auditoría de vida de la cuenta.

61. **[P]** **`role_ids`** — Raíz. Tipo `array` de `string`. Cada elemento FK **`cfg_rol`** (u homónimo). **Prohibido** map opaco de flags sin ids estables. Política de asignación: módulo administración / Rulebook.

### 3.8 Colección `consentimientos`

62. **[O]** **`consentimiento_id`** — Raíz. Tipo `string`. **Obligatorio.** Id del documento `doc_<ULID>`.

63. **[O]** **`persona_id`** — Raíz. Tipo `string`. **Obligatorio.** Sobre quién recae el consentimiento (titular).

64. **[X]** **`cuenta_id`** — Raíz. Tipo `string` o `null`. Opcional. Si la aceptación ocurrió en sesión autenticada.

65. **[O]** **`tipo_consentimiento_id`** — Raíz. Tipo `string`. **Obligatorio.** FK **`cfg_tipo_consentimiento`** (DDJJ datos personales, tratamiento, términos app, …). Las etiquetas solo en cfg.

66. **[O]** **`version_id`** — Raíz. Tipo `string`. **Obligatorio.** Versión del texto legal aceptado (enlace a `cfg_textos_legales` o semver).

67. **[O]** **`texto_hash`** — Raíz. Tipo `string`. **Obligatorio.** Hash del texto mostrado (p. ej. SHA-256) para prueba de integridad.

68. **[X]** **`idioma`** — Raíz. Tipo `string` o `null`. Opcional. Idioma del texto aceptado (p. ej. `es-AR`). *Evolución recomendada:* **`idioma_id`** → `cfg_idioma` para cumplir regla id-only en todo lo seleccionable.

69. **[O]** **`aceptado`** — Raíz. Tipo `boolean`. **Obligatorio.** Debe ser `true` en registros de aceptación válidos.

70. **[O]** **`aceptado_en`** — Raíz. Tipo `Timestamp`. **Obligatorio.** Momento de la aceptación.

71. **[P]** **`ip_origen`** — Raíz. Tipo `string` o `null`. *Política / legal.* Solo si está permitido almacenar IP.

72. **[X]** **`user_agent`** — Raíz. Tipo `string` o `null`. Opcional. Navegador o cliente para auditoría.

73. **[X]** **`revocado`** — Raíz. Tipo `boolean`. Opcional. Si el marco legal permite revocación explícita.

74. **[C]** **`revocado_en`** — Raíz. Tipo `Timestamp` o `null`. Obligatorio si `revocado === true` y se modela revocación; si no hay revocación, puede omitirse o ser `null`.

### 3.9 Colección `declaraciones_grupo_familiar` — documento titular

75. **[O]** **`declaracion_id`** — Raíz. Tipo `string`. **Obligatorio.** Igual al id `gf_<ULID>`.

76. **[O]** **`titular_persona_id`** — Raíz. Tipo `string`. **Obligatorio.** Agente que declara el grupo familiar.

77. **[X]** **`titular_cuenta_id`** — Raíz. Tipo `string` o `null`. Opcional. Cuenta desde la que se envió la declaración.

78. **[O]** **`declaracion_version`** — Raíz. Tipo `number`. **Obligatorio.** Número de versión de la declaración ante reenvíos sustanciales.

79. **[O]** **`estado_declaracion_id`** — Raíz. Tipo `string`. **Obligatorio.** FK **`cfg_estado_declaracion_ddjj`**. Estado global del trámite DDJJ.

80. **[O]** **`declaracion_jurada_aceptada`** — Raíz. Tipo `boolean`. **Obligatorio.** Que el titular marcó aceptación del texto de la declaración.

81. **[C]** **`aceptada_en`** — Raíz. Tipo `Timestamp` o `null`. Obligatorio si `declaracion_jurada_aceptada === true`; si no aceptó, `null`.

82. **[O]** **`creado_en` / `actualizado_en`** — Raíz. Tipo `Timestamp`. **Obligatorios.** Auditoría del documento.

83. **[X]** **`titular_dni_snapshot`** / **`titular_nombre_snapshot`** — Raíz. Tipo `string` o `null`. Opcionales. Copia al cierre de envío **solo** para trazabilidad; no son fuente de verdad (el SSoT sigue en `personas`).

### 3.10 Colección `declaraciones_grupo_familiar` — cada elemento de `familiares[]`

84. **[O]** **`familiar_linea_id`** — Dentro del ítem. Tipo `string`. **Obligatorio.** `fml_<ULID>` estable para actualizar un familiar sin reemplazar todo el array.

85. **[O]** **`parentesco_id`** — Tipo `string`. **Obligatorio.** Relación con el titular; FK `cfg_parentesco`.

86. **[O]** **`nombre`** — Tipo `string`. **Obligatorio.** Nombre del familiar.

87. **[O]** **`apellido`** — Tipo `string`. **Obligatorio.** Apellido del familiar.

88. **[P]** **`dni`** — Tipo `string` o `null`. *Política.* Puede ser obligatorio salvo menores u otros casos definidos por negocio.

89. **[P]** **`fecha_nacimiento`** — Tipo `Timestamp` o `null`. *Política.* Para edad y vínculo con artículos (p. ej. hijo menor).

90. **[X]** **`convive`** — Tipo `boolean` o `null`. Opcional. Si convive con el titular.

91. **[X]** **`dependiente`** — Tipo `boolean` o `null`. Opcional. Si se considera dependiente a fines internos.

92. **[P]** **`discapacidad_declarada`** — Tipo `boolean` o `null`. *Política / sensible.* Solo si el reglamento lo exige; si no aplica, `null`.

93. **[X]** **`notas_titular`** — Tipo `string` o `null`. Opcional. Aclaraciones del titular.

94. **[X]** **`adjuntos`** — Tipo `array` de objetos. Opcional. Evidencia documental (`storage_path`, `doc_id`, `subido_en`, etc.).

95. **[O]** **`estado_auditoria_familiar_id`** — Tipo `string`. **Obligatorio.** FK **`cfg_estado_auditoria_familiar`** (revisión, aceptado, rechazado, … por ítem de `familiares[]`).

96. **[R]** **`historial_cambios`** — Tipo `array` de mapas o refs. Recomendado. Historial de cambios de estado o referencias a `evt_`.

### 3.11 Colección `eventos_ticket` (uso típico del módulo datos personales)

97. **[O]** **`evento_id`** — Raíz. Tipo `string`. **Obligatorio.** `evt_<ULID>`.

98. **[O]** **`tipo_evento_id`** — Raíz. Tipo `string`. **Obligatorio.** FK **`cfg_tipo_evento`** (p. ej. persona datos actualizados, consentimiento aceptado, cambio estado DDJJ).

99. **[C]** **`persona_id`** — Raíz. Tipo `string` o `null`. Sujeto u objeto del evento según `tipo_evento_id`; puede ser `null` en eventos puramente de sistema.

100. **[O]** **`payload`** — Raíz. Tipo `map`. **Obligatorio.** Detalle mínimo acordado (diff, ids afectados, valores viejos/nuevos selectivos).

101. **[X]** **`actor_persona_id`** — Raíz. Tipo `string` o `null`. Quién realizó la acción (o `null` si fue el sistema).

102. **[O]** **`ocurrido_en`** — Raíz. Tipo `Timestamp`. **Obligatorio.** Cuándo ocurrió el evento.

### 3.12 Colección `personas` — mapa `foto_rostro` (registro / onboarding)

103. **[P]** **`foto_rostro`** — Raíz. Tipo `map` \| `null`. *Política* (decisión **E5**, [`DECISIONES…`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) §E). Foto de rostro asociada a la ficha: en el flujo de **onboarding (paso C)** el usuario puede **capturar** con la **cámara** del dispositivo o **adjuntar** un archivo de imagen. Mientras el mapa sea `null`, no hay foto persistida. Cuando el mapa está presente, estructura mínima:
   - **`storage_path`** (string) — Ruta u objeto al archivo en **Firebase Storage** (o equivalente), con prefijos de ruta acordados por `persona_id` y reglas de seguridad.
   - **`subido_en`** (Timestamp) — Momento de carga o último reemplazo.
   - **`content_type`** (string, **[X]**) — MIME, p. ej. `image/jpeg`, `image/png`.
   - **`origen_captura`** (string, **[X]**) — P. ej. `camara` \| `adjunto` (o, si se formaliza, `origen_captura_id` → `cfg_*`).

Obligatoriedad al perfil `COMPLETO` y reglas (tamaño, recorte, DPI) = **checklist de hospital**; ver **lista P 18** abajo. **Cada sustitución** de imagen con relevancia para legajo puede disparar el mismo criterio de **toma de conocimiento RRHH** que otras ediciones de ficha (**§1.3**).

### Resumen de marcas (ítems 1–103)

| Marca | Cantidad | Rol |
|-------|----------|-----|
| **[O]** | 40 | Obligatorio en el contrato del módulo (valor válido o `null` solo si el diseño del campo lo permite explícitamente). |
| **[P]** | 12 | Política de producto / hospital: fijar en checklist de RRHH o gobierno de datos. |
| **[C]** | 14 | Condicional: depende de otro campo, presencia de un objeto o estado del trámite. |
| **[X]** | 34 | Opcional. |
| **[R]** | 3 | Recomendado (no bloquea alta típica; deseable para informes o auditoría). |
| **Total** | **103** | |

> **Nota:** Los catálogos `cfg_*` (estado civil, parentesco, textos legales, etc.) son **colecciones de configuración**; no duplican aquí cada campo de catálogo, solo se referencian por `*_id` desde este módulo.

### Definición de campos **[P]** (lista P 1–10) — *acuerdo 22/04/2026*

Corresponde al **lote inicial** de decisiones de producto (refs. históricas **#5, #9, #13, #14, #25, #27, #30, #31, #34, #39** en la lista 3). Tras el acuerdo: **#9, #13, #14 y #39** quedan como **[O]** al perfil `COMPLETO` (con `cfg_*` donde aplica); **#5** es **[R]** (CUIL); **#25** quedó **suprimido** (email solo en `usuarios_cuenta`, §2.2). Los ítems **P 11–17** amplían formación en **`formacion_agente`**, cuenta, consentimientos y familiares; el ítem **P 18** corresponde a **foto de rostro** (**`personas.foto_rostro`**, ver §3.12 y **E5**).

> **Nota:** La “lista P” es una **checklist de producto** numerada para reuniones; no tiene que coincidir 1:1 con la cantidad de campos marcados **[P]** en la sección 3 (esa marca sigue siendo técnica por campo).

| # lista | Campo | Decisión de producto (V2) | Validación / reglas | Login / contacto |
|---------|--------|---------------------------|----------------------|-------------------|
| **1** | `personas.cuil` | **Recomendado** al completar ficha; **no obligatorio** para declarar `COMPLETO` salvo que RRHH lo exija por norma interna. Si se informa, validar CUIL AR. | 11 dígitos + verificador. | No es credencial. |
| **2** | `personas.fecha_nacimiento` | **Obligatorio al perfil `COMPLETO`**. Antes puede ser `null`. *(Sin cambio.)* | Fecha plausible; edad mínima si aplica. | Salvo regla explícita en login, no bloquea acceso. |
| **3** | `personas.sexo_genero_id` | **Obligatorio** al perfil `COMPLETO` (y en flujos que exijan ficha completa). Valor **seleccionable**; opciones desde **módulo de configuración** (`cfg_*`). | FK a catálogo configurado. | No afecta login. |
| **4** | `personas.estado_civil_id` | **Igual que el ítem 3:** obligatorio al `COMPLETO`, selección desde **configuración**. | FK `cfg_estado_civil`. | No afecta login. |
| **5** | Correo institucional / acceso | **Una sola fuente:** `usuarios_cuenta.username`. **No** hay campo en `personas`; la ficha lo muestra por **join** `persona_id` → cuenta (§2.2). Edición solo **Login**. | Formato email; minúsculas. | [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) §2. |
| **6** | `personas.contacto.telefono_celular` | **Obligatorio al `COMPLETO`**. *(Sin cambio.)* | E.164 o prefijo AR. | Recuperación SMS si login lo define. |
| **7–9** | `domicilio.calle`, `numero`, `codigo_postal` | **Obligatorios al `COMPLETO`**. *(Sin cambio.)* | Como ya documentado. | No afectan login. |
| **10** | `formacion_agente.nivel_estudios_id` | **Igual que ítems 3 y 4:** obligatorio al `COMPLETO`, valor desde **configuración** (`cfg_nivel_estudios`). | FK catálogo. | No afecta login. |

**Resumen:** CUIL **recomendado**; fecha + domicilio 7–9 **obligatorios al `COMPLETO`** como antes; **sexo/género, estado civil y nivel de estudios obligatorios al `COMPLETO`** con listas en configuración; **email único** solo en **`usuarios_cuenta`** (sin copia en `personas`). El **módulo Login** sigue definiendo acceso y **`estado_acceso`**.

### Definición de campos **[P]** (lista P 11–17) — *propuesta 22/04/2026 (revisable)*

| P# | Ref. lista §3 | Campo | Decisión de producto (V2) | Validación / reglas | Otros módulos |
|----|-----------------|--------|---------------------------|----------------------|---------------|
| **11** | 40 | `formacion_agente.titulo_completo` | **Política de completitud:** en la práctica **obligatorio al `COMPLETO`** para perfiles que declaran formación (no “título vacío” si el checklist exige nivel de estudios). RRHH puede relajar por categoría de agente en una versión futura del checklist. | Texto razonable; longitud máxima acordada. | No afecta login. |
| **12** | 41 | `formacion_agente.duracion_anios` | **Política:** **recomendado** al `COMPLETO` si aplica al título declarado; puede ser `null` si el hospital no lo exige en el checklist. | Entero ≥ 0; techo razonable (p. ej. ≤ 20). | No afecta login. |
| **13** | 61 | `usuarios_cuenta.role_ids` | **Fuera del alcance detallado de datos personales:** lista de FK a **`cfg_rol`**. Asignación en **Rulebook / administración**. | Array de ids válidos. | **Login** lee para UI/claims. |
| **14** | 71 | `consentimientos.ip_origen` | **Política legal / PDP:** persistir IP **solo** si base legal + aviso en TyC lo permiten; si no, campo siempre `null` y no se muestra en UI de aceptación como obligatorio. | Formato string normalizado (IPv4/IPv6) o `null`. | Alineado a texto en `cfg_textos_legales` y abogacía. |
| **15** | 88 | `declaraciones_grupo_familiar.familiares[].dni` | **Política:** obligatorio **salvo** menores u otras excepciones que fije RRHH (edad límite, “DNI en trámite”, etc.). Si es obligatorio, mismo criterio de normalización que `personas.dni` (solo dígitos). | DNI AR; validar según reglas de menores. | **Ticket / auditoría** del trámite familiar. |
| **16** | 89 | `declaraciones_grupo_familiar.familiares[].fecha_nacimiento` | **Política:** **recomendado u obligatorio según checklist** del trámite (necesario para artículos por edad / hijo menor). Si el titular no declara grupo, no aplica. | Fecha plausible; coherencia con `parentesco_id`. | Artículos de laboral / ticket pueden leer solo estado aceptado de la DDJJ. |
| **17** | 92 | `declaraciones_grupo_familiar.familiares[].discapacidad_declarada` | **Política sensible:** capturar **solo** si reglamento interno o artículo lo exige; en caso contrario **no** mostrar en UI o dejar siempre `null`. Si se captura, minimizar datos (boolean; sin detalle clínico en este módulo). | `boolean` o `null` únicamente. | Revisión con **privacidad / RRHH** antes de exigirlo en checklist. |

**Resumen P 11–17:** título de formación alineado al `COMPLETO` con flexibilidad por checklist; duración en años opcional según hospital; **roles** delegados a convención de cuenta + módulo de seguridad; **IP** en consentimientos solo con marco legal; en **familiares**, DNI/fecha/discapacidad gobernados por política de menores y sensibilidad, no por el contrato genérico de `personas`.

### Definición de campos **[P]** (lista P 18) — *acuerdo 23/04/2026*

| P# | Ref. lista §3 | Campo | Decisión de producto (V2) | Validación / reglas | Otros módulos |
|----|-----------------|--------|---------------------------|----------------------|---------------|
| **18** | 103 | `personas.foto_rostro` | **Política (E5):** ficha con opción de **foto de rostro** en registro/onboarding; **cámara** o **adjunto**. Si RRHH exige foto al `COMPLETO`, el checklist vincula a este mapa; si no, puede ser opcional aun con perfil completo. | Tamaño máximo, formatos, posible compresión en cliente; ruta bajo `persona_id` en Storage. Toma de conocimiento en cambios: **E1** / `evt_*`. | **ACCESO_Y_RULES** para escritura a Storage. |

**Resumen P 18:** se suma a las listas anteriores sin redefinir **[P] 1–10**; obligatoriedad de subir o no foto al cierre de onboarding la define el **hospital** (checklist con RRHH).

---

## 4. Catálogo normativo — Colección `personas`

**ID del documento:** `per_<ULID>`. Es el **`persona_id`** que referencian el resto de colecciones. *Preferencia V2:* no duplicar ese valor como campo interno salvo necesidad técnica de query (§2.2).

Cada documento representa **una persona física** (agente / titular), independiente de si tiene o no cuenta de login.

### 4.1 Identidad civil y nombres

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `persona_id` | string | opcional\* | Si existe en el cuerpo, = id del path. \*Preferir solo `documentId`. |
| `activo` | boolean | sí | `true` = persona usable en el sistema; `false` = baja lógica (mantiene historial y `persona_id`). |
| `motivo_baja_id` | string \| null | si `activo=false` | FK `cfg_motivo_baja_persona`. |
| `motivo_baja_detalle` | string \| null | no | Texto libre opcional; **no** sustituye al id. |
| `dni` | string | sí | Documento nacional; almacenar **solo dígitos** o formato normalizado único acordado (sin puntos). |
| `cuil` | string \| null | recomendado | Identificación fiscal AR; validar dígitos verificadores en capa de dominio. **No** exigido para declarar `COMPLETO` salvo norma interna RRHH. |
| `nombre` | string | sí | Primer nombre o nombres de pila; reglas de mayúsculas en UI, no en BD obligatoriamente. |
| `apellido` | string | sí | Apellido(s). |
| `nombre_completo_legal` | string \| null | recomendado | Texto oficial si difiere de concatenación (casos compuestos, orden legal). Si no aplica, puede calcularse en lectura y no persistirse (decisión de producto). |
| `fecha_nacimiento` | Timestamp \| null | sí† | Edad, mayoría, validaciones de artículos. |
| `lugar_nacimiento_id` | string \| null | no | Referencia opcional a `cfg_localidad` o texto libre según política. |
| `lugar_nacimiento_texto` | string \| null | no | Si no hay catálogo cerrado. |
| `nacionalidad_id` | string \| null | no | Ref a `cfg_nacionalidad`. |
| `sexo_genero_id` | string \| null | sí† | Obligatorio al perfil `COMPLETO`. Valor seleccionable; catálogo en **módulo de configuración** (`cfg_*`). |
| `estado_civil_id` | string \| null | sí† | Obligatorio al perfil `COMPLETO`. Ref `cfg_estado_civil`. |

†Campos marcados **sí†** son obligatorios cuando el checklist de completitud exige perfil `COMPLETO` (según `estado_perfil_datos_id` y `perfil_completitud_version`).

### 4.1.1 Foto de rostro (mapa `foto_rostro` en `personas`)

Criterio completo: **ítem 103** (§3.12) y **E5** en decisiones. Resumen: objeto opcional; si existe, al menos **`storage_path`** (Storage) y **`subido_en`**. Carga en onboarding o después; cámara o adjunto. Obligatoriedad al `COMPLETO` = **lista P 18**.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `foto_rostro` | map \| null | no\* | `null` = sin foto. Ver claves internas en §3.12. |
| `foto_rostro.storage_path` | string | si hay mapa | Ruta/URL lógica al binario; reglas de Storage. |
| `foto_rostro.subido_en` | Timestamp | si hay mapa | Carga o último reemplazo. |
| `foto_rostro.content_type` | string \| null | no | MIME. |
| `foto_rostro.origen_captura` | string \| null | no | `camara` \| `adjunto` o equivalente. |

\*Obligatoriedad del **bloque entero** al `COMPLETO` según **P 18**; las claves internas del mapa rigen cuando el mapa no es `null`.

### 4.2 Estado del perfil de datos (solo módulo persona)

Distinto del estado de un ticket. Indica si la ficha personal cumple políticas de completitud.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `estado_perfil_datos_id` | string | sí | FK `cfg_estado_perfil_datos`. |
| `perfil_completitud_version` | number | sí | Incrementar cuando cambie el checklist obligatorio (permite saber quién quedó “viejo”). |
| `perfil_validado_por_rrhh` | boolean \| null | no | Si RRHH debe “cerrar” ficha; opcional según proceso. |
| `perfil_validado_en` | Timestamp \| null | no | Cuándo RRHH validó. |
| `perfil_validado_por_persona_id` | string \| null | no | Quién validó (persona con rol RRHH). |

### 4.3 Contacto laboral y personal (objeto `contacto`)

Un solo objeto embebido para la **vigencia actual**. Si más adelante se requiere historial de domicilios, se agrega subcolección `personas/{id}/contactos_historicos` sin romper este contrato.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `contacto.email_personal` | string \| null | no | Correo personal. El correo de **acceso / institucional** no se guarda aquí: **`usuarios_cuenta.username`** (join por `persona_id`, §2.2). |
| `contacto.telefono_celular` | string | sí\* | Formato E.164 o prefijo + número según estándar AR. |
| `contacto.telefono_fijo` | string \| null | no | |
| `contacto.recibe_notificaciones_sms` | boolean | no | Preferencias; default false si no hay canal. |

\*Obligatoriedad sujeta a reglas de negocio del hospital.

### 4.4 Domicilio legal / de notificación (objeto `domicilio`)

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `domicilio.calle` | string | sí\* | vía pública. |
| `domicilio.numero` | string | sí\* | Puerta; puede incluir bis/departamento en convención local. |
| `domicilio.piso` | string \| null | no | |
| `domicilio.departamento` | string \| null | no | |
| `domicilio.codigo_postal` | string | sí\* | |
| `domicilio.localidad_id` | string \| null | no | Ref `cfg_localidad` si existe. |
| `domicilio.provincia_id` | string \| null | no | Ref `cfg_provincia`. |
| `domicilio.pais_id` | string \| null | no | Default país si aplica. |
| `domicilio.referencia` | string \| null | no | Texto libre corto (“portón verde”). |

\*Según `estado_perfil_datos_id` y reglas de completitud.

### 4.5 Formación (fuera de `personas`)

En V2 **no** hay objeto `personas.formacion`. Toda la formación académica general está en la colección **`formacion_agente`** (§2.1 contrato y §4.9).

### 4.6 Habilitación profesional de salud (objeto `habilitacion_salud`, opcional)

Solo aplica si la persona ejerce como profesional de salud con matrícula.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `habilitacion_salud.es_profesional` | boolean | sí | `false` = resto del objeto ignorado o ausente. |
| `habilitacion_salud.titulo_habilitante` | string \| null | si es profesional | Título legal de matriculación. |
| `habilitacion_salud.matricula_numero` | string \| null | si es profesional | Número de matrícula. |
| `habilitacion_salud.matricula_jurisdiccion_id` | string \| null | no | Provincia u organismo emisor. |
| `habilitacion_salud.especialidad_id` | string \| null | no | FK **`cfg_especialidad`**; sin texto paralelo para reglas de negocio. |
| `habilitacion_salud.colegio_id` | string \| null | no | FK **`cfg_colegio`**; el nombre visible del colegio vive en el catálogo, no como sustituto del id. |

### 4.7 Habilitación enfermero/a profesional (objeto `habilitacion_enfermeria`, opcional)

Separado de `habilitacion_salud` para evitar colisión semántica entre dos matrículas y dos títulos.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `habilitacion_enfermeria.es_enfermero_profesional` | boolean | sí | |
| `habilitacion_enfermeria.titulo` | string \| null | condicional | |
| `habilitacion_enfermeria.universidad` | string \| null | condicional | |
| `habilitacion_enfermeria.matricula_numero` | string \| null | condicional | Matrícula de enfermería. |
| `habilitacion_enfermeria.colegio_id` | string \| null | condicional | |

### 4.8 Metadatos de auditoría en el documento persona

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `creado_en` | Timestamp | sí | Alta del registro persona. |
| `creado_por` | string \| null | no | `persona_id` del operador o `SISTEMA`. |
| `actualizado_en` | Timestamp | sí | Última modificación de cualquier campo del documento. |
| `actualizado_por` | string \| null | no | `persona_id` o servicio. |
| `schema_version` | number | sí | Versión del contrato de este documento (migraciones de esquema). |

### 4.9 Catálogo normativo — Colección `formacion_agente`

**ID del documento:** `for_<ULID>`. **Un documento vigente por `persona_id`** (salvo política de historial futura).

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `formacion_id` | string | sí | Igual al id del documento. |
| `persona_id` | string | sí | FK `personas`. |
| `nivel_estudios_id` | string \| null | sí† | Ref `cfg_nivel_estudios`. |
| `titulo_completo` | string | sí\* | Texto libre. |
| `duracion_anios` | number \| null | política | |
| `institucion` | string \| null | no | Texto libre. |
| `creado_en` / `actualizado_en` | Timestamp | sí | |

† y \* mismas reglas que en §4.1 nota † y domicilio/formación \* según checklist `COMPLETO`.

---

## 5. Catálogo normativo — Colección `usuarios_cuenta`

**ID del documento:** `usr_<ULID>`. Representa la **cuenta de acceso** vinculada a una persona (puede haber 0..1 cuentas activas por persona según política; documentar si se permite multi-cuenta).

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `cuenta_id` | string | opcional\* | Si existe, = id del path `usr_*`. \*Preferir solo `documentId` (§2.2). |
| `persona_id` | string | sí | FK a `personas`. |
| `auth_uid` | string \| null | condicional | UID del proveedor (p. ej. Firebase Auth). `null` hasta vinculación; no-null obligatorio tras vinculación (§3.7 ítem 56). |
| `auth_proveedor_id` | string \| null | no | FK `cfg_metodo_auth`. |
| `username` | string \| null | condicional | Único correo de acceso tras paso B; `null` solo A→B; ver `MODULO_LOGIN_V2.md` §3.1. No hay copia en `personas`. |
| `activo` | boolean | sí | Cuenta habilitada para autenticación. |
| `estado_acceso` | string | sí | FK `cfg_estado_cuenta_acceso`. |
| `creado_en` / `actualizado_en` | Timestamp | sí | |
| `role_ids` | array de `string` | política | Cada elemento FK `cfg_rol`. |

**Índices sugeridos:** `auth_uid` **único entre valores no nulos** (índice parcial / sparse según motor); `persona_id` único si regla es 1 cuenta ↔ 1 persona.

---

## 6. Catálogo normativo — Colección `consentimientos`

**ID del documento:** `doc_<ULID>` (tratamos la aceptación como **documento probatorio**; alternativa equivalente: fila en `eventos_ticket` con payload, pero conviene entidad consultable por tipo y persona).

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `consentimiento_id` | string | sí | ID documento. |
| `persona_id` | string | sí | Titular que acepta o al que afecta. |
| `cuenta_id` | string \| null | no | Si la aceptación se hizo logueado, referencia quién en sesión. |
| `tipo_consentimiento_id` | string | sí | FK `cfg_tipo_consentimiento`. |
| `version_id` | string | sí | FK a `cfg_textos_legales` o versión semver (`2026.04.1`). |
| `texto_hash` | string | sí | Hash SHA-256 del texto mostrado (integridad). |
| `idioma` | string | no | `es-AR`, etc. |
| `aceptado` | boolean | sí | |
| `aceptado_en` | Timestamp | sí | Momento de la acción. |
| `ip_origen` | string \| null | política | Si política de hospital lo permite y exige. |
| `user_agent` | string \| null | no | Opcional para auditoría. |
| `revocado` | boolean | no | Si el consentimiento puede revocarse. |
| `revocado_en` | Timestamp \| null | no | |

Cada aceptación nueva de una nueva versión = **nuevo** `doc_<ULID>` (inmutable), no sobrescribir el anterior.

---

## 7. Catálogo normativo — Colección `declaraciones_grupo_familiar`

**ID del documento:** `gf_<ULID>`. Agrupa la DDJJ del titular y el listado de familiares declarados.

### 7.1 Campos del documento (titular y metadatos)

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `declaracion_id` | string | sí | Mismo que id doc (`gf_...`). |
| `titular_persona_id` | string | sí | FK `personas`; fuente de verdad del titular. |
| `titular_cuenta_id` | string \| null | no | Si se declara desde sesión. |
| `declaracion_version` | number | sí | Incrementa en cada reenvío sustancial. |
| `estado_declaracion_id` | string | sí | FK `cfg_estado_declaracion_ddjj`. *(Alinear valores con módulo Ticket.)* |
| `declaracion_jurada_aceptada` | boolean | sí | Checkbox general del formulario. |
| `aceptada_en` | Timestamp \| null | condicional | |
| `creado_en` / `actualizado_en` | Timestamp | sí | |

**Denormalización controlada (solo lectura / informes):** opcionalmente `titular_dni_snapshot`, `titular_nombre_snapshot` al momento de enviar, para no perder contexto si la persona cambia después; deben marcarse como snapshot, no como SSoT.

### 7.2 Elementos del array `familiares`

Cada ítem es un objeto con **id estable dentro del array** para poder auditar sin reordenar mal.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `familiar_linea_id` | string | sí | `fml_<ULID>` por ítem; permite `update` puntual en Firestore. |
| `parentesco_id` | string | sí | Ref `cfg_parentesco`. |
| `nombre` | string | sí | |
| `apellido` | string | sí | |
| `dni` | string \| null | política | Menores pueden tener lógica distinta. |
| `fecha_nacimiento` | Timestamp \| null | política | Edad / artículos. |
| `convive` | boolean \| null | no | Si aplica a normativa interna. |
| `dependiente` | boolean \| null | no | |
| `discapacidad_declarada` | boolean \| null | no | Sensible; solo si negocio lo exige. |
| `notas_titular` | string \| null | no | Texto corto opcional. |
| `adjuntos` | array de map | no | Lista `{ storage_path, doc_id, subido_en }` si hay documentación. |
| `estado_auditoria_familiar_id` | string | sí | FK `cfg_estado_auditoria_familiar`. |
| `historial_cambios` | array de map | recomendado | Entradas compactas o refs a `evt_` para no inflar el documento. |

---

## 8. Catálogo normativo — Colección `eventos_ticket` (cruzado con este módulo)

**ID:** `evt_<ULID>`. No duplica todos los campos de persona; registra **qué cambió** y referencias.

| Campo | Tipo | Obligatorio | Explicación |
|-------|------|-------------|-------------|
| `evento_id` | string | sí | |
| `tipo_evento_id` | string | sí | FK `cfg_tipo_evento`. |
| `persona_id` | string \| null | no | Actor o sujeto según tipo. |
| `payload` | map | sí | Diff o snapshot mínimo acordado. |
| `actor_persona_id` | string \| null | no | Quién ejecutó (o null si sistema). |
| `ocurrido_en` | Timestamp | sí | |

---

## 9. Catálogos `cfg_*` de los que depende este módulo

Solo listado de **necesidad**; el contenido lo define administración / otra PC. **Inventario centralizado y semilla ilustrativa de estados:** [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5–§6.

| Colección / id | Uso en datos personales |
|-----------------|-------------------------|
| `cfg_estado_civil` | Valores válidos para `estado_civil_id`. |
| `cfg_sexo_genero` *(nombre tentativo)* | `personas.sexo_genero_id` (listas sensibles; no hardcode en app). |
| `cfg_nacionalidad` | `nacionalidad_id`. |
| `cfg_nivel_estudios` | `formacion_agente.nivel_estudios_id`. |
| `cfg_parentesco` | `familiares[].parentesco_id`. |
| `cfg_requisitos_ticket` / tipo solicitud *(módulo Ticket)* | Flags del tipo “requiere DDJJ familiar en estado ≥ X” referenciando FK a estados anteriores. |
| `cfg_estado_cuenta_acceso` | Valores de `usuarios_cuenta.estado_acceso` (pendiente registro, onboarding, activo portal, bloqueado, …). |
| `cfg_estado_perfil_datos` | Valores de `personas.estado_perfil_datos_id` (borrador, incompleto, completo, …). |
| `cfg_estado_declaracion_ddjj` | Valores de `declaraciones_grupo_familiar.estado_declaracion_id`. |
| `cfg_tipo_evento` | `eventos_ticket.tipo_evento_id`. |
| `cfg_localidad` / `cfg_provincia` | Domicilio estructurado. |
| `cfg_textos_legales` + versiones | Textos de DDJJ y hashes oficiales para `consentimientos.version_id`. |
| `cfg_idioma` *(recomendado)* | Sustituir `consentimientos.idioma` string por `idioma_id` si se exige regla id-only. |
| `cfg_especialidad` | `habilitacion_salud.especialidad_id` (sin paralelo texto libre para reglas). |
| `cfg_colegio` | `habilitacion_salud.colegio_id`, `habilitacion_enfermeria.colegio_id`. |
| `cfg_jurisdiccion_matricula` *(tentativo)* | `habilitacion_salud.matricula_jurisdiccion_id`. |
| `cfg_motivo_baja_persona` | `personas.motivo_baja_id`. |
| `cfg_tipo_consentimiento` | `consentimientos.tipo_consentimiento_id`. |
| `cfg_metodo_auth` | `usuarios_cuenta.auth_proveedor_id`. |
| `cfg_rol` | Elementos de `usuarios_cuenta.role_ids`. |
| `cfg_estado_auditoria_familiar` | `familiares[].estado_auditoria_familiar_id`. |

---

## 10. Resumen de relaciones (diagrama lógico)

```
personas (per_*)
    ↑ persona_id
usuarios_cuenta (usr_*) — módulo Login; auth_uid, username, estado_acceso, role_ids

personas (per_*)
    ↑ persona_id
formacion_agente (for_*) — nivel + título + duración + institución (V2 tabular)

personas (per_*)
    ↑ persona_id
consentimientos (doc_*)

personas (per_*)
    ↑ titular_persona_id
declaraciones_grupo_familiar (gf_*)
    └── familiares[].familiar_linea_id (fml_*)

eventos_ticket (evt_*) — referencia persona_id / declaracion_id según tipo_evento_id

cfg_*  ←  todas las opciones seleccionables de listas de negocio (sin hardcode en app)
```

---

## 11. Permisos (planificación, no implementación)

- **Titular (`persona_id` de la sesión`):** lectura/escritura de su `personas` en **campos permitidos** (identidad DNI/nombre/apellido: no editables por agente, **§1.3**); creación de `consentimientos` y de `declaraciones_grupo_familiar` propias.
- **RRHH / auditoría:** lectura y transiciones de estado en `familiares` (`estado_auditoria_familiar_id`) y documento DDJJ (`estado_declaracion_id`) según rol (detalle en Rulebook global).
- **Sistema:** creación de `evt_` en cada mutación crítica.

---

## Anexo A — Referencia rápida V1 (solo contexto histórico)

La versión 1 mezclaba datos en `usuarios`, objeto `datos_personales` duplicado en raíz, DDJJ familiares en `grupo_familiar_global` indexado por `uid`. **V2 no replica ese modelo físico**; el contrato objetivo para código nuevo es la **sección 3** (detalle campo por campo) más las tablas resumen de las secciones **4 a 8**.

---

## Pendientes de producto / unificación mañana

- [ ] Obligatoriedad final de `cuil` salvo norma RRHH; checklist de **DDJJ familiar** (DNI / fecha / discapacidad — lista **P 15–17**). Sexo/género / estado civil / nivel: **definidos** en **P 1–10** + lista §3.
- [ ] ¿Una o varias `usuarios_cuenta` por `persona_id`?
- [ ] Alinear valores en **`cfg_estado_perfil_datos`** y **`cfg_estado_declaracion_ddjj`** con la máquina de estados del **módulo Ticket**.
- [ ] Política de **menores** en `familiares` (DNI opcional, consentimientos del titular).

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación y acuerdo paralelo con módulo Ticket. |
| 2026-04-22 | Inventario V1 y propuesta inicial por entidades. |
| 2026-04-22 | **Catálogo normativo V2 (nueva BD):** `personas`, `usuarios_cuenta`, `consentimientos`, `declaraciones_grupo_familiar`, `eventos_ticket`, `cfg_*`; campos detallados y explicados; anexo V1 acotado. |
| 2026-04-22 | Alineación explícita: **ID de usuario único y fijo** (`persona_id` / `per_`) como referencia transversal entre módulos; documentado en `PLAN_MODULOS_V2.md`. |
| 2026-04-22 | **Sección 3:** lista numerada **campo por campo** (102 ítems) con ubicación, tipo y propósito; renumeradas secciones tabulares 4–11. |
| 2026-04-22 | **Leyenda [O]/[P]/[C]/[X]/[R]** y marca en cada ítem; tabla resumen de conteos (102). |
| 2026-04-22 | Plan **`MODULO_LOGIN_V2.md`**; **[P] 1–10** acotada (perfil `COMPLETO` vs fases previas; login delegado a módulo login). |
| 2026-04-22 | **Resumen de marcas** recalculado (41 / 12 / 12 / 34 / 3). Catálogo §4.1, §4.3 alineado a acuerdo [P] 1–10; formación en §4.9; nota **†** vs **\***. |
| 2026-04-22 | `MODULO_LOGIN_V2.md` §2 **Email único** (fuente `username`, réplica en `personas`, sin edición desde datos personales). |
| 2026-04-22 | **Lista P 11–17** (formación, `roles`, `ip_origen`, familiares); ítem **#9** `fecha_nacimiento` alineado a **[O]** al `COMPLETO`; conteos **[O] 42** / **[P] 11**; texto `username` unificado con §2. |
| 2026-04-22 | **§1.1** Orden onboarding (RRHH → DNI + credenciales → datos personales → menúes; DDJJ opcional en tiempo; enlace a `MODULO_LOGIN_V2.md` §4–§5). |
| 2026-04-22 | **§2.1** Tablas del módulo (`personas`, `formacion_agente`, DDJJ, consentimientos); Login dueño de `usuarios_cuenta`. Tipos texto vs FK/`cfg_*` **sin hardcode** de opciones. DDJJ opcional en onboarding con **persistencia** para prerequisitos de Ticket. Contrato sugerido `formacion_agente`. |
| 2026-04-22 | **§2** convención **estados solo `*_id`**; **§1.2** flujo A–E con campos y riesgos; frecuencia de lectura; catálogos `cfg_estado_cuenta_acceso`, `cfg_estado_perfil_datos`, etc. |
| 2026-04-22 | **§2.2** anti-duplicidad: email solo en cuenta; formación solo en `formacion_agente`; snapshots DDJJ; ids de doc. **§3.4** → `formacion_agente`; ítem **#25** suprimido; **§4.3** sin `email_laboral`; **§4.5** eliminado embebido + **§4.9** catálogo `formacion_agente`. |
| 2026-04-22 | **§3** alineado a `*_id`:** `motivo_baja_id`, `estado_perfil_datos_id`, `tipo_consentimiento_id`, `estado_declaracion_id`, `estado_auditoria_familiar_id`, `tipo_evento_id`, `auth_proveedor_id`, `role_ids`, `estado_acceso` (en ítem 59 cuenta). **§2.3** esquema físico. Catálogos §4–§8 y §9 actualizados. |
| 2026-04-22 | **§2.4** auditoría (innecesarios, duplicidad, problemas, regla ID, checklist **módulo de configuración**); §9 ampliada (`cfg_sexo_genero`, `cfg_idioma`, `cfg_especialidad`, `cfg_jurisdiccion_matricula`, `cfg_colegio`). **§3.7/§5** `auth_uid` **[C]** (`null` hasta vinculación Auth). **§4.6** habilitación solo FK (`cfg_especialidad`, `cfg_colegio`). **Resumen de marcas** [O] 41 / [C] 13. |
| 2026-04-22 | Cabecera y §1.1: enlace a [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md); §1.2 paso C: nombre de campo `tipo_consentimiento_id`; §2.3 `auth_uid` string\|null en esquema `usuarios_cuenta`. |
| 2026-04-22 | §3.7 ítem 58 y catálogo §5: **`username`** **[C]** (`null` solo paso A→B), alineado a Login §3.1; **resumen de marcas** [O] 40 / [C] 14. |
| 2026-04-22 | Cabecera: enlaces [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md), [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md). |
| 2026-04-22 | §9: referencia a inventario y semilla en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §5–§6 (bloque Login + datos). |
| 2026-04-22 | Cabecera: **doc avanzada** + enlace criterios de alineación (`V1_VS_V2_LOGIN_DATOS`). |
| 2026-04-23 | **§1.3** edición posterior (DNI/nombre/apellido bloqueados; cambios y **E1** / `evt_*`); **§2.2** filas E1; **§2.3** y paso C: `foto_rostro`. **§3.12** ítem **103**; **§4.1.1** catálogo foto; **lista P 18**; resumen de marcas **103** ítems, **[P] 12**. Criterios **E1, E5** en anexo. Plan unificado §7 nota E1/E2/E5. |
| 2026-04-23 | Cabecera: *cerrado* → **avanzada; pend. revisión**; *DoD* → criterios de alineación. |
| 2026-04-22 | Cabecera: enlaces a `INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2` y `DESARROLLO_ORDEN_LOGIN_DATOS_V2`. |
| 2026-04-22 | Cabecera + §3 ítem 57: **regla básica** V2 independiente de V1; sin migración/conexión con V1; “migración legacy” sustituido por RFC solo en ciclo V2. |
| 2026-04-22 | §2.1 tabla `usuarios_cuenta`: alineación a **DNI + PIN 6** (`MODULO_LOGIN_V2` §1.1). |
| 2026-04-22 | §2.1: filas laborales iniciales (`grupos` + `hlc_*`); párrafo “Qué define cada plan”. |
| 2026-04-23 | §2.1: **`efectores`**, **`grupos_de_trabajo`**, `hlc_*` (tres FK) alineado a plan maestro §B y **A2** en [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md). |
| 2026-04-27 | §2.1: referencias a catálogo de efectores unificadas a **`cfg_efectores`**; legacy `efectores` deprecada. |
| 2026-04-22 | §2 tipos de dato: referencias `cfg_*` con id única y remisión a vigencia / sin borrado en [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §1–§2. |
| 2026-04-23 | Cabecera **Alineación:** regla de precedencia `RULEBOOK` + módulo sobre nombres del plan maestro; enlace a [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md). |
