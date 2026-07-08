# Firebase project `portal-hospital-v2-dev` — setup ops

**Estado:** checklist · 2026-07-08  
**Prod piloto:** `portal-hospital-v2` (no tocar desde develop por defecto).

Crear el proyecto requiere cuenta GCP / Owner. Pasos:

1. Consola Firebase → **Add project** → ID sugerido: `portal-hospital-v2-dev` (región Functions: `southamerica-east1`).
2. Habilitar **Auth** (Email/Password o el mismo proveedor que prod), **Firestore**, **Storage**, plan Blaze si se usan Functions.
3. Crear app Web y copiar config a `.env.v2.dev.local` (gitignored) con `VITE_V2_FIREBASE_PROJECT_ID=portal-hospital-v2-dev`.
4. En este repo, actualizar [`.firebaserc`](../../.firebaserc):

```json
{
  "projects": {
    "default": "portal-hospital-v2",
    "prod": "portal-hospital-v2",
    "dev": "portal-hospital-v2-dev"
  }
}
```

5. Deploy inicial a-dev (solo cuando el proyecto exista):

```bash
firebase use dev
firebase deploy --only firestore:rules,firestore:indexes
# Functions cuando el equipo lo necesite
```

6. Seed flags Etapa 1 en **dev** (y prod cuando toque):

```bash
ALLOW_FIRESTORE_SEED_V2=true FIREBASE_V2_PROJECT_ID=portal-hospital-v2-dev node scripts/seed-v2/seed-cfg-etapa1-runtime.mjs
```

7. Desarrolladores: `firebase use dev` + `.env.v2.dev.local` → `npm run dev:web`.

Hasta que el proyecto-dev exista, **moratoria** de features no-Etapa1 sobre `portal-hospital-v2` (Política deploy).
