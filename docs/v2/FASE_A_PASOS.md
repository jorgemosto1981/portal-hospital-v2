# Fase A — inicio de codificación (seguimiento paso a paso)

Orden alineado al plan acordado: **A.1 consola → A.2 Callables / claims → A.3 estructura front**.

## A.1 — Authentication en Firebase Console *(manual)*

En [Firebase Console](https://console.firebase.google.com/) → proyecto **portal-hospital-v2** → **Build → Authentication** → **Sign-in method**:

- [x] **Correo electrónico / contraseña** habilitado (flujo paso B y login DNI→`username`+PIN según `MODULO_LOGIN_V2.md` §1.1–1.3). *(Completado 24/04/2026.)*
- [x] Revisar políticas de **dominio** / lista blanca si el hospital las exige. *(Completado 24/04/2026.)*

**Nota:** desplegar **Cloud Functions** en Firebase suele requerir plan **Blaze** (facturación). Si el proyecto está en Spark, los Callables no se despliegan hasta upgrade. El front y la documentación del repo asumen **callables contra el proyecto en la nube** (`npm run firebase:deploy:functions`); no se documenta un flujo con Firebase Local Emulator Suite.

## A.2 — Cloud Functions (andamiaje + `syncSessionClaims` stub)

- **Código:** carpeta [`../../functions`](../../functions) (`index.js`: `healthV2`, `syncSessionClaims` stub).
- **Config:** [`../../firebase-v2/firebase.json`](../../firebase-v2/firebase.json) referencia el código en [`../../functions`](../../functions) para **deploy** (`npm run firebase:deploy:functions` desde la raíz).
- **Instalar dependencias:** `cd functions && npm install`
- **Probar en nube:** desplegar functions y usar `npm run dev:web` con `.env.v2.local` (`VITE_V2_FIREBASE_*`) apuntando al proyecto.
- **Implementado:** `syncSessionClaims` lee `usuarios_cuenta` por `auth_uid`, valida `persona_id` y aplica `setCustomUserClaims` (`persona_id`, `cuenta_id` = id del doc) según `MODULO_LOGIN_V2.md` §3.3. *(24/04/2026.)*
- **App web:** `web/src/services/functionsV2.js` + `callables.js`; pantalla de prueba en `features/home/PortalHome.jsx` (health, `syncSessionClaims`, **Bloque 2:** `rrhhAltaAgente` + `registrarPrimerAcceso` con formularios mínimos). Variables: [`.env.v2.example`](../../.env.v2.example) (solo `VITE_V2_FIREBASE_*` y opcional `VITE_BYPASS_AUTH` en local).
- **Bloque 2 (Callables A/B, `DESARROLLO_ORDEN` Fase 3):** `rrhhAltaAgente` (claim `portal_role: "rrhh"` en el token) crea `personas` + `usuarios_cuenta` en `cfg_eca_pend_reg`. `registrarPrimerAcceso` (sin sesión) DNI+email+PIN 6, rate limit, evento `cfg_tev_login`. `syncSessionClaims` fusiona claims con las existentes (p. ej. `portal_role` RRHH). Probar contra **Cloud Functions** desplegadas; en GCF 2.ª gen. puede hacer falta **IAM** de invocación pública — revisar despliegue.

## A.3 — Estructura de la app `web/`

- **Servicios:** `web/src/services/firebase.js` — única entrada recomendada al SDK V2 para componentes (`auth`, `db`, …).
- **Features / componentes:** `web/src/features/` (módulos por área) y `web/src/components/` (compartido). *Implementado 24/04/2026:* `features/home/PortalHome.jsx` (pantalla de arranque; `App.jsx` solo reexporta), `components/` reservada para piezas reutilizables.

## Fase 2 — Rules (primer corte)

- **Repo:** `firebase-v2/firestore.rules` — lectura `cfg_estado_cuenta_acceso`, `cfg_estado_perfil_datos`, `cfg_tipo_evento` si `request.auth != null`; lectura `usuarios_cuenta/{id}` solo si `resource.data.auth_uid == request.auth.uid`; lectura `personas/{per_*}` solo si `request.auth.token.persona_id == personaId`; resto deny-all.
- **Despliegue:** `npm run firebase:deploy:firestore` cuando el equipo apruebe subir a consola.
- **Conectividad Firestore (cliente):** `npm run test:firestore:v2` — prueba el SDK web + `.env.v2.local` contra el **proyecto remoto** (ver `ARRANQUE_BD_Y_CODIGO_V2.md`). **Reglas unitarias:** el archivo [`../../tests/firestore-rules.mjs`](../../tests/firestore-rules.mjs) sigue existiendo para quien quiera ejecutarlo con `@firebase/rules-unit-testing` en un flujo propio; no hay script `npm` en la raíz que levante emuladores.

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-05-02 | Doc alineado a **solo nube** (sin comandos de emulador; `test:firestore:v2`, deploy de Functions). |
| 2026-04-24 | Creación: checklist A.1, referencia A.2/A.3. |
| 2026-04-24 | **A.1** completado en consola Firebase (checklist §A.1). |
| 2026-04-24 | **A.2** `syncSessionClaims` implementado (`functions/index.js`). |
| 2026-04-24 | **Fase 2 (parcial):** reglas `cfg_*` lectura autenticada + `usuarios_cuenta` lectura propia por `auth_uid`. |
| 2026-04-24 | **Fase 2:** reglas `personas` lectura propia por custom claim `persona_id`. |
| 2026-04-24 | **A.3** estructura `features/home`, `components/`, `App` → `PortalHome`. |
| 2026-04-24 | **Bloque 1 (ritmo):** `tests/firestore-rules.mjs` (matriz mínima cfg / personas / `usuarios_cuenta` / deny default; ejecución según flujo del equipo). |
| 2026-04-24 | **Bloque 2 (ritmo):** Callables `rrhhAltaAgente`, `registrarPrimerAcceso`; `syncSessionClaims` merge de claims; formularios en `PortalHome`. |
| 2026-04-25 | Pausa handoff: reglas Cursor + `HANDOFF_CONTINUIDAD_2026-04-25.md`, tipos JSDoc `web/src/types/v2-entities.js`, UI home `text-xl` / `text-base` y foco `active`/`focus-visible` (sin hover). |
| 2026-04-25 | **Cierre de entrega prep.:** remoto [GitHub `jorgemosto1981/portal-hospital-v2`](https://github.com/jorgemosto1981/portal-hospital-v2) (rama `master`); handoff actualizado (§0 remoto, §6 cierre). |
