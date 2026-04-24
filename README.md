# Portal Hospital — versión 2 (recursos aislados)

Carpeta **hermana** de `../portal-hospital-v1/`: aquí vive el **proyecto Firebase `portal-hospital-v2`**, la documentación de producto en `docs/v2/`, los scripts de semilla, reglas/índices bajo `firebase-v2/`, y el módulo [`src/firebaseConfig.v2.js`](./src/firebaseConfig.v2.js) (cliente web; depende de [`src/utils/logger.js`](./src/utils/logger.js) copiado desde la V1).

## Comandos (desde esta raíz)

Tras `npm install`:

| Comando | Uso |
|--------|-----|
| `npm run firebase:emulators` | Emulador Firestore (config `firebase-v2/firebase.json`) |
| `npm run firebase:deploy:firestore` | Despliega reglas e índices al proyecto V2 en consola |
| `npm run seed:cfg` | Volcado de catálogos `cfg_*` (ver `docs/v2/MODULO_CONFIGURACION_V2.md`) — requiere `GOOGLE_APPLICATION_CREDENTIALS` |
| `npm run firestore:create` | Windows: script gcloud para crear instancia Firestore (una vez) |

- Variables web: [`.env.v2.example`](./.env.v2.example) → **`.env.v2.local`** (no comitear).
- Plan maestro: [PLAN_DESARROLLO_VERSION2.md](./PLAN_DESARROLLO_VERSION2.md) · índice de docs: [docs/v2/README.md](./docs/v2/README.md).

## App React (V1)

El front con Vite actual sigue en [`../portal-hospital-v1/portal-hospital/`](../portal-hospital-v1/portal-hospital/). Integrar V2: importar o copiar el módulo bajo `src/` de esta repo y ajustar Vite/variables; ver [`docs/v2/ARRANQUE_BD_Y_CODIGO_V2.md`](./docs/v2/ARRANQUE_BD_Y_CODIGO_V2.md).

## CLI Firebase

`firebase` suele leer [`.firebaserc`](./.firebaserc) (proyecto por defecto: `portal-hospital-v2`). Asegurá `firebase login` si hace falta.
