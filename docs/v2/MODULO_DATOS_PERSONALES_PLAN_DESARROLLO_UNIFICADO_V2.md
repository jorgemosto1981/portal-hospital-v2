# Módulo Datos personales — Plan de desarrollo unificado (V2)

**Estado:** **fuente canónica** de criterios, decisiones y flujo del **módulo Datos personales** para V2.  
**Cierre documental (producto + diseño):** **cerrado** el **23/04/2026** — ver **§12** (qué queda es solo **codificación** según `DESARROLLO_ORDEN_…`, no más “bucle” de criterios del módulo).  
**Propósito:** dejar de cruzar `DECISIONES_…`, `FLUJO_V2_…` y el módulo largo solo para saber *qué* hay que cumplir. **Un solo archivo** = plan de producto a este nivel.

**Qué NO es este documento:** la lista campo a campo (ítems 1–100+) sigue en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) como **anexo de contrato**.  
**Qué SÍ es:** objetivo, decisiones cerradas, flujo A→E, gating, cruces con Login/Ticket/Config, riesgos, pendientes y punteros a orden de código.

**Fecha de unificación:** 23 de abril de 2026.  
**Decisiones de origen:** [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) (secciones A, B, cruces D1–D3).  
**Orden de implementación (código):** [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) (fases 0–6 con Login + personales).

**Otros módulos:** laborales, Ticket, configuración, login detallado, menús, etc. tendrán su **propio** plan unificado en archivos separados (mismo criterio: un documento ancla por módulo).

---

## 1. Objetivo del módulo

- Una **sola fuente de verdad** por dato de ficha (identidad, contacto, domicilio, formación, consentimientos).
- **DDJJ grupo familiar** como entidad propia (`gf_*`) con estado **siempre** en `cfg` (id), no “ausencia de fila”.
- Exponer al resto del sistema el **`persona_id`** (`per_<ULID>`) y lecturas mínimas que normativa y otros módulos requieran.
- **Trazabilidad** con `eventos_ticket` (`evt_*`) por `tipo_evento_id` → `cfg_tipo_evento` (payload acotado: **solo referencias**, no copia de documentos completos — **B6**).

---

## 2. Alcance y límites

| Incluido en este módulo | Excluido o dueño de otro módulo |
|---------------------------|---------------------------------|
| `personas`, `formacion_agente`, `declaraciones_grupo_familiar`, `consentimientos` (contrato y flujos) | `usuarios_cuenta`, Auth, `estado_acceso` **especificación detallada** → [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) |
| Uso de `eventos_ticket` (qué se registra, `payload`) | Reglas de negocio del **módulo Ticket** (asignación, estados de aviso) |
| Requisitos de **lectura** que Ticket pide a DDJJ | Implementación de pantallas Ticket |
| Punteros a `cfg_*` que consume la ficha | **CRUD de catálogos** y seeds globales → [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) |
| Datos **laborales** (`gdt_*`, `efe_*`, `hlc_*`) solo como **contexto** de otras tablas en §2.1 del doc largo | Modelo laboral en [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) (plan unificado aparte) |

**Regla transversal (A3):** si chocan textos, hasta nueva revisión explícita: 1) este plan unificado + [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) para contrato; 2) [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md); 3) [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) en el root del repo.

---

## 3. Ancla: `persona_id`

- **ID del sistema** = id del documento `personas/per_<ULID>`.
- Todas las colecciones de negocio usan `persona_id` o, en DDJJ, `titular_persona_id` como en el contrato.
- **Prohibido** como FK entre módulos: DNI, email, `auth_uid` (salvo flujos puntuales de autenticación en Login).

---

## 4. Decisiones cerradas (resumen operativo)

Referencias **B1…B10, A1, D1…D3** = [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md).

