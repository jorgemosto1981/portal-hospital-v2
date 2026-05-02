# Auditoría pre-producción — Fase 1 (Go-Live)

**Rol:** auditoría de arquitectura y seguridad sobre el codebase actual.  
**Alcance:** Alta (RRHH), Registro / primer acceso, Login, seguridad (Firestore + entorno), sesión / expiración, UX en formularios críticos.  
**Fecha de referencia:** 2026-05-02.  
**Cierre de ciclo (misma fecha):** flags de acceso temporal en `false`, login DNI con `callSyncSessionClaims` + `getIdToken(true)`, logout global en header, Firebase Storage habilitado, Hosting configurado y desplegado, política de artefactos Functions en `southamerica-east1`.

---

## 1. Resumen ejecutivo (semáforo por eje)

| Eje | Estado | Comentario breve |
|-----|--------|-------------------|
| **1. Flujo de identidad** (Alta → Registro → Login → Onboarding) | **Amarillo** | Flujo coherente; mitigado el riesgo post-login DNI con `callSyncSessionClaims` y refresco de token en `AccesoPortal.jsx`. Siguen revisiones de producto (abandono de wizard, etc.). |
| **2. Seguridad y entorno** (reglas + variables) | **Amarillo** | `OPEN_ACCESS_TEMP: false` en web y Functions; build debe seguir sin `VITE_BYPASS_AUTH` en producción. Reglas Firestore: mismos huecos de alcance cliente vs. callables (no es “rojo” solo por flags). |
| **3. Sesión y expiración** (persistencia, revocación, logout) | **Amarillo** | Persistencia local por defecto sin cambio; **logout visible** en `AppBrandHeader` (`signOut` + navegación a `/login`). Falta política explícita de inactividad / interceptor global de token inválido. |
| **4. UX / prevención de errores** (botones, toasts) | **Amarillo** | Sin cambio sustancial en esta iteración: toasts y `err.message` siguen siendo revisión pendiente. |

**Leyenda:** Verde = listo para producción con riesgo bajo; Amarillo = usable con acciones antes/después del go-live; Rojo = bloqueante o alto riesgo si no se corrige.

---

## 2. Eje 1 — Flujo de identidad

### 2.1 Semáforo: **Amarillo**

### 2.2 Hallazgos

**Alta RRHH (`rrhhAltaAgente` + pantalla RRHH)**  
- Crea `personas` + `usuarios_cuenta` en estado pendiente de registro; coherente con el modelo V2.  
- Con `OPEN_ACCESS_TEMP === false` (estado actual del repo), el flujo RRHH debe alinearse a las reglas de auth/gateo vigentes; si en el futuro se reactiva el flag solo en dev, documentarlo explícitamente.

**Registro / primer acceso (`AccesoPortal`, `registrarPrimerAcceso`)**  
- Tras éxito se hace `signInWithEmailAndPassword` + `getIdToken(true)` en el flujo de registro, alineado con la aparición de `persona_id` en el token.  
- Mensajes específicos para “cuenta ya creada” / fallo post-callable están acotados (buena práctica anti-confusión).

**Login por DNI (`resolverEmailLoginDni` + `signInWithEmailAndPassword`)**  
- **Actualizado (cierre ciclo):** tras login exitoso se invoca **`callSyncSessionClaims()`** y **`getIdToken(true)`**; si falla el sync se hace `signOut` y se informa al usuario (evita ventana con claims desactualizados).

**Onboarding**  
- `MvpAccessGate` fuerza `/onboarding` si la persona está `PENDIENTE_ONBOARDING` y `metadata.auth_vinculado`.  
- Si el usuario **abandona** el wizard, no se observa “reset automático” de datos (decisión de producto ya alineada); puede volver a entrar por ruta protegida mientras el estado lo permita.

### 2.3 Cuellos de botella / callejones sin salida

| Situación | Riesgo | Notas |
|-----------|--------|--------|
| Sesión iniciada **sin** `persona_id` en claims (desincronización) | Medio | Gate envía a `/vinculación`; rutas `/login`, `/registro` (redirect), `/vinculacion` permitidas sin claim. |
| `OPEN_ACCESS_TEMP` o `VITE_BYPASS_AUTH` activos | Alto | En repo **cerrado** con `OPEN_ACCESS_TEMP: false`; `VITE_BYPASS_AUTH` sigue siendo riesgo si el build de producción lo define en `true`. |
| Usuario en onboarding cierra pestaña | Bajo | Al volver, el gate lo reubica al wizard si aplica. |
| Login DNI sin refresco de claims tras cambios server-side | Bajo–Medio | Mitigar llamando `syncSessionClaims` + `getIdToken(true)` tras login exitoso (checklist). |

### 2.4 Brechas (gaps)

