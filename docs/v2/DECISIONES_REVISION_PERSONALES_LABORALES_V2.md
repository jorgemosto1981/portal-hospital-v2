# Decisiones de revisión — Datos personales y laborales (V2)

**Propósito:** fijar criterios acordados al revisar [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) y [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md), y **criterios de arranque** (Fase 0) para BD/código V2 (**§F**), sin implementar código en este archivo. Cada definición puede **ajustarse** por el equipo; el changelog abajo registra cambios.

**Política:** el plan maestro y [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md) siguen siendo referencia; si algo choca, se actualiza la fila correspondiente allí o en los módulos en el mismo PR de corrección.

**Fecha de esta redacción:** 23 de abril de 2026.

---

## A. Transversal

| ID | Tema | Definición acordada (propuesta) |
|----|------|----------------------------------|
| **A1** | Nombre colección `formacion_agente` | **Cerrado (chat):** mantener **singular** `formacion_agente` (un documento vigente por `persona_id` en V2). |
| **A2** | Grupo de trabajo vs efector | **Cerrado (chat):** **no** un solo `grupos` para ambos. **(1) `grupos_de_trabajo`:** organigrama, burbujeo, ticket; id **`gdt_<ULID>`**. **(2) `efectores`:** catálogo **seleccionable y configurable**; id **`efe_<ULID>`**. **(3) `historial_laboral_cargos`:** **dos** FK a **`efectores`** (designación y cumplimiento) y **una** a **`grupos_de_trabajo`**. Nombres de campos: `grupo_de_trabajo_id`, `efector_designacion_id`, `efector_cumplimiento_id` — en [`PLAN_DESARROLLO_VERSION2.md`](../../PLAN_DESARROLLO_VERSION2.md) §B y [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §4. |
| **A3** | Desalineación módulo vs `PLAN_DESARROLLO_VERSION2` | **Precedencia:** 1) módulos `docs/v2/MODULO_*` y este archivo; 2) [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md); 3) plan maestro. Tras el acuerdo **A2 (abril 2026)**, el plan maestro **§B y §BD** y el módulo laboral quedan **alineados a `grupos_de_trabajo` (`gdt_*`) y `efectores` (`efe_*`)**; la redacción con una sola colección `grupos` es **reemplazada** en documentos actualizados. Cualquier texto residual aún con `grupos` / `grp_*` unificado = **migrar al cerrar** esa revisión. |
| **A4** | Tarea “revisar `REVISION_ALINEACION` fila a fila” | Es **tarea de mantenimiento continuo**, no una decisión única. Cualquier cierre de fila se registra en el **changelog** de `REVISION_ALINEACION_PLAN_V2.md` con fecha. |

---

## B. Datos personales

