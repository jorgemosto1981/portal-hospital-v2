# Handoff — 2026-07-14 Pausa Vía B (`portal-hospital-v2-dev`)

**Estado:** **PAUSA formal** · Vía B setup **operativo** (Firestore/Auth/Functions/seed/login demo) · smoke login en Vite **pendiente de validar en navegador**  
**Git HEAD (pausa):** `e9a39ad` (docs Soft Launch) · **cambios locales sin commit** (wire Vite + bootstrap + docs setup)  
**CLI Firebase:** alias activo **`prod`** (`portal-hospital-v2`) tras deploys-dev  
**Guía viva:** [`GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md`](./GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md)  
**Setup checklist:** [`ETAPA1_FIREBASE_DEV_SETUP_V2.md`](./ETAPA1_FIREBASE_DEV_SETUP_V2.md)

Relacionados: [`HANDOFF_SESION_2026-07-14_CIERRE_DEPLOY_ETAPA1.md`](./HANDOFF_SESION_2026-07-14_CIERRE_DEPLOY_ETAPA1.md) (Vía A) · [`ETAPA1_GIT_Y_ENTORNOS_V2.md`](./ETAPA1_GIT_Y_ENTORNOS_V2.md)

---

## 1. Resumen ejecutivo

| Vía | Estado al pausar |
|-----|------------------|
| **A — Soft Launch prod** | Sin cambio · hosting/`6dee722` · pelota RRHH (UAT + altas) |
| **B — entorno-dev** | Proyecto usable · Functions desplegadas · agente demo listo · falta smoke UI + commit del wire local |

---

## 2. Hecho en esta oleada (Vía B)

### Consola / proyecto

| Pieza | Estado |
|-------|--------|
| Proyecto `portal-hospital-v2-dev` | ✅ |
| Alias `.firebaserc` → `dev` | ✅ |
| App Web + `.env.v2.dev.local` (gitignored) | ✅ |
| Auth Email/Password | ✅ (uso login DNI→callable→email) |
| Firestore `(default)` | ✅ (creado al deploy rules/indexes) |
| Blaze / cuenta facturación | ✅ vinculado (USD; no documentar ID en repo) |
| Storage API | ✅ habilitada vía deploy Functions (Get started UI si falta bucket app) |

### Local / repo (aún **sin commit** al pausar)

| Pieza | Archivo / nota |
|-------|----------------|
| Script Vite-dev | `package.json` → `dev:web:dev` / `build:web:dev` (mode `v2-dev`) |
| Carga env Vite | `web/vite.config.js` → mode `v2-dev` lee `.env.v2.dev.local` |
| Plantilla env | `.env.v2.dev.example` (+ mención en `.env.v2.example`) |
| Bootstrap agente | `scripts/seed-v2/bootstrap-dev-agente.mjs` |
| Docs setup (borrador previo) | `docs/v2/ETAPA1_FIREBASE_DEV_SETUP_V2.md` |

`npm run dev:web` **sigue** apuntando a **prod** (`.env.v2.local`). Para-dev: **`npm run dev:web:dev`**.

### Deploy CLI-dev

| Pieza | Estado |
|-------|--------|
| `firestore:rules` + `firestore:indexes` | ✅ desplegados |
| Cloud Functions (casi todas) | ✅ en `southamerica-east1` |
| `onColaRematerializacionAsistencia` | ✅ recreada (había conflicto HTTPS→Firestore trigger; delete + create) |
| Cleanup Artifact Registry | ⚠️ warning no bloqueante (`functions:artifacts:setpolicy` / `--force`) |

Callables críticas presentes: `resolverEmailLoginDni`, `registrarAcuseRechazoAgente`, `obtenerContextoAcuseRechazoAgente`.

**PATH Windows (predeploy):** anteponer `C:\Program Files\nodejs` al `PATH` para no usar el Node embebido de Cursor.

```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
firebase deploy --only functions --project portal-hospital-v2-dev
firebase use prod
```

### Seed / datos demo-dev

| Recurso | Valor |
|---------|--------|
| SA Admin (fuera del repo) | `C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json` |
| `seed:cfg` + `cfg_etapa1/runtime` | ✅ |
| GDT base | `gdt_01KXGK9GXHHVE0FCKPJRPDDHXA` («grupo base inicial») |
| Persona demo | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` |
| Login UI | DNI `28914247` · PIN `123456` |
| Auth email | `portal-dev-28914247@example.com` |
| Cadena laboral | HLc→HLd→HLg + claims `CFG_USUARIO` + `cargo_activo` |
| Allowlist Etapa 1 | GDT demo en `cfg_etapa1/runtime` |

Scripts Admin contra-dev (PowerShell):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
$env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
$env:ALLOW_FIRESTORE_SEED_V2="true"
```

`load-env-v2.mjs` puede leer `.env.v2.local` (prod); **no pisa** variables ya definidas en el entorno.

**Modelo IDs (no confundir):** docs = `per_` / `usr_` / `gdt_` (ULID). Login UI = DNI+PIN → `resolverEmailLoginDni` → Auth email. **No** usar Auth UID como FK de negocio.

---

## 3. Pendiente inmediato (retoma)

1. **Commit** del wire local (sin `_tmp-*`, sin `.env.*.local`, sin SA):  
   `package.json`, `web/vite.config.js`, `.env.v2.dev.example`, `.env.v2.example` (si aplica), `scripts/seed-v2/bootstrap-dev-agente.mjs`, docs Etapa 1/handoff.  
   Ignorar diffs espurios en `functions/modules/shared/*` si solo vinieron del predeploy sync (revisar antes de stage).
2. **Smoke UI:** `npm run dev:web:dev` → login `28914247` / `123456` → callable login OK.
3. Desarrollo features grandes **solo** contra-dev; a `master` solo con flags **off**.
4. Negocio Vía A (paralelo humano): UAT Soft Launch + altas 5–10 en **prod**.

---

## 4. IDs útiles (prod vs-dev)

| Recurso | Prod Soft Launch | Dev |
|---------|------------------|-----|
| Proyecto | `portal-hospital-v2` | `portal-hospital-v2-dev` |
| GDT | `gdt_01KX107ZZTPKF12A1ED2XVKNMM` | `gdt_01KXGK9GXHHVE0FCKPJRPDDHXA` |
| CAMBIO-DIA art/ver | `art_01KX0Z07N5PFY7ZG0ZZP93EJ8H` / `ver_01KX0Z07N70GZKBKF1P27C78SY` | (seed cfg; no hardcode UI) |
| Hosting | https://portal-hospital-v2.web.app | (local Vite / Hosting-dev opcional luego) |

---

## 5. Qué **no** hacer al retomar

- No apuntar `dev:web` / scripts seed a prod por error de env.
- No sharear ni commitear IDs de facturación, SA JSON ni `.env.v2*.local`.
- No avanzar features LAO/LM/GSO a prod sin flag off + acta.

---

**Pausa formal · 2026-07-14 (tarde)** — Vía B operativa en cloud; retomar: commit wire + smoke login Vite-dev.
