# Módulo de configuración — Plan V2

**Propósito:** contrato para **colecciones `cfg_*`**: forma de los documentos, flags que consumen Login y datos personales, **inventario** del módulo datos personales/login y **semilla ilustrativa** de estados. El detalle campo-consumidor sigue en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§9**.

**Fecha:** 22 de abril de 2026.

**Estado:** **avanzado** en el subconjunto §5–§7 (inventario + semilla + guía de scripts); *pendiente de nueva revisión*. **§1–§2** proponen **normativa transversal** (ids, vigencia, sin borrado) para todos los `cfg_*`; al implementar seeds, rellenar **`vigente_desde` / `vigente_hasta`** y **`activo`** en cada documento de ejemplo. Sustitución de ids placeholder por ULIDs reales al desplegar.

---

## 1. Principios

1. **Un documento = un valor de catálogo** con **id única y estable** (recomendación V2: **document id = ULID** en Firestore). Toda opción **seleccionable** cuyo valor salga del **módulo de configuración** se crea así: la app y las reglas enlazan **solo esa id**, nunca el texto visible, para **evitar errores de validación y de lógica** al renombrar o traducir labels.
2. **La app y las Rules no comparan** strings de negocio en `personas` / `usuarios_cuenta` / `hlc_*` frente a catálogo; comparan **`*_id`** apuntando a estos documentos.
3. **Campos de presentación** (`titulo_ui`, `nombre`, `orden`, …) viven en `cfg_*`, no como fuente de verdad en cada ficha de negocio.
4. **Flags de comportamiento** opcionales para evitar ramas por `codigo_interno` en muchos archivos (ver [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §11 P0).
5. **Vigencia normativa / operativa:** todo documento de configuración que represente un valor usable en formularios o reglas lleva **`vigente_desde`** y **`vigente_hasta`** (ver §2). Así se admiten **cambios de normativa**, reemplazos, bajas programadas y **nuevas filas** sin reutilizar ids antiguos para significados nuevos.
6. **Sin borrado físico en catálogos:** en flujos de producto **no** se eliminan documentos `cfg_*`. Las bajas y retiros de uso son **`activo: false`** y/o cierre de vigencia con **`vigente_hasta`**. Los documentos de negocio que ya guardaron el `*_id` siguen **resolviendo** el registro histórico (lectura para etiquetas y auditoría).

---

## 2. Campos sugeridos (todos los `cfg_*` “de estado” o listas cerradas)

Campos comunes (aplicar a **todos** los catálogos gestionados desde este módulo salvo RFC puntual documentado):

| Campo | Tipo | Obligatorio | Uso |
|-------|------|-------------|-----|
| `codigo_interno` | string | recomendado | Clave estable legible en logs (**no** sustituye la id de documento en enlaces entre módulos). Ej.: `ONBOARDING_DATOS`. |
| `titulo_ui` | string | recomendado | Texto para selects y pantallas (equivalente a “nombre” en catálogos que usen `nombre`). |
| `orden` | number | recomendado | Orden en UI. |
| `vigente_desde` | Timestamp | **[O]** | Inicio de vigencia del valor (inclusive según regla de comparación acordada en implementación). |
| `vigente_hasta` | Timestamp \| null | **[O]** | Fin de vigencia; **`null`** = vigente **sin** fecha de cierre definida. Fuera de `[desde, hasta]` el ítem **no** debe ofrecerse para **nuevas** selecciones (salvo política explícita de administración). |
| `activo` | boolean | **[O]** | **`false`** = **deshabilitado** (baja lógica inmediata en UI de altas); combinable con `vigente_hasta`. **No** borrar el documento. |

**Filtrado típico para selects (nuevas altas):** `activo == true` **y** fecha actual dentro de la vigencia **y** (opcional) reglas extra por colección.

**Datos ya guardados:** los `*_id` en documentos de negocio **no** se invalidan por el mero paso del tiempo; la UI puede mostrar el catálogo histórico o un badge “no vigente” según producto.

### 2.1 `cfg_estado_cuenta_acceso` (consumo: `usuarios_cuenta.estado_acceso`)

Añadir flags de producto (nombres tentativos):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `permite_menu_principal` | boolean | Si `true`, la cuenta puede ver shell con menú **si** también cumple perfil (ver flujo §5.3). |
| `requiere_wizard_datos_personales` | boolean | Si `true`, el router debe mandar al wizard de datos personales. |
| `permite_login_email_password` | boolean | Si `false`, no usar `signInWithPassword` normal (p. ej. solo pendiente registro → flujo DNI). |

**Semilla ilustrativa** (`codigo_interno` — los **ids reales** serán los generados en seed):

| codigo_interno | permite_menu_principal | requiere_wizard_datos_personales | permite_login_email_password |
|----------------|------------------------|----------------------------------|------------------------------|
| `PENDIENTE_REGISTRO` | false | false | false |
| `ONBOARDING_DATOS` | false | true | true |
| `ACTIVO_PORTAL` | true | false | true |
| `PENDIENTE_VERIFICACION_EMAIL` *(opcional)* | false | false | true |
| `BLOQUEADO` | false | false | según política |

`PENDIENTE_VERIFICACION_EMAIL`: solo si el hospital exige verificar email **antes** del wizard; por defecto **no** se usa (ver [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §11 P1.2).

### 2.2 `cfg_estado_perfil_datos` (consumo: `personas.estado_perfil_datos_id`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `permite_portal_completo` | boolean | Coherente con “ficha suficiente para menú” cuando la cuenta ya está en *activo portal*. |

Ejemplos `codigo_interno`: `BORRADOR`, `INCOMPLETO`, `COMPLETO`, `REQUIERE_ACTUALIZACION` (si sube `perfil_completitud_version`).

---

## 3. Relación con gating

La función `destinoTrasAuth` (flujo §5.2) debe basarse preferentemente en **flags del cfg** resueltos por `estado_acceso` y `estado_perfil_datos_id`, no en comparar `codigo_interno` en cadena repartida por el código cliente.

---

## 4. Seguridad y administración

- **Escritura** en `cfg_*`: solo roles administración / despliegue (Consola, **scripts de seed o actualización de catálogos en V2**, backoffice superadmin). *Sin relación con datos de la V1.*
- **Lectura:** autenticados para la mayoría de catálogos de formulario; restringir si un catálogo es sensible.

Ver [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md).

---

## 5. Inventario de colecciones `cfg_*` (módulo datos personales + login + §5.1 laborales)

Origen canónico de la lista de necesidad: [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§9**. Aquí se centraliza el **nombre de colección** para seeds y Rulebook.

| Colección `cfg_*` | Consumidor principal |
|-------------------|-------------------------|
| `cfg_estado_civil` | `personas.estado_civil_id` |
| `cfg_sexo_genero` | `personas.sexo_genero_id` |
| `cfg_nacionalidad` | `personas.nacionalidad_id` |
| `cfg_nivel_estudios` | `formacion_agente.nivel_estudios_id` |
| `cfg_parentesco` | `declaraciones_grupo_familiar.familiares[].parentesco_id` |
| `cfg_requisitos_ticket` | Módulo Ticket (prerequisitos DDJJ); datos personales solo **referencia** |
| `cfg_estado_cuenta_acceso` | `usuarios_cuenta.estado_acceso` |
| `cfg_estado_perfil_datos` | `personas.estado_perfil_datos_id` |
| `cfg_estado_declaracion_ddjj` | `declaraciones_grupo_familiar.estado_declaracion_id` |
| `cfg_tipo_evento` | `eventos_ticket.tipo_evento_id` |
| `cfg_localidad` / `cfg_provincia` | `personas.domicilio.*` |
| `cfg_textos_legales` (+ versiones) | `consentimientos.version_id` |
| `cfg_idioma` *(recomendado)* | Evolución `consentimientos.idioma_id` |
| `cfg_especialidad` | `habilitacion_salud.especialidad_id` |
| `cfg_colegio` | `habilitacion_salud.colegio_id`, `habilitacion_enfermeria.colegio_id` |
| `cfg_jurisdiccion_matricula` | `habilitacion_salud.matricula_jurisdiccion_id` |
| `cfg_motivo_baja_persona` | `personas.motivo_baja_id` |
| `cfg_tipo_consentimiento` | `consentimientos.tipo_consentimiento_id` |
| `cfg_metodo_auth` | `usuarios_cuenta.auth_proveedor_id` |
| `cfg_rol` | `usuarios_cuenta.role_ids[]` |
| `cfg_estado_auditoria_familiar` | `familiares[].estado_auditoria_familiar_id` |
| **`cfg_estado_vida_agente_rrhh`** *(nombre tentativo; Rulebook)* | **`personas.estado_vida_agente_rrhh_id`** — activo laboral / inactivo laboral (baja) / deshabilitado; filtros menú RRHH. Ver [`CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md`](./CUESTIONES_ESTADOS_LABORAL_PERSONA_RRHH_V2.md). |
| **`cfg_motivo_baja_laboral`** *(nombre tentativo)* | **`personas.motivo_baja_laboral_id`** cuando aplica baja laboral con **`fecha_baja_laboral`**. Mismo doc. |

### 5.1 Inventario `cfg_*` — módulo datos laborales *(borrador)*

Catálogo detallado y semilla laboral: [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) **§6**. Al cerrar el plan laboral, **duplicar** aquí las filas de §6 con los nombres de colección definitivos o sustituir esta subsección por una tabla única fusionada.

| Colección `cfg_*` | Consumidor principal |
|-------------------|-------------------------|
| **`efectores`** | **`historial_laboral_cargos.efector_designacion_id`**, **`efector_cumplimiento_id`**; campo **`es_efector_institucional`**. Ver [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §4.2. |
| **`grupos_de_trabajo`** | `historial_laboral_cargos.grupo_de_trabajo_id`; `historial_laboral_grupos.grupo_de_trabajo_id`. Ver módulo laboral §4.1. |
| `cfg_tipo_grupo` | `grupos_de_trabajo.tipo_grupo_id` (si aplica) |
| `cfg_cargo_funcional` | `historial_laboral_cargos.cargo_funcional_id` |
| `cfg_tipo_vinculo_laboral` | `historial_laboral_cargos.tipo_vinculo_id` |
| `cfg_escalafon` | `historial_laboral_cargos.escalafon_id` |
| `cfg_modalidad_jornada` | `historial_laboral_cargos.modalidad_jornada_id` |
| `cfg_estado_asignacion_laboral` | `historial_laboral_cargos.estado_asignacion_id` |
| `cfg_causal_fin_asignacion_laboral` | `historial_laboral_cargos.causal_fin_asignacion_id` |
| `cfg_tipo_acto_designacion` | `historial_laboral_cargos.referencias_normativa_designacion[].tipo_acto_id` |

---

## 6. Semilla ilustrativa — `cfg_estado_cuenta_acceso` y `cfg_estado_perfil_datos`

**Aviso:** los `id` de ejemplo son **placeholders**; en despliegue real sustituir por **document id = ULID** o por la convención que fije el Rulebook (`cfg_eca_<ULID>`). La app solo guarda **esos ids** en `usuarios_cuenta` / `personas`.

### 6.1 Documentos ejemplo `cfg_estado_cuenta_acceso`

| id ejemplo | `codigo_interno` | `permite_menu_principal` | `requiere_wizard_datos_personales` | `permite_login_email_password` | `orden` |
|------------|------------------|--------------------------|-------------------------------------|----------------------------------|--------|
| `cfg_eca_pend_reg` | `PENDIENTE_REGISTRO` | false | false | false | 10 |
| `cfg_eca_onb` | `ONBOARDING_DATOS` | false | true | true | 20 |
| `cfg_eca_pend_mail` | `PENDIENTE_VERIFICACION_EMAIL` | false | false | true | 25 |
| `cfg_eca_activo` | `ACTIVO_PORTAL` | true | false | true | 30 |
| `cfg_eca_bloq` | `BLOQUEADO` | false | false | false | 90 |

### 6.2 Documentos ejemplo `cfg_estado_perfil_datos`

| id ejemplo | `codigo_interno` | `permite_portal_completo` | `orden` |
|------------|------------------|----------------------------|--------|
| `cfg_epd_borr` | `BORRADOR` | false | 10 |
| `cfg_epd_inc` | `INCOMPLETO` | false | 20 |
| `cfg_epd_comp` | `COMPLETO` | true | 30 |
| `cfg_epd_rec` | `REQUIERE_ACTUALIZACION` | false | 40 |

---

## 7. Scripts de despliegue

- **En repo (V2):** [`scripts/seed-v2/seed-cfg.mjs`](../../scripts/seed-v2/seed-cfg.mjs) (idempotente, `set`+`merge`); `npm run seed:cfg` con `GOOGLE_APPLICATION_CREDENTIALS` (cuenta de servicio del proyecto V2). Ids fijados en [`scripts/seed-v2/seed-ids.v2.json`](../../scripts/seed-v2/seed-ids.v2.json). *Opcional futuro:* Cloud Function `seedCfgDev` solo en no productivos.
- **Orden sugerido:** (1) estados cuenta y perfil, (2) estados DDJJ y tipo evento, (3) catálogos de formulario (estado civil, parentesco, …), (4) textos legales mínimos para un `consentimientos` de prueba.
- **Checklist:** documentar en README de infra que los ids de §6 deben copiarse a **variables de entorno** o **Remote Config** si la app necesita bootstrap antes de leer Firestore.

---

## 8. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Esqueleto: principios, campos comunes, flags para estados de cuenta y perfil, semilla ilustrativa. |
| 2026-04-22 | §5 inventario `cfg_*` alineado a datos personales §9; §6 semilla ejemplo ids; §7 scripts; fila opcional `PENDIENTE_VERIFICACION_EMAIL` en §2.1. |
| 2026-04-22 | §4: escritura `cfg_*` vía seeds/scripts **V2**; aclaración **sin** relación con datos V1. |
| 2026-04-22 | **§5.1** inventario `cfg_*` datos laborales (enlace a `MODULO_DATOS_LABORALES_V2` §6). |
| 2026-04-23 | §5.1: **`cfg_causal_fin_asignacion_laboral`**, **`cfg_tipo_acto_designacion`**. |
| 2026-04-23 | §5.1: **`efectores`** + **`grupos_de_trabajo`** (sustituye enfoque previo con una sola colección `grupos` para organigrama+efectores; alineado plan maestro §B y [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) A2). |
| 2026-04-22 | §1–§2: ids únicas para todo lo seleccionable desde configuración; **`vigente_desde` / `vigente_hasta`** en catálogos; política **sin borrado físico** (`activo` / vigencia). |
| 2026-04-22 | §5: filas tentativas **`cfg_estado_vida_agente_rrhh`**, **`cfg_motivo_baja_laboral`** (personas / RRHH; ver cuestiones estados laboral). |
| 2026-04-23 | Cabecera: *plan documentación cerrado* → **avanzado; pend. revisión** (alineado plan maestro). |
| 2026-04-23 | **§7:** referencia a `scripts/seed-v2/seed-cfg.mjs` y `seed-ids.v2.json` (Fase 1). |