1. ~~**Post-login DNI:**~~ **Cerrado en código:** reconciliación vía `callSyncSessionClaims` + `getIdToken(true)` en login DNI.  
2. **Documentación operativa:** el orden “cuándo forzar `getIdToken(true)`” sigue repartido entre registro, login y `vincularCuentaPorDni`; conviene una guía breve en README o doc de auth.

---

## 3. Eje 2 — Seguridad y entorno

### 3.1 Semáforo: **Amarillo** (flags de acceso abierto cerrados; reglas y pipeline siguen siendo foco)

### 3.2 Firestore Rules (`firebase-v2/firestore.rules`)

**Fortalezas**  
- Denegación por defecto con `match /{document=**}` al final.  
- `usuarios_cuenta`: solo lectura de la fila cuyo `auth_uid` coincide con la sesión; sin escritura cliente.  
- `personas`: lectura/escritura solo si `request.auth.token.persona_id` coincide con el id del documento (criterio “datos propios”).  
- Catálogos `cfg_*` listados y `grupos_de_trabajo`: lectura autenticada, sin escritura cliente.  
- `eventos_ticket` y colecciones `_system_*`: cerradas al cliente.

**Debilidades / huecos**  
- **Colecciones no enumeradas** (p. ej. muchos `cfg_*` de RRHH, `historial_laboral_datos`, `historial_laboral_grupos`, `formacion_agente`, etc.): el comodín final las deja en **denegación total** para el SDK cliente. Eso es seguro, pero **rompe** cualquier lectura directa desde la web que aún no pase por Callables (hay servicios que listan colecciones según contexto).  
- **Escritura en `personas`:** un agente autenticado con claim puede **actualizar todo el documento** salvo delete; no hay reglas de campo a campo (p. ej. bloqueo de `dni`, `estado`, etc.) a nivel rules — la política “solo RRHH cambia identidad” depende de **Callables** y disciplina de UI.  
- **Rol RRHH / admin:** no hay distinción en reglas entre agente y RRHH; RRHH usa sobre todo Admin SDK / Callables, pero cualquier lectura cliente nueva debe añadirse explícitamente.

### 3.3 Variables de entorno y flags compartidos

| Variable / archivo | Uso actual | Riesgo producción |
|--------------------|------------|-------------------|
| `VITE_BYPASS_AUTH` | Mencionado en `.env.v2.example` como solo local; en `App.jsx` y `MvpAccessGate` omite login / gate. | **Crítico** si queda `true` en build de producción. |
| `shared/runtimeFlags.json` → `OPEN_ACCESS_TEMP` | **`false`** en `shared/runtimeFlags.json` y copia en `functions/modules/shared/runtimeFlags.json`; despliegue web + functions debe mantenerlos alineados. | Riesgo mitigado para el bypass temporal documentado. |

**Brecha:** no hay en el repo (en esta revisión) un **checklist de build CI** que falle si `OPEN_ACCESS_TEMP === true` o si `VITE_BYPASS_AUTH` está definido en el bundle de producción.

---

## 4. Eje 3 — Sesión, expiración y logout

### 4.1 Semáforo: **Amarillo**

### 4.2 Persistencia Firebase Auth

- En `firebaseConfig.v2.js` **no** se configura `setPersistence`: el SDK usa el comportamiento por defecto del navegador (**persistencia local** típica), la sesión **sigue existiendo** al cerrar y reabrir el navegador hasta `signOut` o invalidez del refresh token.  
- Implicación para go-live: política de “cerrar al cerrar navegador” **no** está implementada; requeriría `SESSION` u otra política explícita + comunicación al usuario.

### 4.3 Token expirado / usuario inactivado por RRHH

- **Firebase Auth:** errores en próximas operaciones (`getIdToken`, callables con Auth) pueden devolver `auth/user-disabled` o fallos de red; no hay un **interceptor global** en la app que unifique “sesión inválida → pantalla de login + mensaje”.  
- **RRHH:** existen callables de baja / reinicio que pueden **revocar** refresh tokens (`rrhhReiniciarVinculacionCuenta`, etc.); el cliente debe manejar el rechazo en la siguiente interacción (hoy depende de cada pantalla / toast).

### 4.4 Logout visible y consistente

- Existe **`signOutV2`** en `authService.js` y uso de **`signOut`** en `AccesoPortal` (errores de login) y en **`PortalHome`** cuando aplica.  
- **Actualizado:** en **`AppBrandHeader.jsx`** hay acción global **“Cerrar sesión”** (`signOut(authV2)` + navegación a `/login` con `replace`) cuando hay usuario autenticado.  
- Brecha residual: política de persistencia / mensaje unificado ante `user-disabled` sigue sin interceptor global.

---

## 5. Eje 4 — UX y prevención de errores (formularios y toasts)

