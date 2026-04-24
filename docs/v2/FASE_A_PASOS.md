# Fase A — inicio de codificación (seguimiento paso a paso)

Orden alineado al plan acordado: **A.1 consola → A.2 Callables / claims → A.3 estructura front**.

## A.1 — Authentication en Firebase Console *(manual)*

En [Firebase Console](https://console.firebase.google.com/) → proyecto **portal-hospital-v2** → **Build → Authentication** → **Sign-in method**:

- [x] **Correo electrónico / contraseña** habilitado (flujo paso B y login DNI→`username`+PIN según `MODULO_LOGIN_V2.md` §1.1–1.3). *(Completado 24/04/2026.)*
- [x] Revisar políticas de **dominio** / lista blanca si el hospital las exige. *(Completado 24/04/2026.)*

**Nota:** desplegar **Cloud Functions** en Firebase suele requerir plan **Blaze** (facturación). Si el proyecto está en Spark, los Callables no se despliegan hasta upgrade; el emulador local sí sirve para desarrollo.

## A.2 — Cloud Functions (andamiaje + `syncSessionClaims` stub)

- **Código:** carpeta [`../../functions`](../../functions) (`index.js`: `healthV2`, `syncSessionClaims` stub).
- **Config:** [`../../firebase-v2/firebase.json`](../../firebase-v2/firebase.json) incluye `functions` y emulador `functions` (puerto **5002**).
- **Instalar dependencias:** `cd functions && npm install`
- **Emulador (Functions + Firestore V2):** desde la raíz del repo: `npm run firebase:emulators:with-functions`
- **Implementado:** `syncSessionClaims` lee `usuarios_cuenta` por `auth_uid`, valida `persona_id` y aplica `setCustomUserClaims` (`persona_id`, `cuenta_id` = id del doc) según `MODULO_LOGIN_V2.md` §3.3. *(24/04/2026.)*
- **App web:** `web/src/services/functionsV2.js` + `callables.js`; pantalla de prueba en `App.jsx` (botones `healthV2` / `syncSessionClaims`). Emulador: ver `.env.v2.example` (`VITE_V2_USE_FUNCTIONS_EMULATOR`).

## A.3 — Estructura de la app `web/`

- **Servicios:** `web/src/services/firebase.js` — única entrada recomendada al SDK V2 para componentes (`auth`, `db`, …).
- **Features / componentes:** carpetas `web/src/features/` y `web/src/components/` (vacías al inicio; features por módulo cuando existan pantallas).

## Fase 2 — Rules (primer corte)

- **Repo:** `firebase-v2/firestore.rules` — lectura `cfg_estado_cuenta_acceso`, `cfg_estado_perfil_datos`, `cfg_tipo_evento` si `request.auth != null`; lectura `usuarios_cuenta/{id}` solo si `resource.data.auth_uid == request.auth.uid`; resto deny-all.
- **Despliegue:** `npm run firebase:deploy:firestore` cuando el equipo apruebe subir a consola.

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-24 | Creación: checklist A.1, referencia A.2/A.3. |
| 2026-04-24 | **A.1** completado en consola Firebase (checklist §A.1). |
| 2026-04-24 | **A.2** `syncSessionClaims` implementado (`functions/index.js`). |
| 2026-04-24 | **Fase 2 (parcial):** reglas `cfg_*` lectura autenticada + `usuarios_cuenta` lectura propia por `auth_uid`. |
