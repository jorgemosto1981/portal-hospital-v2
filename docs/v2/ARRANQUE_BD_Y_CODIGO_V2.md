# Arranque: BD nueva y código V2 (seguimiento)

**Propósito:** ir **cerrando de uno en uno** los requisitos para levantar un **proyecto Firebase / Firestore V2** y poder **ejecutar** la app (emulador o staging) con el **vertical login + datos personales**, sin mezclar con V1.

**Orden de trabajo canónico:** [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md).

**Proyecto Firebase V2 (estado: creado en consola, abril 2026):**

- **Project ID:** `portal-hospital-v2` (debe coincidir con [`.firebaserc`](../../.firebaserc) en la raíz de `portal-hospital-v2` — `default` → `portal-hospital-v2`).
- **Nota:** nunca reutilizar el mismo proyecto/BD que la app en producción V1 ([`PLAN_MODULOS_V2.md`](./PLAN_MODULOS_V2.md)).

### Qué hacer ahora (orden recomendado)

1. **Consola Firebase** (proyecto `portal-hospital-v2`):
   - **Firestore:** si aún no existe, *Crear base de datos* (elegir región; alinear con reglas de residencia de datos del hospital).
   - **Authentication → Método de inicio de sesión:** activar **Correo/contraseña** (V2: login con `username`+PIN mapea a esto a nivel de proveedor).
   - **Agregar app web** (icono `</>`) si todavía no agregaste una: copiar `apiKey`, `appId`, etc. (los mismos nombres que usan las variables `VITE_FIREBASE_*` de [`.env.example` en V1](../../../portal-hospital-v1/portal-hospital/.env.example) si comparás; para V2 usá `VITE_V2_*` y [`.env.v2.example`](../../.env.v2.example)).

2. **En tu PC (desarrollo):** `firebase login` si `firebase projects:list` falla. Desde la raíz de **`portal-hospital-v2`**, el [`.firebaserc`](../../.firebaserc) deja el proyecto `portal-hospital-v2` como `default` (o bien `firebase use default` en esa carpeta).

3. **Subir reglas e índices V2 (deny-all de momento):**  
   `npm run firebase:deploy:firestore`  
   Comprueba en consola → Firestore → Reglas que se actualizó el `firebase-v2` (no el de V1 en `../portal-hospital-v1/portal-hospital/`).

4. **Cliente web (Firebase + Vite):** en la raíz de `portal-hospital-v2` están [`.env.v2.example`](../../.env.v2.example) y, en tu máquina, **`.env.v2.local`**, con `VITE_V2_FIREBASE_*`. Código: [`src/firebaseConfig.v2.js`](../../src/firebaseConfig.v2.js). La app Vite vive hoy en **`../portal-hospital-v1/portal-hospital`**: al integrar, apuntá el módulo allí o montá otra app en V2 (ver [README del repo V2](../../README.md)). V1: [`../portal-hospital-v1/portal-hospital/src/firebaseConfig.js`](../../../portal-hospital-v1/portal-hospital/src/firebaseConfig.js) y `.env.local` del proyecto V1.

