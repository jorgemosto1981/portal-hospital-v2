# Esquema e integración — app `web/`

Referencia corta para quien codifica el front **Vite** de este repo. El contrato completo de datos sigue en **`docs/v2/`** (no duplicar aquí tablas extensas).

**Plan de inicio (Fase A, paso a paso):** [`docs/v2/FASE_A_PASOS.md`](../docs/v2/FASE_A_PASOS.md).

## 1. Variables de entorno (cliente)

Definidas en **`.env.v2.local`** en la **raíz** `portal-hospital-v2/` (no dentro de `web/`). Nombres obligatorios para `firebaseConfig.v2.js`:

| Variable | Uso |
|----------|-----|
| `VITE_V2_FIREBASE_API_KEY` | Registro web Firebase |
| `VITE_V2_FIREBASE_AUTH_DOMAIN` | Auth |
| `VITE_V2_FIREBASE_PROJECT_ID` | Proyecto (`portal-hospital-v2`) |
| `VITE_V2_FIREBASE_STORAGE_BUCKET` | Storage |
| `VITE_V2_FIREBASE_MESSAGING_SENDER_ID` | FCM / config |
| `VITE_V2_FIREBASE_APP_ID` | App Id |
| `VITE_V2_FIREBASE_MEASUREMENT_ID` | Opcional · Analytics |

Plantilla: `../.env.v2.example`.

## 2. Código compartido con el repo

| Recurso | Ruta / alias |
|----------|----------------|
| Config Firebase Web V2 | `@portalV2/firebaseConfig.v2.js` → `../src/firebaseConfig.v2.js` |
| Logger | `@portalV2/utils/logger.js` (si hace falta desde `web/`) |

`web/vite.config.js`: `envDir` raíz, alias `@portalV2`, `dedupe`/`alias` de `firebase/*` para un solo SDK.

**Callables:** `web/src/services/functionsV2.js` + `callables.js` (`healthV2`, `syncSessionClaims`). Emulador: variables en `.env.v2.example` (`VITE_V2_USE_FUNCTIONS_EMULATOR`).

## 3. Esquema Firestore (canónico en docs)

| Tema | Documento |
|------|-----------|
| Colecciones, campos, prefijos `per_` / `usr_` / `evt_` / `cfg_*` | [`docs/v2/MODULO_DATOS_PERSONALES_V2.md`](../docs/v2/MODULO_DATOS_PERSONALES_V2.md) (p. ej. §2 físico / tablas) |
| Cuenta, estados, custom claims | [`docs/v2/MODULO_LOGIN_V2.md`](../docs/v2/MODULO_LOGIN_V2.md) |
| Catálogos y seeds | [`docs/v2/MODULO_CONFIGURACION_V2.md`](../docs/v2/MODULO_CONFIGURACION_V2.md) · `../scripts/seed-v2/` |
| Security Rules (diseño) vs archivo actual | [`docs/v2/ACCESO_Y_RULES_FIRESTORE_V2.md`](../docs/v2/ACCESO_Y_RULES_FIRESTORE_V2.md) · `../firebase-v2/firestore.rules` (hoy deny-all hasta Fase 2) |
| Índices desplegados | `../firebase-v2/firestore.indexes.json` |
| Orden de implementación | [`docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md`](../docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md) |

## 4. Colecciones nombradas en plan (recordatorio)

`personas`, `usuarios_cuenta`, `formacion_agente`, `consentimientos`, `declaraciones_grupo_familiar`, `eventos_ticket`, `cfg_*`, y el resto según [`PLAN_MODULOS_V2.md`](../docs/v2/PLAN_MODULOS_V2.md) / [`RULEBOOK_V2.md`](../docs/v2/RULEBOOK_V2.md).

Cualquier cambio de forma o permisos: actualizar **primero** la documentación acordada y las **Rules** en `firebase-v2/`, luego el código.