| ID | Tema | Definición acordada (propuesta) |
|----|------|----------------------------------|
| **B1** | Campos **[P]** (política vs esquema) | **Cerrado (chat 23/04):** **mantener** la redacción actual. Los **[P]** son “definidos por producto/hospital”. El checklist de perfil **COMPLETO** debe poder **configurarse** (ideal `cfg` / versión de perfil), no lista fija en código. Sin `cfg` de versiones, la lista P del módulo = **anexo normativo** del MVP documental. |
| **B2** | `perfil_completitud_version` | **Cerrado (chat 23/04):** el número en `personas` sigue siendo **puntero** a exigencias; el documento en `cfg_*` con la lista por versión queda como **recomendación** (no obligación de implementar `cfg` en el primer MVP). *Si el MVP no incluye cfg:* número + tabla en documentación/seed, como ya decía el texto. |
| **B3** | Lugar de nacimiento: id vs texto | **Cerrado (chat 23/04):** `lugar_nacimiento_texto` es **informativo** (ficha/legibilidad); **no** se considera variable de negocio crítica ni se reutilizará en reglas o integraciones posteriores en V2. Si existe catálogo, puede usarse `lugar_nacimiento_id` por coherencia; **no** forzar lógica pesada de doble fuente de verdad para este campo. |
| **B4** | `consentimientos` e idioma | **Cerrado (plan unificado 23/04):** **dirección** = `idioma_id` → `cfg_idioma`. **MVP / primer entregable:** aceptado **string BCP-47** como trazabilidad **mientras** no exista `cfg_idioma` en seed; no usar como catálogo de reglas. Migración a `idioma_id` cuando el `cfg` esté. Ver [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md) §4 y §9. |
| **B5** | Historial de cambios en `familiares[]` vs `evt_*` | **Cerrado (chat 23/04):** criterio del documento. **Trazabilidad de negocio** = `eventos_ticket` (`evt_*`) con `tipo_evento_id`. No historial largo en el array; snapshots de fila solo en **cierre** de envío/auditoría si aplica. |
| **B6** | `payload` de `eventos_ticket` | **Cerrado (chat 23/04):** se **acepta** el contrato: el `payload` contiene **referencias** (ids, códigos cortos), **no** copia completa de `personas` u otros documentos. Tamaño acotado; criterio de corte en implementación (Rulebook + revisión de seguridad). |
| **B7** | Crear `declaraciones_grupo_familiar` en paso A (alta RRHH) | **Cerrado (chat 23/04):** en el **primer alta** (mínima RRHH) se **crea** el documento `gf_*` **aunque** el usuario **no haya** abierto o completado la DDJJ. `estado_declaracion_id` = valor en `cfg` equivalente a **“no iniciada”** (o el código acordado en seed) para que Ticket y reportes **lean siempre** por id. |
| **B8** | Gating al menú (paso E) | **Cerrado (chat 23/04):** el **servidor manda** la transición a “menú completo” / **activo portal** (Callable o lógica de backend), combinando criterios (cuenta + `estado_perfil_datos` + flujo B/C/D según [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md)). **No** basta con una condición hecha **solo** en el cliente. |
| **B9** | Checklist de pendientes al final de `MODULO_DATOS_PERSONALES` | **Cerrado (chat 23/04):** se mantiene la **metodología** del documento. Cada `[ ]` del módulo se cierra con criterio explícito (en el módulo o vía `cfg`); **este** archivo de decisiones **no** reemplaza ese checklist y solo aloja criterios **estructurales** (B1–B**10** y cruces C/D). |
| **B10** | Nombre de `cfg_estado_declaracion_ddjj` | **Cerrado (chat 23/04):** el nombre canónico en documentación y seeds sigue siendo **`cfg_estado_declaracion_ddjj`**. Los **estados** de la DDJJ son **configurables** (documentos en ese catálogo + seed); convención de `cfg_*` según módulo configuración. |

---

## C. Datos laborales

