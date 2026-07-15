# Firebase project `portal-hospital-v2-dev` — setup ops

**Estado:** **operativo** (2026-07-15) · Blaze + Firestore + Auth + Functions + seed demo · wire `05dbeea` · smoke callable+Auth OK  
**Prod piloto:** `portal-hospital-v2` (no tocar desde develop por defecto).  
**Handoff pausa:** [`HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md`](./HANDOFF_SESION_2026-07-14_PAUSA_VIA_B_DEV.md)  
**Foto operativa:** [`GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md`](./GUIA_ETAPA1_ESTADO_Y_RUTA_V2.md)

### Foto checklist

| Check | Resultado |
|-------|-----------|
| Proyecto en `firebase projects:list` | ✅ `portal-hospital-v2-dev` |
| Alias `.firebaserc` → `dev` | ✅ |
| App Web + `.env.v2.dev.local` | ✅ (local, gitignored) |
| Auth Email/Password | ✅ |
| Firestore `(default)` | ✅ |
| Rules + indexes | ✅ desplegados |
| Blaze / billing | ✅ |
| Cloud Functions | ✅ (recreada `onColaRematerializacionAsistencia` tras conflicto de trigger) |
| Seed cfg + agente demo | ✅ ver § Bootstrap |
| Smoke callable+Auth login demo | ✅ 2026-07-15 |
| Commit wire Vite/bootstrap en git | ✅ `05dbeea` |
| Smoke UI navegador (opcional) | ⏳ hard refresh `localhost:5173` |

---

## Fase 1 — Consola Firebase — ✅

Hecho: Auth, Firestore, app Web, Blaze. Storage API vía Functions; si la UI pide “Get started”, completar bucket de la app.

---

## Fase 2 — Local (Vite) — ✅ (código local; commit pendiente)

Variables = prefijo **`VITE_V2_FIREBASE_*`**. Plantilla: [`.env.v2.dev.example`](../../.env.v2.dev.example).

```powershell
copy .env.v2.dev.example .env.v2.dev.local
# completar claves desde firebaseConfig
npm run dev:web:dev
```

| Script | Env file | Proyecto |
|--------|----------|----------|
| `npm run dev:web` | `.env.v2.local` | **prod** piloto |
| `npm run dev:web:dev` | `.env.v2.dev.local` | **dev** |

---

## Fase 3 — CLI deploy base — ✅

```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
firebase use dev
firebase deploy --only "firestore:rules,firestore:indexes" --project portal-hospital-v2-dev
firebase deploy --only functions --project portal-hospital-v2-dev
firebase use prod
```

**Nota:** si una function Gen2 cambia de HTTPS ↔ trigger background, hay que `firebase functions:delete NOMBRE --region southamerica-east1 --force` y redeploy.

Opcional cleanup images: `firebase functions:artifacts:setpolicy` o deploy con `--force`.

---

## Fase 4 — Seed mínimo — ✅

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
$env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
$env:ALLOW_FIRESTORE_SEED_V2="true"
# seed cfg / runtime según scripts del repo
node scripts/seed-v2/bootstrap-dev-agente.mjs
```

### Bootstrap demo (valores actuales)

| Campo | Valor |
|-------|--------|
| GDT | `gdt_01KXGK9GXHHVE0FCKPJRPDDHXA` |
| Persona | `per_01KXGK9GXJ2HS55ZZC5QB65RG4` |
| DNI / PIN | `28914247` / `123456` |
| Email Auth | `portal-dev-28914247@example.com` |

Guard: el script aborta si `FIREBASE_V2_PROJECT_ID` ≠ `portal-hospital-v2-dev`.

---

## Retoma desarrollo

Features pesadas **solo** contra-dev. A `master`/prod con flags **false** hasta acta UAT.
