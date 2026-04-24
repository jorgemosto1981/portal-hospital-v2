# Módulo de Login y acceso — Plan V2

**Estado del plan (documentación):** **avanzado** (referencia para implementación); *pendiente de nueva revisión*; ver [`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) y [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) (criterios de alineación). **Orden y encargo de desarrollo:** [`INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md`](./INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md), [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md). La **implementación de código** V2 es fase posterior; **sin** migración ni conexión técnica con la V1 ([`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) — regla básica).

**Ámbito:** autenticación, sesión, recuperación de credenciales y **reglas que permiten o bloquean el inicio de sesión**, en coordinación con `usuarios_cuenta` (`usr_<ULID>`) y el proveedor de identidad (p. ej. Firebase Auth).

**Relación con otros módulos:**

- **Guía de implementación (flujo Login + datos personales + gating):** [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md).
- **Firestore / Callables / Security Rules:** [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md).
- **`persona_id` (`per_<ULID>`):** identidad estable del agente ([`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)).
- **Datos personales:** ficha `personas`; el login **no** debe duplicar campos demográficos.
- **Estado de acceso y onboarding:** el **flujo operativo** está en **§4**; la **persistencia de estados** es solo por **`*_id`** → `cfg_*` (**§4.0** y **§5**). Detalle campo por paso en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§1.2**.

---

## 1. Objetivos del módulo

1. Autenticar al usuario de forma segura (**PIN** normativo de **§1.1**, y a futuro MFA si se define).
2. Resolver **`auth_uid`** → **`cuenta`** → **`persona_id`** para cargar sesión y permisos.
3. Definir **cuándo se permite** `signIn` exitoso (estado de cuenta + persona + políticas de onboarding). **Nota V2:** con cuenta en *pendiente registro* (paso A) **no** existe usuario en Auth aún: el acceso previo es por **flujo dedicado** (paso B). Tras el paso B, el usuario inicia sesión en pantalla con **DNI + PIN** (§1.1); la capa técnica resuelve a `username` + PIN para el proveedor Auth cuando corresponda (**§1.3**); ver [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) **§11**.
4. Gestionar **cierre de sesión**, **expiración**, **recuperación de PIN/contraseña** y **cambio de email** con trazabilidad (`evt_`).

---

## 1.1 Credenciales de acceso V2 *(regla de producto obligatoria)*

1. **Identificador que el agente escribe al iniciar sesión** (sesiones posteriores al paso B): el **número de documento (DNI)** tal como figura en `personas.dni` para esa cuenta (validación y normalización — p. ej. sin puntos — según reglas del hospital).
2. **Contraseña:** **exclusivamente** un **PIN numérico de exactamente 6 dígitos** (`0`–`9`), **elegido por el agente** en el **primer acceso (paso B)**, en la **misma** interacción en que informa su **correo electrónico**. No se admiten contraseñas alfanuméricas “libres” para el portal salvo **RFC** explícito que derogue esta regla.
3. **Correo en paso B:** obligatorio declarar un email válido que se persiste como **`username`** (§2).
4. **Encaje con proveedor Auth (p. ej. Firebase):** el proveedor suele exigir par **`email` + `password`**. En V2, **`password`** en el proveedor **es siempre el PIN de 6 dígitos** (como cadena de seis caracteres numéricos) y **`email`** es **`username`**. La **UI** de login cotidiano muestra **DNI + PIN**; el cliente o un **Callable** resuelve **DNI →** `usuarios_cuenta` (y `username`) y luego ejecuta el `signIn` equivalente, **sin** mostrar el email en pantalla de login salvo decisión de producto explícita.

---

## 1.3 `signIn` frente a pasos A y B

- **Paso A (RRHH):** aún **no** hay usuario en el proveedor Auth; no aplica `signIn`.
- **Paso B (primer acceso):** el agente aporta **DNI**, **correo** y **PIN de 6 dígitos**; el backend valida, crea el usuario en Auth con **`username`** + PIN y vincula **`auth_uid`**.
- **A partir del fin de B:** los ingresos posteriores usan **DNI + PIN** en UI; técnicamente se traduce a **`signInWithEmailAndPassword(username, pin)`** u flujo equivalente documentado (p. ej. custom token), manteniendo la regla de **§1.1**.

---

## 2. Email único (contacto = login)

**Acuerdo V2:** existe **un solo correo** por cuenta de usuario. Se captura en el **paso B** junto con el PIN (**§1.1**).

- **Fuente de verdad única (sin duplicar en `personas`):** `usuarios_cuenta.username` (y el email del proveedor Auth asociado al `auth_uid`). La UI de “correo laboral / institucional” en la ficha del agente lo resuelve por **`persona_id` → lectura de `usuarios_cuenta`**; **no** se persiste copia en `personas.contacto.email_laboral` (evita divergencia y doble escritura).
- **Edición:** **solo** desde el **módulo Login** (alta, cambio de email con reautenticación, etc.). El formulario de datos personales **no** modifica el email.
- **Contraseña en Auth:** coincide con el **PIN de 6 dígitos** de **§1.1** (no es un segundo secreto distinto del PIN).

---

## 3. Entidades de datos

Contrato alineado con [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§3.7** (ítems 54–61) y **§2.2** (anti-duplicidad). Estados y métodos = **solo `*_id`** → `cfg_*`.

### 3.1 Colección `usuarios_cuenta` (`usr_<ULID>`)

| Campo | Tipo | Obligatorio / notas |
|-------|------|---------------------|
| `persona_id` | `string` | **[O]** FK `personas/{per_*}`. |
| `auth_uid` | `string` \| `null` | **[C]** UID en proveedor Auth: **`null`** solo en **paso A** (alta RRHH, antes de vincular Auth). Tras el **paso B** (§4.2) debe ser **no-null**. Alineado a [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§3.7 ítem 56**. |
| `auth_proveedor_id` | `string` \| `null` | **[X]** FK **`cfg_metodo_auth`** (password, OIDC, …). |
| `username` | `string` \| `null` | **[C]** Único correo de acceso desde el **fin del paso B** (**obligatorio no-null** en operación normal). Entre alta RRHH (A) y credenciales (B) puede ser **`null`** o ausente según implementación; debe alinearse con reglas Firestore. **§2** (no hay copia en `personas`). Detalle en [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) **§11**. |
| `activo` | `boolean` | **[O]** Cuenta habilitada / bloqueada. |
| `estado_acceso` | `string` | **[O]** FK **`cfg_estado_cuenta_acceso`** (pendiente registro, onboarding datos, activo portal, bloqueado, …); **§5**. |
| `role_ids` | `array` de `string` | **[P]** Cada elemento FK **`cfg_rol`**. Sin map opaco de flags sin ids. |
| `creado_en` / `actualizado_en` | `Timestamp` | **[O]** Auditoría. |
| `cuenta_id` | `string` | Opcional en cuerpo (= id del path); **preferir solo `documentId`** (§2.2 datos personales). |

**Índices sugeridos:** `auth_uid` **único entre valores no nulos** (índice parcial / sparse según motor); `persona_id` único si regla 1:1 cuenta ↔ persona.

### 3.2 Proveedor Auth (Firebase u otro)

Artefacto **externo** a Firestore: usuario con **`uid`**, email, verificación, etc. Debe mantenerse **coherente** con `usuarios_cuenta.auth_uid` y `username`. La **contraseña** del registro en el proveedor es el **PIN de 6 dígitos** (**§1.1**); políticas del proveedor que exijan “complejidad” fuera de eso deben **desactivarse o ajustarse** para esta app o documentarse como riesgo aceptado.

### 3.3 Sesión, JWT y enlace `request.auth` → `persona_id` (Fase 0.1 — **cerrada** 23/04/2026)

**Problema:** en **Security Rules** de Firestore hace falta saber, de forma **barata y estable**, qué documento `personas/{per_*}` corresponde al usuario autenticado **sin** un `get()` adicional a `usuarios_cuenta` en cada evaluación de regla (coste, complejidad y límites del motor).

**Decisión — custom claims en el ID token de Firebase Auth (Admin SDK):**

1. Tras el **paso B** (y en todo ingreso en que haya que refrescar), el backend asigna en el token (vía `setCustomUserClaims` o equivalente) al menos:
   - **`persona_id`:** `per_<ULID>`, **obligatorio** para el agente con sesión válida.
   - **`cuenta_id`:** id del documento en `usuarios_cuenta` (recomendado; evita ambigüedad si en el futuro hubiera más de un vínculo, aunque en V2 el contrato es 1:1 persona–cuenta operativa).
2. **Materialización de `role_ids` en claims:** *opcional* en el MVP. Si el tamaño o la frecuencia de cambio lo complican, los **roles** se leen desde `usuarios_cuenta` en **Callables** o en el cliente con reglas que permitan **solo** lectura del doc propio; no bloquea la regla de **§3.3** para `persona_id`.
3. **Security Rules:** preferir condiciones del tipo `request.auth.token.persona_id == resource.data.persona_id` o `request.auth.token.persona_id == <id en path>` según el diseño de paths en [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md).
4. **Cliente:** tras `signIn` o `onAuthStateChanged`, forzar `getIdToken(true)` si un Callable acaba de actualizar claims. Si faltan claims (borde, usuario antiguo), un **Callable** `syncSessionClaims` (o nombre acordado) re-sincroniza desde `usuarios_cuenta` + Auth.
5. **Alternativa no adoptada para el vertical login + personales:** resolver **solo** con `get(/databases/(default)/documents/usuarios_cuenta/...)` en Rules buscando por `auth_uid` — posible en motores que lo permitan, pero más costoso y verboso; reservada solo si en un entorno concreto los claims no fueran viables (documentar excepción en ese caso).

**Límite técnico:** el payload de custom claims en Firebase es acotado (~1 KiB); `persona_id` + `cuenta_id` + un subconjunto acotado de metadatos entra holgadamente; no materializar listas largas de roles en claims salvo diseño explícito.

### 3.4 Colección `eventos_ticket` (`evt_<ULID>`) — eventos de login

Misma convención que datos personales: **`tipo_evento_id`** → **`cfg_tipo_evento`** (no strings libres). Payload mínimo con `persona_id` / `cuenta_id` según el tipo. Detalle en `MODULO_DATOS_PERSONALES_V2.md` §3.11 y §8.

---

## 4. Flujo operativo acordado (alta RRHH → onboarding → app)

### 4.0 Regla de persistencia: estados solo por ID

En BD y reglas **no** se identifica un estado por texto humano ni por string mágico de aplicación. Todo estado de negocio relevante (acceso al portal, perfil de datos, DDJJ, tipo de evento) se guarda como **`*_id`** apuntando a documentos en **`cfg_*`** (semilla administrable). Las tablas de **texto** (`nombre`, observaciones) no sustituyen a esos ids.

El desglose **campo por paso** del flujo (incl. riesgos) está en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§1.2**.

---

Flujo de negocio **definido a nivel producto** (22/04/2026; revisable). La implementación técnica (Firebase Auth con DNI, custom claims, rutas gating, etc.) se detalla al codificar; aquí se fija la **secuencia** y el **gating** de la UI.

### 4.1 Alta por RRHH

1. Un usuario con rol **RRHH** da de alta a un agente nuevo ingresando como mínimo **DNI**, **nombre** y **apellido**.
2. El sistema crea o activa la **ficha canónica** en `personas` (`persona_id` = `per_<ULID>`) y el vínculo de **cuenta** prevista en `usuarios_cuenta` (`usr_<ULID>`), según el modelo ya descrito en datos personales.
3. El agente queda en un estado de producto equivalente a **“usuario pendiente de registrarse o loguearse”**: aún **no** debe ver la app con menúes completos; solo el camino de **primer acceso / registro de credenciales**.

### 4.2 Primer acceso: identificación por DNI y alta de credenciales

1. El agente inicia el **primer acceso** identificándose con su **DNI** (lookup contra `personas.dni` / cuenta asociada).
2. En ese **mismo** flujo declara su **correo electrónico** y **define su PIN de acceso** según **§1.1** (**exactamente 6 dígitos numéricos**). Queda persistido `username` según **§2** (fuente de verdad; sin copia en `personas`, ver datos personales §2.2). En la misma operación (o transacción) que **crea el usuario en Auth** con **`username`** + **PIN como `password`**, debe persistirse **`auth_uid`** en `usuarios_cuenta` y actualizarse **`estado_acceso`** al valor cfg de *onboarding datos* (ver [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) **§6**).
3. Tras este paso existe **sesión autenticada**, pero el **enrutador** debe enviar al usuario al **wizard de datos personales** (paso C): aún **no** se habilitan los menúes generales de la app.

### 4.3 Onboarding obligatorio: datos personales

1. En el **primer ingreso** (y hasta cumplir el requisito), el usuario debe **cargar o completar** toda la información personal exigida por el checklist del hospital: entre otros, **nombre y apellido** (confirmación o edición según reglas), **fecha de nacimiento**, **domicilio**, datos de **contacto** pertinentes, **formación** en **`formacion_agente`** y el resto de campos necesarios para alcanzar el perfil **`COMPLETO`** (o el umbral que definan **`estado_perfil_datos_id`** + `perfil_completitud_version` en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md)).
2. El **correo** mostrado en ficha como laboral/institucional sigue siendo el de **login**; no se “elige otro mail” en este paso desde datos personales.

### 4.4 Declaración jurada de grupo familiar (DDJJ)

1. **Después** del bloque de datos personales obligatorios, el titular puede **cargar la DDJJ de grupo familiar en el mismo flujo de onboarding o en un momento posterior**.
2. **Criterio de bloqueo del menú principal:** la **DDJJ familiar no bloquea** el acceso a menúes una vez cumplido el onboarding de **datos personales** (el usuario puede usar el portal sin haber cerrado la DDJJ).
3. **Registro obligatorio del “estado DDJJ” para el futuro:** aunque sea **opcional en el primer login**, el sistema debe **persistir** de forma consultable si el titular **completó / envió** una DDJJ aceptable o si **omitió explícitamente** “por ahora” (con marca de tiempo y, si aplica, usuario). Ese registro es el que usará el **módulo Ticket / Solicitudes** para exigir DDJJ **completada** antes de abrir ciertos tipos de solicitud (reglas en configuración de tickets, no hardcodeadas). Detalle en [`MODULO_DATOS_PERSONALES_V2.md`](./MODULO_DATOS_PERSONALES_V2.md) **§2.1** (DDJJ) y colección **`declaraciones_grupo_familiar`** (§7).
4. Si el hospital decidiera en el futuro **bloquear menúes** hasta DDJJ, se documentará como cambio de política y se ajustará la §5.

### 4.5 Acceso a la app y menúes

1. **Recién entonces** —es decir, con **credenciales válidas** y **onboarding de datos personales cumplido** según §4.3— el usuario accede a la **app con menúes** habituales (home, módulos habilitados por rol, etc.).
2. Las **rutas protegidas** del portal deben componer la condición de acceso leyendo **`usuarios_cuenta.estado_acceso`** (§5) y, en su caso, **`personas.estado_perfil_datos_id`** (misma regla: ids a `cfg_*`).

---

## 5. Estados de acceso a la cuenta (`estado_acceso`)

En **`usuarios_cuenta`** el campo persistido es **`estado_acceso`** (`string`): FK al documento en **`cfg_estado_cuenta_acceso`** (nombre tentativo de colección). Cada documento de catálogo puede tener campos de presentación (`codigo_interno`, `titulo_ui`, `permite_menu_principal`, `orden`) **solo en cfg**, no en la cuenta.

**Ejemplos de *códigos internos* en el documento de cfg** (ilustrativos; la app compara **ids**, no estos strings en `usuarios_cuenta`): pendiente registro, onboarding datos, activo portal, bloqueado.

**Transiciones:** al completar §4.2 se asigna el **id** cfg correspondiente a “onboarding datos”; al completar §4.3 el **id** “activo portal”. Los kill-switch `usuarios_cuenta.activo` y `personas.activo` siguen anulando acceso aunque el id de estado diga “activo”.

**Coherencia con persona:** `personas.estado_perfil_datos_id` (FK `cfg_estado_perfil_datos`) debe avanzar en lockstep lógico con el onboarding; si divergen por fallo de red, un job o transacción debe reconciliar.

**Función de regla (Rulebook):** `puedeVerMenuPrincipal(cuenta, persona)` resuelve los documentos cfg por `estado_acceso` y `estado_perfil_datos_id` (o lee flags materializados en cfg) y exige `cuenta.activo` y `persona.activo`. La **DDJJ familiar** no entra aquí salvo política explícita (§4.4). Ticket usa **`cfg_requisitos_ticket`** + `declaraciones_grupo_familiar.estado_declaracion_id`.

---

## 6. Flujos técnicos a planificar (checklist implementación)

- [ ] Primer acceso por **DNI** vinculado a `personas` / `usuarios_cuenta`; captura **correo + PIN 6 dígitos**; creación en **Auth** con `username` + PIN (**§1.1**, §4.2).
- [ ] Gating de rutas según `estado_acceso` (§5) + `estado_perfil_datos_id` + joins a `cfg_*`.
- [ ] Login subsiguiente: **UI DNI + PIN**; resolución a `username` + PIN para el proveedor (**§1.1**).
- [ ] Recuperación de **PIN** (y cambio de email) solo vía módulo Login (§2); flujos acordes a entropía acotada del PIN.
- [ ] Bloqueo por intentos fallidos / cuenta deshabilitada.
- [ ] Cierre de sesión y timeout de inactividad.
- [ ] Persistencia de transiciones en `eventos_ticket` (`evt_*`) con **`tipo_evento_id`** → `cfg_tipo_evento`.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación del plan; estado de usuario delegado a este módulo; vínculo con datos personales. |
| 2026-04-22 | §2 **Email único:** `username` = contacto; edición solo desde login; réplica opcional en `personas`. |
| 2026-04-22 | §2 **Sin duplicar email en `personas`:** solo `usuarios_cuenta.username`; ficha por join (`MODULO_DATOS_PERSONALES_V2` §2.2). |
| 2026-04-22 | **§4 Flujo operativo** (RRHH → DNI + email/password → onboarding datos → DDJJ opcional en tiempo → menúes); **§5** `estado_acceso` sugerido (`PENDIENTE_REGISTRO`, `ONBOARDING_DATOS`, `ACTIVO_PORTAL`). §6 checklist técnico. |
| 2026-04-22 | §4.4: DDJJ opcional para menú; **obligatorio persistir** omitido vs completado para prerequisitos del módulo Ticket. |
| 2026-04-22 | **§4.0** regla estados solo por id; **§5** `estado_acceso` → `cfg_estado_cuenta_acceso` (sin strings mágicos en cuenta). |
| 2026-04-22 | **§3** entidades alineadas a datos personales: tabla `usuarios_cuenta` (`auth_proveedor_id`, `role_ids`, `estado_acceso`, …); **§3.4** `eventos_ticket` con `tipo_evento_id`. Ajustes §4.2–4.3–4.4 (sin réplica email; `estado_perfil_datos_id`; ref DDJJ §2.1/§7). |
| 2026-04-22 | Enlace a [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md); **`auth_uid`** en §3.1 como **[C]** `string\|null` + índice sparse; §4.2 refuerzo transacción Auth ↔ Firestore y redirección explícita a paso C. |
| 2026-04-22 | §1.3 aclaración `signIn` vs paso A/B; §3.1 **`username`** **[C]** `string\|null` entre A y B. Changelog 22/04 **“réplica opcional en personas”** quedó **obsoleto** frente a §2 actual (sin copia de email de login en `personas`). |
| 2026-04-22 | Enlace [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md) (matriz acceso, Callables, Rules). |
| 2026-04-22 | Cabecera: **doc avanzada**; enlaces a `PLAN_MODULOS_V2` y `V1_VS_V2_LOGIN_DATOS` (criterios de alineación). |
| 2026-04-23 | *Cerrado* → **avanzada; pend. revisión**; *DoD* → criterios de alineación. |
| 2026-04-22 | Cabecera: enlaces a `INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2` y `DESARROLLO_ORDEN_LOGIN_DATOS_V2`. |
| 2026-04-22 | Cabecera: **regla básica** V2 independiente de V1 (`PLAN_MODULOS_V2`); sin migración ni conexión técnica con V1. |
| 2026-04-22 | **§1.1 / §1.3:** usuario = **DNI** en pantalla; contraseña = **PIN numérico 6 dígitos** + correo en paso B; Auth `password` = PIN; §4.2 y §6 alineados. |
| 2026-04-23 | **§3.3** cerrado (Fase 0.1): enlace `auth` → `persona_id` vía **custom claims** (`persona_id`, `cuenta_id` recom.); Rules usan `request.auth.token.*`; alternativa con `get()` a `usuarios_cuenta` en Rules no adoptada para MVP. |
