# Portal Hospital — versión 2 (recursos aislados)

Carpeta **hermana** de `../portal-hospital-v1/`: aquí vive el **proyecto Firebase `portal-hospital-v2`**, la documentación de producto en `docs/v2/`, los scripts de semilla, reglas/índices bajo `firebase-v2/`, [`firebase.json`](./firebase.json) en la **raíz** (deploy de Functions + rutas a esas reglas), y el módulo [`src/firebaseConfig.v2.js`](./src/firebaseConfig.v2.js) (cliente web; depende de [`src/utils/logger.js`](./src/utils/logger.js) copiado desde la V1).

## App web V2 (Vite)

En [`web/`](./web/) hay una app **React + Vite** que lee **`VITE_V2_*` desde `.env.v2.local` en la raíz** (Vite no carga ese nombre por defecto; `web/vite.config.js` lo inyecta) y el SDK compartido con alias `@portalV2` → `src/`. Índice técnico: [`web/SCHEMA.md`](./web/SCHEMA.md). Reglas Cursor para esta app: [`.cursor/rules/portal-hospital-v2-web.mdc`](./.cursor/rules/portal-hospital-v2-web.mdc) · índice [`.cursorrules`](./.cursorrules).

| Comando | Uso |
|--------|-----|
| `npm run dev:web` | Desarrollo (`web/`, puerto por defecto de Vite) |
| `npm run build:web` | Build de producción en `web/dist/` |
| `npm run preview:web` | Vista previa del build |

Desde `web/`: `npm run dev` / `npm run build` (mismo efecto).

## Comandos (desde esta raíz)

Tras `npm install` en la raíz y **`cd web && npm install`** la primera vez (o solo `npm install` dentro de `web/`):

| Comando | Uso |
|--------|-----|
| `npm run verify:pre-coding` | Checklist previa al código |
| `npm run test:firestore:v2` | Prueba cliente Firestore contra la nube + `.env.v2.local` |
| `npm run firebase:deploy:firestore` | Despliega reglas e índices al proyecto V2 en consola |
| `npm run firebase:deploy:functions` | Despliega Cloud Functions (plan Blaze; script con `FUNCTIONS_DISCOVERY_TIMEOUT=60`) |

Si Cloud Build falla con **missing permission on the build service account**, seguí [Solución de problemas de Cloud Functions — cuenta de servicio de compilación](https://cloud.google.com/functions/docs/troubleshooting#build-service-account) en la consola GCP (propietario del proyecto o administrador IAM).
| `npm run seed:cfg` | **Bloqueado por defecto.** Solo con `ALLOW_FIRESTORE_SEED_V2=true` + `GOOGLE_APPLICATION_CREDENTIALS`. Política: no semillar BD salvo excepción operativa. Ver `scripts/seed-v2/guard-no-seed.mjs`. |
| `npm run firestore:create` | Windows: script gcloud para crear instancia Firestore (una vez) |

- Variables web: [`.env.v2.example`](./.env.v2.example) → **`.env.v2.local`** (no comitear).
- Plan maestro: [PLAN_DESARROLLO_VERSION2.md](./PLAN_DESARROLLO_VERSION2.md) · índice de docs: [docs/v2/README.md](./docs/v2/README.md).
- **Retomar sesión (2026-06-04):** [docs/v2/HANDOFF_SESION_2026-06-04_CIERRE_FUX_BATCH_Y_DOCUMENTAL.md](./docs/v2/HANDOFF_SESION_2026-06-04_CIERRE_FUX_BATCH_Y_DOCUMENTAL.md) · rama `feat/epic-multi-hlg-fase1-execution`.
- **F-UX.3 gestión turno (cerrado):** [docs/v2/REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md](./docs/v2/REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md).
- **Retomar sesión (28/05/2026):** [docs/v2/HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md](./docs/v2/HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) — control turno en todas las vistas; `grilla_aprobada` en `plt_*`; piloto `plt_01KSR8J55H1TN10M3ANSSWMPF2`.

## App React (V1)

El front histórico de la institución puede seguir en [`../portal-hospital-v1/portal-hospital/`](../portal-hospital-v1/portal-hospital/). Para V2 greenfield usá la app en [`web/`](./web/); la integración cruzada sigue documentada en [`docs/v2/ARRANQUE_BD_Y_CODIGO_V2.md`](./docs/v2/ARRANQUE_BD_Y_CODIGO_V2.md).

## CLI Firebase

`firebase` suele leer [`.firebaserc`](./.firebaserc) (proyecto por defecto: `portal-hospital-v2`). Asegurá `firebase login` si hace falta.