### 5.1 Semáforo: **Amarillo**

### 5.2 Doble envío / estados de carga

| Pantalla | Botón submit `disabled` + loading | Inputs deshabilitados durante envío |
|----------|-----------------------------------|-------------------------------------|
| `AccesoPortal` (login / registro) | Sí (`busyLogin` / `busyReg`) | Parcial: login deshabilita inputs con `busyLogin`; registro usa `busy` combinado en algunos campos — revisar consistencia. |
| `AltaAgenteForm` (RRHH) | Sí (`disabled={busy}` en `PrimaryButton`) | No: campos del formulario siguen editables durante `busy` (riesgo bajo de doble envío si solo el botón está deshabilitado). |
| Onboarding (`saving` en wizard) | Parcial según paso | Revisar cada paso en `OnboardingWizard` / hooks. |

### 5.3 Toasts y mensajes “seguros”

- **Login DNI:** en error no-auth se usa `err.message` del objeto error → puede exponer texto técnico de Functions o red (aunque muchas rutas devuelven mensajes genéricos del servidor).  
- **RRHH:** varios `toast.error(String(msg))` propagan el mensaje de la excepción tal cual.  
- **Registro:** mensaje unificado para casos sensibles; otros errores siguen mostrando `mRaw` genérico.

**Brecha:** no hay capa única de “sanitización de mensajes para usuario final” (mapeo código → texto amigable sin stack ni detalles internos).

---

## 6. Checklist de acción (antes de publicar)

Marcá cada ítem antes del go-live.

### 6.1 Configuración y secretos

- [x] **`shared/runtimeFlags.json`:** `OPEN_ACCESS_TEMP` → `false`; misma clave en **functions** (`functions/modules/shared/runtimeFlags.json`); desplegar web + functions cuando cambie.  
- [ ] **Build producción:** `VITE_BYPASS_AUTH` **no** definido o explícitamente `false` en el pipeline; verificar bundle (no aparecer modo bypass).  
- [ ] **Firestore Rules:** desplegar `firebase-v2/firestore.rules` en el proyecto V2; ejecutar pruebas con usuario agente real (lectura `personas`, `historial_laboral_cargos`, catálogos).  
- [x] **Variables V2** (`VITE_V2_FIREBASE_*`): Hosting en Firebase sirve el build desde `web/dist`; las variables se inyectan en **build time** — el pipeline de CI o el operador debe usar `.env` / secretos correctos al ejecutar `npm run build` antes de `firebase deploy --only hosting`.

### 6.2 Identidad y claims

- [x] Tras **login DNI exitoso**, **`callSyncSessionClaims`** + **`getIdToken(true)`** y manejo de fallo con `signOut` y feedback en `AccesoPortal.jsx`.  
- [ ] Verificar flujo completo en staging: Alta → `/login?alta=1` → Onboarding → Inicio, con interrupciones (cerrar pestaña en cada paso).

### 6.3 Sesión y producto

- [ ] Definir política de **persistencia** (local vs session) y documentarla para usuarios clínicos.  
- [x] **Cerrar sesión** visible en **`AppBrandHeader`** (`signOut` + `/login`).  
- [ ] (Opcional) Listener global `onIdTokenChanged` / manejo de `auth/user-disabled` con redirección a login.

### 6.4 UX y seguridad de mensajes

- [ ] Revisión rápida de **todos** los `toast.error` / `setFeedback` que concatenen `err.message` sin filtrar.  
- [ ] En formularios RRHH, considerar **`disabled={busy}`** en inputs durante submit de alta.

### 6.5 Operaciones

- [ ] **Backups** y plan de rollback de Firestore antes del primer tráfico real.  
- [ ] Revisar **IAM** de Cloud Functions (invoker público en callables es habitual; validar que no haya endpoints administrativos expuestos sin auth cuando `OPEN_ACCESS_TEMP` sea `false`).
- [x] **Firebase Storage:** API y reglas desplegadas (`firebase-v2/storage.rules`); bucket del proyecto activo.  
- [x] **Firebase Hosting:** `firebase.json` incluye `hosting.public = web/dist` y rewrite SPA; URL típica `https://portal-hospital-v2.web.app` (tras `npm run build` + `firebase deploy --only hosting`).  
- [x] **Artifact Registry (Functions):** política de limpieza en **`southamerica-east1`** (`firebase functions:artifacts:setpolicy --location southamerica-east1 --force`); el CLI por defecto usa `us-central1` si no se pasa `--location`.

---

## 7. Referencias de código (anclajes)