| ID | Criterio unificado (qué hará el producto) |
|----|----------------------------------------|
| **A1** | Colección **`formacion_agente`** en **singular**; **un** documento vigente por `persona_id` en V2. |
| **B1** | Campos **[P]**: los define producto/hospital. El checklist “perfil **COMPLETO**” debe poder **configurarse** (ideal `cfg` de versión de perfil), **no** lista fija eterna en código. Mientras no exista ese `cfg`, la **lista P** del anexo en `MODULO_DATOS_PERSONALES_V2` = **anexo normativo** del MVP. |
| **B2** | `perfil_completitud_version` en `personas` es **puntero** a exigencias. Tener un documento en `cfg_*` con la definición por versión es **recomendado**, no exigencia del primer MVP; si no hay `cfg`, número + tabla en doc/seed. |
| **B3** | `lugar_nacimiento_texto` es **informativo**; **no** se usa en reglas de negocio ni integraciones V2. Si hay catálogo, puede usarse `lugar_nacimiento_id`; no forzar lógica pesada de doble verdad. *(El anexo largo §2.4 puede seguir advirtiendo riesgo; el criterio de producto gobernante es B3.)* |
| **B4** | `consentimientos` e **idioma:** objetivo = `idioma_id` → `cfg_idioma`. **Cierre documental:** el **primer** entregable de producto puede persistir **string BCP-47** solo como trazabilidad (*qué idioma vio/aceptó*), **mientras** `cfg_idioma` + seed no estén. No usar ese string como lista de reglas. Cuando exista `cfg_idioma`, migrar a `idioma_id` en una tarea de datos explícita. **No** bloquea cierre de este plan. |
| **B5** | Historial de negocio relevante → `evt_*`; no historial largo duplicado en `familiares[]`; snapshots en **cierre** de envío/auditoría si aplica. |
| **B6** | `payload` de `evt_*`: **referencias** (ids, códigos cortos); **no** documentos completos. |
| **B7** | En el **primer alta** RRHH (paso A) se **crea** siempre un documento **`declaraciones_grupo_familiar` (`gf_*`)** aunque el agente no haya abierto la DDJJ; `estado_declaracion_id` = valor en `cfg` tipo **“no iniciada”** (u otro acordado en seed). Así Ticket y reportes leen **siempre** por id. **No** es opcional omitir la fila. |
| **B8** | Pase a **menú / activo portal**: gobierna el **servidor** (Callable / backend), con reglas coherentes con cuenta + `estado_perfil_datos` + flujo; **no** basta con condición hecha **solo** en el cliente. |
| **B9** | Checklist al final de `MODULO_DATOS_PERSONALES_V2` se va cerrando en el propio módulo; **este** plan no sustituye esos ítems operativos. |
| **B10** | Nombre canónico del catálogo: **`cfg_estado_declaracion_ddjj`**. **Estados** (no iniciada, borrador, presentada, etc.) = **configurables** vía `cfg` + seed. |
| **D1** | **Una sola narrativa** para la secuencia (A–E o equivalente). Fuentes: módulo personales §1.1, `MODULO_LOGIN` §4–5, y [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) — la tabla de pasos del flujo hace de **ancla**; se corrigen contradicciones a favor de una sola lectura (ver §5 de este plan). |
| **D2** | Transiciones de `estado_acceso` y `estado_perfil_datos` a estados “finales” / menú: **solo servidor**. |
| **D3** | SSoT de la DDJJ = **`gf_*` + `estado_declaracion_id`**. Requisitos por tipo de solicitud = `cfg`. Ticket **no** duplica la lógica de “¿omitió en onboarding?”. |

**Laborales / Ticket (D4):** el filtrado de Ticket por **asignación** vía `grupos_de_trabajo` (no exigido filtrar por `efector_cumplimiento_id` en Ticket) está en decisiones; **no** es contrato de datos personales salvo impacto de lectura de `persona_id` y ficha. Detalle: archivo de decisiones, sección C/D.

---

## 5. Flujo A → E (unificado, sin “opcional” a `gf_*` en A)

