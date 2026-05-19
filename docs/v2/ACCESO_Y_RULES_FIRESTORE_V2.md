# Acceso a datos V2 — Firestore, Cloud Functions y reglas

**Propósito:** bajar a **decisiones implementables** el modelo de permisos entre **alta RRHH (A)**, **primer acceso (B)** y **onboarding datos (C)**, alineado a [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) y a [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md).

**Fecha:** 22 de abril de 2026.

**No sustituye** el Rulebook final ni reglas `.rules` pegadas en repo: define **patrón** y **matriz** para que quien codifique no deje huecos (p. ej. `username` = `null`, transiciones de estado, escritura en `evt_*`).

**Ámbito:** reglas y Callables aplican **solo** al proyecto Firebase / Firestore de la **V2**, sin lectura ni escritura sobre colecciones de la V1 ([`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md) — regla básica).

**Credenciales (producto):** el paso B y el login deben cumplir [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§1.1** (DNI + PIN de **6** dígitos + correo). Los Callables que registren primer acceso deben **validar** el PIN con patrón `^\d{6}$`, rechazar PIN fuera de rango y aplicar **rate limiting** / bloqueo por intentos (riesgo de entropía acotada).

---

## 1. Principio rector

**Las transiciones que combinan Auth + Firestore + cambio de `estado_acceso` / `estado_perfil_datos_id` no deben depender de escrituras directas desde el cliente sin validación server-side.**

Patrón recomendado V2:

| Capa | Rol |
|------|-----|
| **Cliente** | UI, lecturas permitidas por reglas, llamadas a **Callable HTTPS** o **REST** detrás de verificación de identidad. |
| **Cloud Functions / backend** | Valida DNI, crea usuario Auth, escribe `usuarios_cuenta` y transiciones de estado en **lote atómico** (Admin SDK / transacción). |
| **Security Rules** | Evitan que un usuario modifique **datos ajenos**, campos **no editables** desde cliente, y **estados** que solo el backend debe mover. |

Así se cumple el orden del paso B (§6 del flujo) sin exponer “setear mi propio `estado_acceso` a activo portal”.

---

## 2. Identidad en reglas (`request.auth`)

- Tras el paso **B**, `request.auth.uid` existe y debe alinearse con **`usuarios_cuenta.auth_uid`**. **Rules / “datos propios”:** se usa **`request.auth.token.persona_id`** (y, si se declara, `cuenta_id`) vía **custom claims** — criterio cerrado en [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§3.3**. El **índice** y las queries por `auth_uid` en `usuarios_cuenta` siguen siendo necesarios para **Callables**, resolución DNI→cuenta y herramientas; no sustituyen a los claims en reglas.
- **Antes del paso B** no hay `request.auth` del agente en el flujo normal de primer acceso: el paso B se resuelve con **Callable sin sesión** o **sesión efímera** controlada por el proveedor (definición al implementar), no con escritura libre a `usuarios_cuenta` desde cliente anónimo.

---

## 3. Matriz resumida (lectura / escritura)

Leyenda: **S** servidor (Admin SDK / función privilegiada); **C** cliente autenticado agente; **R** rol RRHH/admin (app o consola); **—** no aplica.

| Colección / ruta | Paso A (RRHH) | Paso B (agente, sin Auth previo) | Post B (agente autenticado) | Notas |
|------------------|---------------|-----------------------------------|-----------------------------|--------|
| `personas/{per_*}` | **S** o **R** crea/edita alta mínima | **S** (p. ej. sync nombre) opcional; no edición libre anónima | **C** lectura propia; **C** escritura **solo** campos permitidos del formulario (ver §5) | Nunca `username` aquí. |
| `usuarios_cuenta/{usr_*}` | **S** o **R** crea doc con `auth_uid: null`, `username: null`, `estado_acceso` pendiente | **S** única vía Callable: setea `auth_uid`, `username`, `estado_acceso` onboarding | **C** lectura propia; **C** **no** debe poder setear `estado_acceso` a *activo portal* ni `auth_uid` | Transición a menú: **S** (Callable “cerrar onboarding”). |
| `formacion_agente/{for_*}` | — | — | **C** upsert **solo** doc donde `persona_id == claim.persona_id` | Validar checklist en **S** al cerrar C. |
| `consentimientos/{doc_*}` | — | — | **C** crear doc propio con validaciones; o todo **S** si se exige integridad estricta | Política `ip_origen` lista P 14. |
| `declaraciones_grupo_familiar/{gf_*}` | **S** opcional crea “no iniciada” | — | **C** lectura/escritura **solo** si `titular_persona_id == claim.persona_id` | |
| `cfg_*` | **S** / **R** | **C** lectura (si catálogos no sensibles) o **S** vía BFF | **C** lectura típica | **Escritura cfg:** solo **R** o proceso administración. |
| `eventos_ticket/{evt_*}` | **S** | **S** | **S** preferente; si **C** append, reglas muy estrictas + shape mínimo | Evitar payloads inflados (datos personales §2.4). |

---

## 4. Paso A — RRHH

- **Creación** de `personas` + `usuarios_cuenta`: preferentemente **Callable o job** con rol RRHH verificado (`request.auth.token.roles_hlc_vigentes` contiene `CFG_RRHH`, o legacy admin; ver [`RFC_ACCESO_ROLES_HLC_MENUS_V2.md`](./RFC_ACCESO_ROLES_HLC_MENUS_V2.md) y `firebase-v2/firestore.rules` → `portalRrhhOrAdmin()`), **no** regla que permita a cualquier usuario autenticado crear `personas` ajenas.
- Documento cuenta: `username: null`, `auth_uid: null`, `estado_acceso` = id cfg *pendiente registro*.

### 4.1 Configurador de artículos (`cfg_articulos` / `versiones`)

- **Grilla y listado de versiones (web):** `listarColeccion("cfg_articulos")` y `listarVersionesCfgArticulo` — solo **Callable** con `assertRrhh` (token `CFG_RRHH` ∈ `roles_hlc_vigentes` o legacy `portal_role`).
- **Editor «Gestionar» versión:** lectura/escritura **directa** en cliente sobre `cfg_articulos/{art_*}` y subcolección `versiones/{ver_*}` — exige **`portalRrhhOrAdmin()`** en [`firebase-v2/firestore.rules`](../../firebase-v2/firestore.rules).
- **Operación:** tras cambiar claims o rules, **`firebase deploy --only firestore:rules`** y **re-login**; si la grilla funciona pero falla Gestionar, casi siempre son rules desactualizadas o JWT sin `roles_hlc_vigentes`.
- **Handoff:** [`HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md`](./HANDOFF_SESION_2026-05-19_ROLES_HLC_CLAIMS.md) §3.

---

## 5. Paso C — Qué puede editar el agente en `personas` desde cliente

Opción **recomendada** (balance simplicidad / seguridad):

- El cliente **sí** puede actualizar campos “de ficha” (`domicilio`, `contacto`, `fecha_nacimiento`, …) **mientras** `request.auth` esté vinculado a esa `persona_id`.
- Para `personas`, los campos sensibles de identidad/estado administrativo (`dni`, `nombre`, `apellido`, `activo`, `motivo_baja_id`) quedan reservados a RRHH. En V2 se validan en backend y cualquier intento no RRHH se rechaza con `permission-denied`.
- Para rol usuario, edición de `personas` queda además acotada por acción (`accion_habilitada`) y solo permite sets de campos definidos (domicilio o teléfonos). Cambios fuera del set se rechazan en backend.
- En `formacion_agente`, `declaraciones_grupo_familiar` y `consentimientos`, fuera del onboarding el usuario opera en solo visualización desde pantalla de datos personales; cambios se canalizan por eventos de notificación RRHH.
- El cliente **no** puede establecer directamente `estado_perfil_datos_id` al id “completo” ni `usuarios_cuenta.estado_acceso` a *activo portal*: eso solo vía Callable **`completarOnboardingDatos`** que:
  1. Revalida checklist servidor.
  2. Escribe en **transacción** `personas.estado_perfil_datos_id` + `usuarios_cuenta.estado_acceso` + timestamps + `evt_*`.

Si se prefiere máximo control: **toda** escritura en `personas` durante onboarding va por Callable (más trabajo, menos superficie en Rules).

---

## 6. Callable / endpoints sugeridos (nombres orientativos)

| Endpoint | Actor | Efecto principal |
|----------|-------|------------------|
| `rrhhAltaAgente` | RRHH autenticado | Crea `per_*`, `usr_*` paso A. |
| `registrarPrimerAcceso` | Agente (sin sesión o token de un solo uso) | Valida DNI; crea Auth; actualiza `usr_*` paso B atómico. |
| `completarOnboardingDatos` | Agente autenticado | Valida checklist; transacción perfil completo + cuenta *activo portal* + evento. |
| `reconciliarEstadosCuentaPersona` | **S** (cron / admin) | Corrige inconsistencias §5.3 del flujo. |

Los nombres finales y el payload son decisión de implementación; lo importante es **no duplicar** la lógica de gating solo en el frontend.

---

## 7. Security Rules — fragmentos de política (orientativos)

Pseudopolíticas a traducir a sintaxis Firestore:

1. **`personas`:** `allow read` si el usuario es dueño (`resource.id` matchea claim `persona_id`) o rol RRHH; `allow update` si dueño y **no** cambia campos restringidos (lista explícita: sin tocar `estado_perfil_datos_id` si se reservó al Callable, o validar que solo baja de borrador dentro de valores permitidos — la opción simple es **deny** cambio de `estado_perfil_datos_id` desde cliente).
2. **`usuarios_cuenta`:** `allow read` si `resource.data.auth_uid == request.auth.uid` (o claim `cuenta_id`); `allow write` **deny** por defecto para campos críticos; todo update de credenciales/estado vía Admin SDK.
3. **`cfg_*`:** `allow read: if true` solo si no hay datos sensibles; si hay, `if request.auth != null`. `allow write: if false` para clientes (solo admin).

Ajustar según si los catálogos sensibles (p. ej. sexo/género) deben ocultarse a usuarios no autenticados.

---

## 8. Checklist implementación Rules + Functions

- [ ] Denegar por defecto; ir abriendo solo lo necesario.
- [ ] Índice compuesto / query para `usuarios_cuenta` por `auth_uid` (sparse) y por `persona_id`.
- [ ] Callable `registrarPrimerAcceso` con **rate limit** + mensaje genérico ante errores (anti-enumeración DNI).
- [ ] Callable `completarOnboardingDatos` con transacción persona + cuenta.
- [ ] Tests de reglas (Firebase emulator) para: agente no escribe `personas` ajeno; no eleva `estado_acceso` a portal sin checklist.

### Nota de normalización (A3)

- El campo persistido canónico en `usuarios_cuenta` es **`estado_acceso`** (valor id `cfg_*`).
- `estado_acceso_id` puede aparecer solo como **nombre de parámetro de entrada** en callables RRHH para expresar un id destino, pero **no** debe persistirse como campo en Firestore.
- Recomendación operativa: en escrituras de cuenta, limpiar cualquier legado con `estado_acceso_id` para evitar deriva de esquema.

---

## 9. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-22 | Creación: principio server-owned, matriz A/B/C, Callables sugeridos, políticas Rules orientativas. |
| 2026-04-22 | Alineación normativa: enumeración DNI, rate limit y reconciliación según [`FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md`](./FLUJO_V2_LOGIN_Y_DATOS_PERSONALES.md) §11 P1 (P1 razonado en documentación; *pend. revisión*). |
| 2026-04-23 | Changelog: “plan doc cerrado” → P1/seguridad como documentación *avanzada*, sin cierre final. |
| 2026-04-22 | Cabecera: **ámbito solo V2**; sin acceso a datos de la V1 (`PLAN_MODULOS_V2`). |
| 2026-04-22 | Nota **§1.1 Login:** validación PIN 6 y rate limit en Callables paso B. |
| 2026-04-30 | §5: explicitado bloqueo por actor en `personas` para campos sensibles (`dni`, `nombre`, `apellido`, `activo`, `motivo_baja_id`), validado en backend (no solo UI). |
| 2026-04-30 | §5: agregado control por `accion_habilitada` para edición de `personas` en rol usuario y canal de notificación RRHH para cambios post-onboarding en foto/formación/DDJJ/consentimientos. |
| 2026-05-19 | §4: verificación RRHH en Rules/Callables alineada a **`roles_hlc_vigentes`** (`CFG_RRHH`). |
| 2026-05-19 | §4.1: configurador artículos — grilla por Callable vs `getDoc` versión (Rules). |
