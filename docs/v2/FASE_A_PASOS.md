# Fase A — inicio de codificación (seguimiento paso a paso)

Orden alineado al plan acordado: **A.1 consola → A.2 Callables / claims → A.3 estructura front**.

## A.1 — Authentication en Firebase Console *(manual)*

En [Firebase Console](https://console.firebase.google.com/) → proyecto **portal-hospital-v2** → **Build → Authentication** → **Sign-in method**:

- [ ] **Correo electrónico / contraseña** habilitado (flujo paso B y login DNI→`username`+PIN según `MODULO_LOGIN_V2.md` §1.1–1.3).
- [ ] Revisar políticas de **dominio** / lista blanca si el hospital las exige.

**Nota:** desplegar **Cloud Functions** en Firebase suele requerir plan **Blaze** (facturación). Si el proyecto está en Spark, los Callables no se despliegan hasta upgrade; el emulador local sí sirve para desarrollo.

## A.2 — Cloud Functions (andamiaje + `syncSessionClaims` stub)

- **Código:** carpeta [`../../functions`](../../functions) (`index.js`: `healthV2`, `syncSessionClaims` stub).
- **Config:** [`../../firebase-v2/firebase.json`](../../firebase-v2/firebase.json) incluye `functions` y emulador `functions` (puerto **5002**).
- **Instalar dependencias:** `cd functions && npm install`
- **Emulador (Functions + Firestore V2):** desde la raíz del repo: `npm run firebase:emulators:with-functions`
- **Siguiente implementación real:** leer `usuarios_cuenta` por `auth_uid`, `getAuth().setCustomUserClaims(uid, { persona_id, cuenta_id })` según `MODULO_LOGIN_V2.md` §3.3.

## A.3 — Estructura de la app `web/`

- **Servicios:** `web/src/services/firebase.js` — única entrada recomendada al SDK V2 para componentes (`auth`, `db`, …).
- **Features / componentes:** carpetas `web/src/features/` y `web/src/components/` (vacías al inicio; features por módulo cuando existan pantallas).

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-24 | Creación: checklist A.1, referencia A.2/A.3. |
