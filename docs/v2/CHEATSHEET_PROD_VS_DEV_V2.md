# Cheat sheet — Prod vs −dev (Portal Hospital V2)

**Actualizado:** 2026-07-17 · ancla de sesión: [`HANDOFF_SESION_2026-07-15_PAUSA_MODO_JEFE_Y_77_0.md`](./HANDOFF_SESION_2026-07-15_PAUSA_MODO_JEFE_Y_77_0.md)

Antes de tocar código, Firebase o seeds, respondé en voz alta:

1. ¿Vite apunta a **−dev** (`:5174`) o a **prod** (`:5173`)?
2. ¿CLI `firebase` / `--project` es **`portal-hospital-v2-dev`** o **`portal-hospital-v2`**?
3. ¿Qué SA está en `GOOGLE_APPLICATION_CREDENTIALS`?
4. ¿Las Functions que estoy probando ya están **desplegadas** en ese proyecto?

---

## Tres capas (no mezclar)

| Capa | Qué es | Dónde |
|------|--------|--------|
| **1. Código (Git)** | Lo que programás | `feature/*` → `develop` → `master` |
| **2. Runtime Firebase** | Auth + Firestore + Functions + Hosting | **Prod** `portal-hospital-v2` · **−dev** `portal-hospital-v2-dev` |
| **3. Config de negocio** | Allowlist, flags, versiones de artículos | Docs Firestore **por proyecto** (`cfg_etapa1/runtime`, `cfg_articulos/{art}/versiones/{ver}`) |

Programar ≠ publicar. Publicar ≠ encender (flags/allowlist).

---

## Comandos de esta PC

| Intención | Cómo |
|-----------|------|
| UI **−dev** | `npm run dev:web:dev` → **http://localhost:5174/** · `.env.v2.dev.local` |
| UI **prod** (piloto) | `npm run dev:web` → suele ser **:5173** · `.env.v2.local` · **cuidado** |
| Deploy Functions **−dev** | `npx firebase deploy --project portal-hospital-v2-dev --only functions:…` |
| Deploy Functions **prod** | Solo con política Etapa 1 + UAT · alias `prod` / `portal-hospital-v2` |
| Admin SDK **−dev** | `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"` + `$env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"` + `$env:ALLOW_FIRESTORE_SEED_V2="true"` solo si el script lo exige |
| Sync **cfg** prod → −dev | `npm run sync:cfg-prod-to-dev` (dry-run) · `npm run sync:cfg-prod-to-dev:apply` con `ALLOW_FIRESTORE_SEED_V2=true` · requiere `GOOGLE_APPLICATION_CREDENTIALS_PROD` + `_DEV` |
| Admin SDK **prod** | SA `C:\DATOS\portal-hospital-v2-4885ffb02c61.json` · **nunca seed agresivo** sin decisión explícita |
| Alias Firebase CLI | `.firebaserc`: `dev` → `portal-hospital-v2-dev` · `prod` / `default` → `portal-hospital-v2` |

---

## Anti-errores ya vivídos

1. Vite en **:5173** (prod) mientras creías estar en −dev → usar **:5174** + `v2-dev`.
2. Misma app Firebase en el tab → `src/firebaseConfig.v2.js` nombra `portal-hospital-v2-${projectId}`.
3. 64 no listado: HLc sin `escalafon_id` aunque el art esté en allowlist.
4. Versión de artículo = **subcolección** `cfg_articulos/{artId}/versiones/{verId}` (no solo el doc raíz).
5. Predeploy `sync-shared-to-functions` ensucia working tree con CRLF → no commitear ruido de sync.

---

## Diagrama

```text
  [programar]  feature/*  ──merge──►  develop  ──merge+UAT──►  master
                    │                      │                      │
                    ▼                      ▼                      ▼
              deploy opcional         Firebase-dev           Firebase-prod
              a −dev                  datos de prueba         Soft Launch
                    │                      │                      │
                    └──── flags/allowlist en CFG de ESA BD ───────┘
```