| Tema | Ubicación principal |
|------|----------------------|
| Gate MVP + flags | `web/src/features/shell/MvpAccessGate.jsx`, `web/src/App.jsx` |
| Login / registro unificado | `web/src/features/auth/AccesoPortal.jsx`, `web/src/features/auth/LoginRoute.jsx`, `LoginScreen.jsx` |
| Claims en cliente | `web/src/features/auth/useAuthClaims.js` |
| Sesión | `web/src/features/auth/useAuthSession.js`, `src/firebaseConfig.v2.js` |
| Vinculación + token | `web/src/services/authService.js` (`vincularCuentaPorDni`) |
| Reglas | `firebase-v2/firestore.rules` |
| Flag temporal compartido | `shared/runtimeFlags.json` |
| RRHH alta | `web/src/features/rrhh/AltaAgenteRRHH.jsx`, `functions/modules/rrhh.js` |
| Logout en shell | `web/src/components/layout/AppBrandHeader.jsx` |
| Hosting / despliegue | `firebase.json` (sección `hosting`), `web/dist` (artefacto de `npm run build` en `web/`) |
| Rutas V2 + guards | `web/src/App.jsx`, `web/src/features/routing/RouteGuards.jsx`, `PortalLayout.jsx`, `redirectPaths.js` |
| Roles portal (claims) | `web/src/features/routing/portalRole.js`, `useAuthClaims.js`, `BottomNavigationBar.jsx` |
| Layout / scroll móvil | `web/src/components/layout/MobileLayout.jsx`, `web/src/index.css` |
| RRHH en Functions | `functions/modules/shared/helpers.js` (`assertRrhh`), `functions/modules/catalogosPersonales.js` (`isRrhhActor`) |

---

## 8. Changelog del documento

| Fecha | Cambio |
|-------|--------|
| 2026-05-02 | Primera versión — auditoría pre-producción Fase 1. |
| 2026-05-02 | Cierre de ciclo: semáforos y checklist alineados a flags `false`, login DNI + claims, logout header, Firebase Storage/Hosting/artefactos documentados. |
| 2026-05-02 | Rutas bajo `/portal/*`, guards (`PublicRoute`, `ProtectedRoute`, `RoleGuard`), normalización de `portal_role` + rol `admin`; scroll móvil en layout; redirecciones legacy; despliegue hosting+functions documentado. |

---

## 9. Registro operativo (local / Firebase) — cierre 2026-05-02

| Tema | Estado |
|------|--------|
| `OPEN_ACCESS_TEMP` | `false` en web y Functions (JSON compartidos). |
| Login DNI | `AccesoPortal.jsx`: `callSyncSessionClaims` + `getIdToken(true)`; fallo → `signOut` + mensaje. |
| Logout | `AppBrandHeader.jsx`: botón global. |
| Storage | Habilitado en consola; `firebase deploy` incluye reglas sin error previo de “Storage not set up”. |
| Hosting | Añadido en `firebase.json`; build `web/` → `firebase deploy --only hosting`. |
| Functions — limpieza imágenes | `firebase functions:artifacts:setpolicy --location southamerica-east1 --force` (no usar solo default `us-central1` si las funciones están en Sao Paulo). |
| PowerShell | Listas en `--only`: usar comillas, p. ej. `--only "firestore,functions"`. |
| Rutas portal | Contenido autenticado bajo **`/portal/*`** (`home`, `laboral`, `perfil`, `configuracion`, etc.); **`/portal/rrhh/*`** protegido con claims `rrhh` o `admin`. Redirecciones desde `/inicio`, `/perfil`, `/laboral`, `/rrhh/...` hacia equivalentes `/portal/...`. |
| Claims RRHH | Cliente: `portalRole.js` + `hasPortalRoles` en `useAuthClaims`; pestaña RRHH en nav solo si rol de gestión; **no** ocultar Laboral a agentes (corrección de filtro invertido en `BottomNavigationBar`). Servidor: `assertRrhh` / actor RRHH aceptan `admin`. Tras cambiar claims en Auth: refrescar token o re-login. |
| Deploy reciente | `firebase deploy --only "hosting,functions"` tras cambios de rutas y Functions. |

**Nota:** `web/dist` suele estar en `.gitignore`; el origen de verdad del front es el código en `web/src` más el build reproducible con variables de entorno de producción.

---

## 10. Esquema de rutas V2 (referencia rápida)

| Ruta | Guard |
|------|--------|
| `/` | Redirige a `/login` o `/portal/home` según sesión. |
| `/login`, flujo registro vía query | `MvpAccessGate` + `PublicRoute` (si hay sesión → destino seguro de `redirect` o `/portal/home`). |
| `/vinculacion` | Pública (soporte), sin prefijo portal. |
| `/onboarding` | `MvpAccessGate` + `ProtectedRoute`. |
| `/portal/*` | `MvpAccessGate` + `ProtectedRoute` + `PortalLayout` (shell + tabs). |
| `/portal/rrhh/*` | Además `RoleGuard` con roles `rrhh`, `admin`. |
