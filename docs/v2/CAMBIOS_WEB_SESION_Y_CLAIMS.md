# Cambios web — sesión, claims y UX de acceso

**Fecha de referencia:** mayo 2026 · **Rama:** `mvp-fase1-onboarding`

Documentación de implementaciones en la app web V2 (`web/`) relacionadas con **sesión**, **claims unificados**, **inactividad** y **vinculación**. No sustituye [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md); complementa el comportamiento actual del código.

---

## 1. Cierre de sesión por inactividad

- **Archivo:** `web/src/features/auth/IdleSessionGuard.jsx`
- **Montaje:** `web/src/App.jsx` (dentro de `BrowserRouter`, aplica a toda la app V2 con usuario autenticado).
- **Política:** **15 minutos** sin actividad (`IDLE_SESSION_MS`). Eventos que reinician el temporizador: `mousedown`, `keydown`, `touchstart`, `scroll`, `click`, `wheel`, y `mousemove` con throttle de 1 s.
- **Al vencer el tiempo:** `signOut` (Firebase Auth V2) y redirección a `/login?motivo=inactividad`.
- **Pantalla de login:** `AccesoPortal.jsx` muestra un toast explicativo y elimina el query param `motivo` de la URL.

---

## 2. Claims de sesión — store único y snapshot estable

- **Archivo:** `web/src/features/auth/useAuthClaims.js`
- **Objetivo:** Una sola suscripción global a `onIdTokenChanged` y estado compartido para todos los consumidores del hook, evitando carreras entre componentes y el bucle **portal ↔ vinculación** cuando una instancia fallaba al leer el token.
- **React `useSyncExternalStore`:** `getSnapshot()` debe devolver **la misma referencia de objeto** hasta que el store cambie. Se mantiene `cachedSnapshot` y se **reconstruye solo** en `emit()` (tras actualizar `sharedUid`, `sharedClaims`, etc.). Así se evita el error *“The result of getSnapshot should be cached”* y *Maximum update depth exceeded*.
- **Comportamiento:** Primer acceso al token con “spinner” de claims; refrescos periódicos del ID token no fuerzan loading global salvo la primera hidratación por usuario.

---

## 3. Vinculación DNI — coherencia con el gate

- **Archivo:** `web/src/features/auth/VinculacionDni.jsx`
- **Cambio:** Redirección automática a `/portal/home` cuando el token incluye `persona_id` **no vacío** (alineado con `MvpAccessGate`), no solo si el id comienza con `per_`.

---

## 4. Resumen de archivos tocados

| Archivo | Tema |
|---------|------|
| `web/src/App.jsx` | `IdleSessionGuard` |
| `web/src/features/auth/IdleSessionGuard.jsx` | Nuevo — timeout inactividad |
| `web/src/features/auth/useAuthClaims.js` | Store único + `cachedSnapshot` |
| `web/src/features/auth/AccesoPortal.jsx` | Toast por `motivo=inactividad` |
| `web/src/features/auth/VinculacionDni.jsx` | Condición de salida con `persona_id` |

---

## 5. Despliegue

- **Hosting Firebase:** `public` apunta a `web/dist` (ver `firebase.json` en la raíz del repo).
- **Comando típico:** desde la raíz, tras `npm run build` en `web/`, ejecutar `firebase deploy --only hosting` (proyecto `portal-hospital-v2` según entorno).

---

## 6. Operación

- Ajuste del tiempo de inactividad: constante `IDLE_SESSION_MS` en `IdleSessionGuard.jsx`.
- Política de claims y callables: sin cambios en este documento; continúan en Cloud Functions y [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md).