Criterio **B7** + **D1** + **B10**: el paso **A** **incluye obligatoriamente** la creación de `gf_*` (estado vía `cfg_estado_declaracion_ddjj`).

| Paso | Qué pasa (producto) | Persistencia módulo personales (resumen) |
|------|---------------------|------------------------------------------|
| **A** — Alta RRHH | RRHH crea persona mínima y cuenta pendiente. | `personas` mínima; `usuarios_cuenta` (estado acceso = pendiente registro; `auth_uid` null). **`declaraciones_grupo_familiar` creada sí o sí** con `estado_declaracion_id` = “no iniciada” (u otro en `cfg`). `formacion_agente`: según anexo, normalmente aún no o vacío según política. |
| **B** — Primer acceso | DNI + email + credencial; vincula Auth. | No escribir email de login en `personas` (ver anti-duplicidad anexo). Cuenta pasa a “onboarding datos” (especificación Login). |
| **C** — Onboarding datos | Wizard ficha, formación, consentimientos hasta checklist **COMPLETO**. | `personas`, `formacion_agente`, `consentimientos`. `estado_perfil_datos_id` → completo vía `cfg`. |
| **D** — DDJJ familiar | Puede en mismo onboarding o después; **no** bloquea menú por defecto. | `gf_*` ya existe; se actualizan `familiares[]`, `estado_declaracion_id`, `evt_*` según cierre/omisión. |
| **E** — Portal | Menú operativo. | Cuenta en *activo portal* coherente con B8; lecturas. |

**Regla:** entre B y C hay sesión válida pero **sin** menú principal hasta cerrar C (y transición de `estado_acceso` con lógica de **servidor**). La DDJJ D no bloquea el menú salvo política explícita y documentada en Login.

> **Sincronización:** `FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md` **§4** paso A = **`gf_*` obligatoria** (alineado B7, actualizado 23/04/2026).

---

## 6. Gating (menú principal)

Entradas de verdad (ver también `FLUJO_V2` §5):

1. `usuarios_cuenta.activo` y `personas.activo`.
2. `estado_acceso` resuelto contra `cfg_estado_cuenta_acceso` (flags del catálogo, p. ej. `permite_menu_principal`).
3. `estado_perfil_datos_id` resuelto contra `cfg_estado_perfil_datos` (p. ej. `permite_portal_completo`).

**Coherencia:** *activo portal* con perfil no completo = **inconsistente**; reconciliación o bloqueo (matriz en `FLUJO` §5.3).

**Implementación:** `destinoTrasAuth` (o equivalente) con **ids** a `cfg`, no strings sueltos en reglas. Transiciones a estados “finales” = **D2** (servidor).

---

## 7. Colecciones del módulo (resumen)

| Colección | Prefijo id | Notas |
|-----------|------------|--------|
| `personas` | `per_` | Ficha; `estado_perfil_datos_id`, etc. |
| `formacion_agente` | `for_` | A1: un documento por persona (V2). |
| `declaraciones_grupo_familiar` | `gf_` | `titular_persona_id`; **B7**; **B10** `estado_declaracion_id` → `cfg_estado_declaracion_ddjj`. |
| `consentimientos` | `doc_` | **B4** cerrado a nivel plan; implementación elige BCP-47 o `idioma_id` según exista `cfg_idioma` en el entorno. |
| `eventos_ticket` | `evt_` | **B5, B6**; transversal, tipado por `tipo_evento_id`. |

Cuenta y Auth: `usuarios_cuenta` — módulo **Login**; este plan solo fija interacción y anti-duplicidad (email en cuenta, no en `personas` — réplica informativa opcional, **E2** en `DECISIONES_…`).