| ID | Tema | Definición acordada (propuesta) |
|----|------|----------------------------------|
| **C1** | Campos de enlace en `hlc_*` (trabajo vs efector) | **Cerrado (chat 23/04):** **confirmado** — mismo criterio **A2**: `grupo_de_trabajo_id` → `gdt_*`; `efector_designacion_id` y `efector_cumplimiento_id` → `efe_*`. Ver [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §4.3 y plan maestro §B. |
| **C2** | Alineación `hld_*` / `hlg_*` con plan maestro | **Cerrado (chat 23/04):** **confirmado** — nombres y prefijos según **PLAN_DESARROLLO_VERSION2** §B; ante duda, plan maestro y [`REVISION_ALINEACION_PLAN_V2.md`](./REVISION_ALINEACION_PLAN_V2.md). |
| **C3** | `referencias_normativa_designacion` vacío | **Cerrado (chat 23/04):** criterio **estricto** — **al menos un** ítem al dar de alta el cargo, salvo **excepción** con aprobación RRHH y trazabilidad (`evt_*` y/o flag). Sin atajos habituales de array vacío. |
| **C4** | Subnivel (reparto de carga) en módulo laboral | **Cerrado (chat 23/04):** el **total** del cargo sigue en `hlc_*` (`carga_horaria_total`). El **reparto** de horas respecto de ese total se aborda al **vincular asignación a `grupo_de_trabajo`** en el desglose del modelo (**`hld_*` / `hlg_*`**, `grupo_de_trabajo_id` → `gdt_*` según plan maestro §B), no como única cifra aislada sin desglose cuando el producto requiera reparto. *Complemento **C10** (nivel en burbuja + carga por día).* |
| **C10** | Nivel de jerarquía y carga **por grupo de trabajo** (`hlg_*`) | **Cerrado (chat 23/04):** por cada vínculo del **usuario** (`persona_id`) a un **grupo de trabajo** concreto dentro del encuadre del cargo (fila en **`historial_laboral_grupos`**, `hlg_*`) deben definirse: **vigencia** (`fecha_inicio` / `fecha_fin`); **`nivel_jerarquia_id`** → `cfg_nivel_jerarquia` (nivel aplicable a ese `persona_id` **en esa burbuja**); y **`carga_por_dia_semana`** (lista de pares `dia_semana_id` → `cfg_dia_semana` + `horas` numéricas) para desagregar la jornada **día a día**. Esos datos son insumo de **burbujeo, Ticket, informes y reglas** posteriores. El **`nivel_jerarquico_numero` opcional en `hlc_*`** no sustituye al nivel **por grupo**; si coexisten, predomina el definido en `hlg_*` para preguntas de organigrama. **Coherencia:** la suma semanal derivada de `hlg_*` debe ser reconciliable con `carga_horaria_total` de `hlc_*` (validación en dominio/Callable, tolerancia según reglas). |
| **C5** | Efector (cumplimiento) en validaciones y RFC fusión con organigrama | **Cerrado (chat 23/04): (1) Uso operativo:** **`efector_cumplimiento_id`** (y en general las FK a **`efe_*`** en `hlc_*`) deben ser **tenidas en cuenta** en **validaciones** y **filtrados** posteriores (**por id**), p. ej. listados, reglas y cruces con Ticket — **no** son solo descriptivos. **(2) RFC “un solo nodo” efector+organigrama:** sigue **fuera de alcance** V2 inicial; si el hospital lo pide, **nuevo RFC**; el contrato de **tres FK** (A2) se mantiene. |
| **C6** | Fusión 1:1 entre un `efector` y un nodo de `gdt_*` | **Pendiente (chat 23/04):** *no definido* en esta sesión. Hasta acuerdo: el texto de referencia sigue siendo “no requerida en V2; RFC futuro” (módulo laboral §10). Revisar en reunión o RFC. |
| **C7** | Matriz de ownership (§8) | **Pendiente (chat 23/04):** qué **puede ver** el usuario (agente) en laborales y demás matices de rol se **definirá más adelante** con [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) + matriz del módulo laboral §8; esta fila no sustituye ese trabajo. |
| **C8** | Seeds `cfg_*` laborales | **Pendiente (chat 23/04):** criterio de seeds *aún no fijado* por el equipo. **Referencia documental** vigente: inventario **§6** módulo laboral + `MODULO_CONFIGURACION` §5.1 (placeholders → ULIDs en despliegue) hasta nueva decisión. |
| **C9** | Unificación con doc **Ticket** (otra PC) | **Pendiente (chat 23/04):** criterio de cierre *aún no fijado*. **Guía** sin cambio: al fusionar ramas/docs, alinear nombres (`hlc_*`, `gdt_*`, `efe_*`); checklist [`UNIFICACION_OTRA_PC_Y_TICKET.md`](./UNIFICACION_OTRA_PC_Y_TICKET.md) y §9 módulo laboral. Registrar cierre en changelog cuando se defina. |

---

## D. Cruce con Login, configuración y Ticket

| ID | Tema | Definición acordada (propuesta) |
|----|------|----------------------------------|
| **D1** | Alineación secuencia A–E | **Cerrado (chat 23/04):** criterio de **una sola fuente** para la **secuencia** (A–E / equivalente): no pueden convivir narrativas distintas sin arreglarlo. Ante contradicción entre [`MODULO_DATOS_PERSONALES`](./MODULO_DATOS_PERSONALES_V2.md) §1.1, [`MODULO_LOGIN` §4–5](MODULO_LOGIN_V2.md) y [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md), **unificar** en **un** documento ancla (recomendado: el **flujo** `FLUJO_V2_…`) y referenciarlo desde el resto. |
| **D2** | Transiciones de `estado_acceso` y `estado_perfil_datos_id` | **Cerrado (chat 23/04):** **confirmado** — transiciones a estados “finales” o que **habiliten menú** = **solo servidor** (Callable / Admin). Grafo documentado con `cfg` + orden de desarrollo; *no* solo cliente. |
| **D3** | Ticket y prerequisito DDJJ | **Cerrado (chat 23/04):** **una sola fuente de verdad** del estado de la DDJJ en **`declaraciones_grupo_familiar` (`gf_*`)** vía `estado_declaracion_id`. Requisitos por tipo de solicitud en `cfg` — Ticket **no** reimplementa en paralelo “¿omitió en onboarding?”. |
| **D4** | Ticket lee laborales | **Cerrado (chat 23/04):** mínimo de **lectura** para resolver pantallas/labels: `persona_id`, `hlc_*` **vigentes**, nombres vía **`gdt_*`**, **`efe_*`**, `cfg_*`; **sin** jefe en `hlc_*`; jerarquía = lógica Ticket. **No** se exige que Ticket **filtre** por `efector_cumplimiento_id` — el criterio de asignación/filtrado alineado al producto es por **`grupos_de_trabajo`** asignados o relevantes al usuario. *Otras reglas/ módulos pueden seguir usando efector (ver **C5**).* |

---

## E. Post-onboarding, cuenta y producto (criterios de chat — 23/04/2026)

| ID | Tema | Definición acordada (propuesta) |
|----|------|----------------------------------|
| **E1** | Edición de datos personales (post registro) | **Cerrado (chat 23/04):** el **agente** **no** puede modificar **DNI**, **nombre** ni **apellido** (lectura o corrección vía flujo **RRHH** / administración). **Sí** puede actualizar, según contrato, **domicilio**, **teléfono**, **estado civil**, **formación** y demás campos no bloqueados. Cada cambio relevante debe dejar **toma de conocimiento** de **RRHH** (p. ej. `eventos_ticket` con `tipo_evento_id` adecuado y `payload` por **referencias** — **B6**; bandeja o reporte = implementación). |
| **E2** | Email de acceso vs dato informativo | **Cerrado (chat 23/04):** en el **primer acceso** el **usuario** define el **correo** que se usa en **Auth** y en **`usuarios_cuenta.username`**. Ese correo puede mostrarse o replicarse como **informativo** en la ficha (p. ej. en `personas.contacto` o solo lectura desde cuenta — coherente con **§2.2** del anexo). El **cambio de contraseña o de correo** (como en V1 en otra sección) queda en un **módulo aparte** (p. ej. *usuario y contraseña* / seguridad de cuenta), no en el flujo de edición de ficha de datos personales. |
| **E3** | Notificaciones y recordatorios | **Pendiente (chat 23/04):** no hay reglas aún. Módulo futuro de **notificaciones y recordatorios** (qué dispara, tiempos, canales). No bloquea contrato de datos personales. |
| **E4** | Carga masiva | **Cerrado (chat 23/04):** se abordará **después** de operar el flujo manual. **Ahora** solo **carga manual** (alta RRHH paso A). |
| **E5** | Foto de rostro en onboarding / registro | **Cerrado (chat 23/04):** en el módulo de **datos personales**, durante el registro u onboarding, debe existir la opción de **foto de rostro** (captura con **cámara** del celular en el momento o **adjunto** de imagen). **Contrato en anexo:** `personas.foto_rostro` (mapa, ítem **103**), §**3.12** y **§4.1.1**; obligatoriedad por **lista P 18**; cruce transversal **E1** / `eventos_ticket` al reemplazar imagen. |
| **E6** | Datos de `familiares[]` | **Cerrado (chat 23/04):** el **esquema** de cada ítem ya está en anexo **§3.10** y **§7.2** (`familiar_linea_id`, `parentesco_id`, nombre, apellido, campos **[P]** 88–92, etc.). Lo que puede **faltar por hospital** es solo **política** sobre **[P] 15–17** (DNI / fecha nac. / discapacidad: menores, excepciones) — checklist con RRHH, no redefinir el modelo. |

> **Aclaración (no es un ID de producto):** en un mensaje previo, el punto “derechos del interesado / portabilidad (ARCO)” era **tema legal y gobernanza de datos** (export, plazos), no una función concreta del anexo. Si el hospital no lo exige, puede quedar **fuera** de la primera entrega.  
> **Aclaración (no es un ID de producto):** **B4** en consentimientos se refiere al **idioma en que se aceptó el texto** (trazabilidad legal). Eso **no sustituye** un eventual “**idioma de la interfaz**” del portal; si más adelante se define, conviene tratarlo en **configuración / preferencias de usuario**, separado de **B4**.

---

## F. Fase 0 — arranque BD y código (login + personales V2)

| ID | Tema | Definición acordada |
|----|------|---------------------|
| **F0.1** | `request.auth.uid` → `persona_id` en **Security Rules** | **Cerrado (23/04/2026):** **custom claims** en el token de Auth: mínimo `persona_id` (`per_<ULID>`); **recomendado** `cuenta_id` (id doc `usuarios_cuenta`). Establecer y refrescar vía **Admin SDK** (Callables: paso B, sync de sesión, cambio de roles si se materializan en claims en el futuro). **Rules** condicionan con `request.auth.token.persona_id`. **No adoptado** para el MVP: resolver el dueño del documento **solo** con `get()` a `usuarios_cuenta` en cada evaluación de regla. Texto canónico: [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§3.3**; matriz: [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md). |
| **F0.2** | Proyecto Firebase “primero” (vs V1) | **Criterio documental:** despliegue y BD de **V2** en proyecto **diferente** a producción V1; nombre del proyecto V2 a anotar en [`ARRANQUE_BD_Y_CODIGO_V2.md`](./ARRANQUE_BD_Y_CODIGO_V2.md) cuando exista. |
| **F0.3** | Independencia de V1 | **Sin cambio:** sin migración ni lectura/escritura de recursos V1 desde V2; [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) y [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md). |

---

## Cómo usar esto

1. Revisar tabla por tabla en **reunión breve**; quien disienta ajusta y se actualiza este archivo.
2. Los IDs (**A1**, **B2**, etc.) permiten **referir en issues** (“Aceptada B7”).
3. Cuando se estabilice, se puede añadir columna `Estado: OK | Revisar` o mover ítems cerrados a changelog abajo.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-23 | Creación: decisiones iniciales de revisión personales + laborales (A–D). |
| 2026-04-23 | **A1** y **A2** cerrados por chat: `formacion_agente`; `grupos_de_trabajo` (`gdt_`) + `efectores` (`efe_`) + tres FK en `hlc_*`. **C1** alineado a A2. |
| 2026-04-23 | **A3** ajustada: plan maestro y módulo laboral **actualizados** a `gdt_*` / `efe_*` (coherente con A2). **C5, C6, C9, D4** re-redactados. **C4** referencia §4.5 del módulo laboral. |
| 2026-04-23 | **B1, B2, B3, B5** cerrados por chat: mantener criterio **[P]**; B2 = recomendación; B3 = texto informativo, sin uso en reglas/integraciones; B5 aceptado. **B4** ampliada (qué es idioma en consentimientos; string BCP-47 vs `idioma_id`). |
| 2026-04-23 | **B6–B10** cerrados: B6 = payload solo referencias; B7 = crear `gf_*` en primer alta aunque DDJJ no tocada; B8 = servidor manda gating; B9 = metodología checklist; B10 = nombre `cfg_estado_declaracion_ddjj` + estados **configurables** en `cfg`. |
| 2026-04-23 | **C10** cerrado: nivel de jerarquía **por `gdt_*` en `hlg_*`**, carga **por día de semana** (`carga_por_dia_semana` + `cfg_dia_semana`); supersedes de facto uso exclusivo de `nivel` solo en `hlc_*` para organigrama. **C4** remite a C10. |
| 2026-04-23 | **C — datos laborales (chat):** **C1, C2** ok. **C3** estricto (mínimo un ítem referencias normativas). **C4** reparto de horas al vincular `grupo_de_trabajo` en `hld_*`/`hlg_*`. **C5** = uso de `efector_cumplimiento_id` (y `efe_*` en `hlc_*`) en validaciones/filtrados por id; RFC fusión nodo = fuera V2. **C6, C8, C9** pendientes. **C7** visibilidad agente = más adelante con `ACCESO_Y_RULES` + §8. |
| 2026-04-23 | **D — cruce (chat):** **D1** una sola fuente secuencia (recom. anclar en `FLUJO_V2_…`). **D2** confirmado (servidor). **D3** SSoT DDJJ = `gf_*`. **D4** Ticket: filtrado / foco asignación por **`gdt_*`** (grupos de trabajo al usuario), no obligatorio filtrar por efector cumplimiento; C5 aplica a otros módulos/reglas. |
| 2026-04-23 | **B4** cerrado: MVP puede BCP-47; migrar a `idioma_id` con `cfg_idioma`; alineado plan unificado módulo personales. **Cierre documental** módulo personales en [`MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md`](./MODULO_DATOS_PERSONALES_PLAN_DESARROLLO_UNIFICADO_V2.md) §11. |
| 2026-04-23 | **Sección E** (E1–E6 + aclaraciones): edición de ficha; email informativo + módulo cuenta; notificaciones TBD; carga manual; **E5** foto de rostro (contrato en anexo §3.12 / P 18); familiares = esquema listo, **[P] 15–17** con RRHH; notas ARCO e idioma UI vs **B4**. |
| 2026-04-23 | **Sección F (F0):** **F0.1** = custom claims `persona_id` / `cuenta_id` para Rules; alineado `MODULO_LOGIN` §3.3. **F0.2** referencia a checklist de arranque. **F0.3** criterio de independencia V1. |