5. **Siguiente bloque de producto (Fase 1):** índices mínimos en `firebase-v2/firestore.indexes.json`, seed de `cfg_*`, y empezar reglas reales según [`DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](./DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) (Fases 1–2).

### Inicializar proyecto y enlazar el repo (V2)

1. **Cuenta / CLI:** si `firebase projects:list` o `projects:create` fallan con 401, ejecutar `firebase login` (y, si aplica, `firebase login:ci` solo para CI).
2. **Crear el proyecto (una opción):**
   - [Consola](https://console.firebase.google.com/) → *Agregar proyecto* → asignar **mismo ID** que en [`.firebaserc` de `portal-hospital-v2`](../../.firebaserc) (`default` → `portal-hospital-v2`) **o** crear con otro ID y editar ahí.
   - O CLI: `firebase projects:create <ID> --display-name "Portal Hospital V2"`.
3. **Añadir Firebase** al proyecto GCP creado (asistente en consola) y **crear base de datos** Firestore (modo *producción* o *prueba* según política del hospital).
4. **Proyecto activo en el CLI (V2):** en la raíz de `portal-hospital-v2` ya figura [`.firebaserc`](../../.firebaserc) con `portal-hospital-v2` como `default` (`firebase use` sin argumentos, o `firebase use default`).
5. **Despliegue solo V2 (no toca el `firebase.json` de V1** en `portal-hospital-v1`):  
   `firebase deploy --config firebase-v2/firebase.json --only firestore:rules,firestore:indexes` (o `npm run firebase:deploy:firestore` en esta raíz)
6. **Emulador V2 (puertos 8092 / 4002 para no chocar con otras instancias):**  
   `npm run firebase:emulators` (equivalente a `firebase emulators:start --config firebase-v2/firebase.json`)  
   Requisito: **JDK 21+** para el emulador de Firestore (mensaje de `firebase-tools` si la JVM es antigua).  
   Si el CLI muestra *Invalid project id: PORTAL* u otro id equivocado, asegurá de estar en la raíz de **`portal-hospital-v2`**; el de V1 está en [`../portal-hospital-v1/portal-hospital/`](../../../portal-hospital-v1/portal-hospital/) (`portal-hospital-rrhh` en [`.firebaserc`](../../../portal-hospital-v1/portal-hospital/.firebaserc) de esa carpeta).  
   Las rutas de `firestore.rules` e `indexes` en ese JSON son relativas a `firebase-v2/`.

#### Archivos

| Ruta | Rol |
|------|-----|
| [`firebase-v2/firebase.json`](../../firebase-v2/firebase.json) | Config Firestore + emulador V2 |
| [`firebase-v2/firestore.rules`](../../firebase-v2/firestore.rules) | **Deny-all** hasta Fase 2; luego alinear a `ACCESO_Y_RULES_FIRESTORE_V2` |
| [`.firebaserc`](../../.firebaserc) (raíz `portal-hospital-v2`) | Proyecto `default` → `portal-hospital-v2` |
| [`../portal-hospital-v1/portal-hospital/firebase.json`](../../../portal-hospital-v1/portal-hospital/firebase.json) (V1) | **Solo despliegue / emulación V1**; no modificar al trabajar en V2 |

---

## Checklist (actualizar al avanzar)

### Fase 0 — decisiones de runtime

| # | Estado | Comentario |
|---|--------|------------|
| 0.1 Enlace `auth` → `persona_id` en Rules | Hecho (23/04/2026) | **Custom claims** — [`MODULO_LOGIN_V2.md`](./MODULO_LOGIN_V2.md) **§3.3**; [`DECISIONES_REVISION_PERSONALES_LABORALES_V2.md`](./DECISIONES_REVISION_PERSONALES_LABORALES_V2.md) **F0.1** |
| 0.2 Proyecto/BD distintos de V1 | Hecho (proyecto `portal-hospital-v2`) + pendiente local | Consola: Firestore + Auth email + (opcional) app web. Repo: carpeta `portal-hospital-v2` + `npm run firebase:deploy:firestore` en tu máquina. |
| 0.3 Regla de independencia V1 | Hecho (documental) | Sin acceso a recursos V1 desde V2 — [`V1_VS_V2_LOGIN_DATOS.md`](./V1_VS_V2_LOGIN_DATOS.md) |

**Opcional al cerrar 0.2–0.3 en código:** rama `feat/v2-identidad` (o nombre acordado).

### Fase 1 — esquema, índices, seeds

- [ ] **Reglas** `match` para colecciones de negocio (en Fase 2; hoy reglas **deny-all**).
- [x] **Índices** compuestos mínimos en [`firebase-v2/firestore.indexes.json`](../../firebase-v2/firestore.indexes.json) (`usuarios_cuenta` por `estado_acceso`+`actualizado_en`; `eventos_ticket` por `persona_id`+`ocurrido_en`). **Despliegue:** `npm run firebase:deploy:firestore`. Las consultas de igualdad simple por `auth_uid` / `persona_id` usan índice automático.
- [x] **Seed** idempotente: [`scripts/seed-v2/seed-cfg.mjs`](../../scripts/seed-v2/seed-cfg.mjs) + [`scripts/seed-v2/seed-ids.v2.json`](../../scripts/seed-v2/seed-ids.v2.json) — `cfg_estado_cuenta_acceso`, `cfg_estado_perfil_datos`, `cfg_tipo_evento` según [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) §6. **Ejecución:** `GOOGLE_APPLICATION_CREDENTIALS` apuntando al JSON de una cuenta de servicio del **proyecto V2** + `npm run seed:cfg`. **Si el seed devuelve 5 NOT_FOUND:** creá la base Firestore **Native** en [Firestore (GCP)](https://console.cloud.google.com/firestore/databases?project=portal-hospital-v2). **No** pongas `FIREBASE_V2_FIRESTORE_DATABASE_ID=default` (dejá el env vacío para la base canónica; el script usa `getFirestore()` sin id). Solo definí esa variable si tenés **otra** base con nombre distinto.

### Fase 2 — reglas, emulador, tests

- [ ] `firestore.rules` según [`ACCESO_Y_RULES_FIRESTORE_V2.md`](./ACCESO_Y_RULES_FIRESTORE_V2.md).
- [ ] Emulador + tests mínimos (sin producción “abierta” antes de esto — criterio en `DESARROLLO_ORDEN` §1.1).

### Fase 3+ (siguiente bloque de código)

- [ ] Callables: alta A, registro B, `syncSessionClaims`, eventos — orden en el informe maestro.

---

### Conectar la base de datos Firestore (una vez)

Si aún no existe la instancia en GCP, el seed falla con `NOT_FOUND`. Puedes crearla **desde el repo** (requiere [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) y `gcloud auth login` con una cuenta con permisos en el proyecto):

1. (Opcional) Elegir región: p. ej. `southamerica-east1` — o definir `FIRESTORE_V2_LOCATION=...` (ver [ubicaciones](https://cloud.google.com/firestore/docs/locations)).
2. **Crear la base (default) en modo nativo:**  
   `npm run firestore:create` (ejecuta [`scripts/seed-v2/crear-base-firestore.ps1`](../../scripts/seed-v2/crear-base-firestore.ps1) en Windows).  
   O **manual (PowerShell):**  
   `gcloud config set project portal-hospital-v2`  
   `gcloud services enable firestore.googleapis.com --project=portal-hospital-v2`  
   `gcloud firestore databases create --location=southamerica-east1 --project=portal-hospital-v2`
3. Tras 1–2 minutos, volcar catálogos: `GOOGLE_APPLICATION_CREDENTIALS` al JSON de servicio + `npm run seed:cfg`
4. Subir reglas/índices: `npm run firebase:deploy:firestore` (si aún no).

**Front:** con `.env.v2.local` y Vite (integración en el repo de la V1 o futura app en V2) el bundle puede usar [`firebaseConfig.v2.js`](../../src/firebaseConfig.v2.js) contra el mismo `projectId` (ver [README V2](../../README.md)).

---

### Seed V2: error `NOT_FOUND` en `listCollections` (proyecto ya correcto en el log)

Si el log muestra **`project=portal-hospital-v2`** y aun así falla, **no es el script**: en GCP **no existe todavía** la instancia de **Firestore en modo nativo (Standard)** en ese proyecto, o aún se está aprovisionando.

1. **Firebase (recomendado):** [Firestore en el proyecto V2](https://console.firebase.google.com/project/portal-hospital-v2/firestore) → **Crear base de datos** → elegir **modo de producción o de prueba** (según política) → **región** → finalizar el asistente.
2. **O desde GCP:** [Bases de datos de Firestore](https://console.cloud.google.com/firestore/databases?project=portal-hospital-v2) → **Crear base de datos** (tipo **estándar / nativo**; no mezclar con solo *Datastore* heredado sin instancia Firestore).
3. **API (si hace falta):** [Habilitar Cloud Firestore API](https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=portal-hospital-v2) en el mismo proyecto.
4. Esperar **1–3 minutos** y volver a `npm run seed:cfg` (con `GOOGLE_APPLICATION_CREDENTIALS` al JSON de `portal-hospital-v2`).

**Comprobación (opcional, con gcloud):** `gcloud firestore databases list --project=portal-hospital-v2` — debe listar al menos la base **(default)**. Si la lista está vacía o el comando falla, el bloqueo es de consola/cuenta, no de código.

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-04-23 | Creación: checklist; F0.1 marcado hecho; 0.2/0.3 pendentes o documentales. |
| 2026-04-23 | **Inicio Firebase V2 en repo:** carpeta `firebase-v2/` (`firebase.json`, reglas deny-all, índices vacíos, emulador 8092/4002); `.firebaserc` (V2); sección de inicialización y deploy con `--config firebase-v2/firebase.json`. |
| 2026-04-23 | Proyecto **`portal-hospital-v2`** creado en consola: sección **Qué hacer ahora**, checklist 0.2 actualizado, nota de `.env` distinto para front V2. |
| 2026-04-24 | **Raíces `portal-hospital-v1` / `portal-hospital-v2`:** recursos V2 en carpeta hermana; ver [README V2](../../README.md) (integración con el front de V1). *Histórico 2026-04-23:* `src/firebaseConfig.v2.js`, `.env.v2.example`, `.env.v2.local` con `VITE_V2_FIREBASE_*` en un solo repo. |
| 2026-04-23 | *Histórico* **Front V2 (monorepo):** `npm run dev:v2` en Vite (antes de separar carpetas). |
| 2026-04-23 | **Fase 1 (repo):** `firebase-v2/firestore.indexes.json` (2 compuestos); `scripts/seed-v2/seed-cfg.mjs` + `seed-ids.v2.json`; `npm run seed:cfg`. |
| 2026-04-23 | Sección **Seed V2: NOT_FOUND** (pasos consola + `gcloud firestore databases list`). |
| 2026-04-23 | **Conectar la BD (una vez):** `scripts/seed-v2/crear-base-firestore.ps1` + `npm run firestore:create`. |