**Edición de ficha, foto y RRHH:** criterios **E1, E2, E5, E6** en [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) (sección **E**); contrato en anexo [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§1.3**, **§3.12** (`foto_rostro`, ítem 103) y **§4.1.1**. *No reabre* el cierre documental del módulo (§11): son extensiones al contrato de implementación.

---

## 8. Principios técnicos que no se negocian en implementación

- **Estados y listas de negocio** = `*_id` → `cfg_*` (etiquetas en el catálogo, no en constantes de app para reglas). **B1** admite anexo mientras no exista `cfg` de versión de perfil.
- **DNI** único solo entre `personas.activo === true`.
- **Sin borrado físico** de ficha: bajas lógicas + `evt_*` según reglas.
- **Callable / servidor** para cierre de onboarding y `estado_perfil_datos` + `estado_acceso` alineados (**B8, D2**).

Orden mínimo de **código** para el vertical personales+login: [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) (Fases 0–6).

---

## 9. Evolución posterior (no forman parte del “cierre” de este módulo en plan)

| Tema | Nota |
|------|------|
| **B2** | Cuando exista `cfg` de `perfil_completitud_version` con lista de campos, dejar de depender solo del anexo. |
| Lista **[P]** | Ajustes por hospital = anexo `MODULO_DATOS_PERSONALES_V2` +, si aplica, `cfg`. |
| **Migración B4** | Pasar de string BCP-47 a `idioma_id` cuando `cfg_idioma` esté en seeds. |

---

## 10. Documentos anexos (no sustituidos)

*(Contrato de implementación; no hace falta leerlos para “cerrar criterio” del módulo — ya volcado arriba.)*

| Documento | Uso |
|-----------|-----|
| [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) | Contrato de campos, marcas [O][P][C], §3 ítem a ítem. |
| [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) | Pseudocódigo, matriz gating, paso B atómico, riesgos. Paso A con `gf_*` obligatoria (B7). |
| [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) | Cuenta, Auth, `estado_acceso` en detalle. |
| [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) | `cfg_*`, semillas, vigencias. |
| [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) | Reglas y matriz de acceso cuando se implemente. |
| [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) | Histórico y IDs A–D; laborales y cruces C/D. |

---

## 11. Cierre del módulo — “Datos personales” **terminado** a nivel plan

**Alcance de este cierre:** **documentación de producto y diseño** del módulo. **No** incluye escribir código, desplegar Firebase ni tests (eso es otra pista: [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md)).

| Criterio | Estado |
|----------|--------|
| Objetivo, límites y `persona_id` definidos | Hecho (§1–3) |
| Decisiones A1, B1–B10, D1–D3 volcadas y sin “pendiente” crítico en B4 (regla B4 cerrada en §4) | Hecho |
| Flujo A→E con `gf_*` **obligatoria** en A (B7) y gating servidor (B8, D2) | Hecho |
| Tabla de colecciones y principios técnicos | Hecho (§6–8) |
| Existe anexo de contrato campo a campo | [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) |
| Flujo cruzado Login alineado (paso A `gf_*`) | [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §4 |

**Conclusión:** con esto, el módulo **Datos personales** queda en **condiciones aceptables** de plan: **no** se requiere otra vuelta de criterios para avanzar; la siguiente capa de trabajo es **implementación** (vertical con Login) o **evolución** listada en §9.

**Regla para no reabrir el bucle:** cualquier duda de *qué hacía el módulo* → **este archivo (§1–8)**. Cualquier duda de *qué campo y tipo* → **anexo** `MODULO_DATOS_PERSONALES_V2.md`. Cualquier duda de *orden de código* → **`DESARROLLO_ORDEN_…`**.

---

## 12. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-23 | Creación: plan unificado **Módulo Datos personales**; decisiones B, A1, D1–D3; flujo A–E con B7; gating; punteros. |
| 2026-04-23 | **Cierre documental:** B4 fijado (MVP: BCP-47 o `idioma_id`); §9 = evolución, no “pendiente”; **§11** = DoD módulo personales; estado cabecera. |
| 2026-04-23 | Tras cierre: nota bajo **§7** (criterios **E1, E2, E5** y anexo `MODULO_DATOS_PERSONALES` §1.3 / §3.12) — extensión de contrato, no reabre §11. |
