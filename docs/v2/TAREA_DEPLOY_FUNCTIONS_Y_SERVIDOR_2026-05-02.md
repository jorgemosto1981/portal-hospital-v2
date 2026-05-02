# Tarea: deploy Cloud Functions, configuración Firebase CLI y servidor web (2026-05-02)

Documento de continuidad para retomar el trabajo. Resume decisiones técnicas, errores encontrados y estado al cierre de la sesión.

---

## 1. Contexto

- Proyecto Firebase: **`portal-hospital-v2`** (plan **Blaze** activado por el usuario).
- Objetivo: desplegar **Cloud Functions** para que las **callables** (`listarColeccion`, etc.) dejen de responder **404** (que el navegador muestra como “falso CORS”).
- Política del repo: cliente **solo nube** (sin Firebase Local Emulator Suite en la app).

---

## 2. Cambios en el repositorio (estructura Firebase)

### `firebase.json` en la raíz

Firebase CLI exige que `functions.source` esté **dentro** del directorio que contiene `firebase.json`. La configuración anterior (`firebase-v2/firebase.json` con `"source": "../functions"`) fallaba con:

`Error: ../functions is outside of project directory`

**Solución aplicada:**

- Archivo **[`firebase.json`](../../firebase.json)** en la raíz de `portal-hospital-v2` con:
  - `firestore.rules` / `indexes` → rutas bajo `firebase-v2/`
  - `storage.rules` → `firebase-v2/storage.rules`
  - `functions.source` → **`functions`** (carpeta [`functions/`](../../functions) en la raíz)
- Se **eliminó** [`firebase-v2/firebase.json`](../../firebase-v2/firebase.json) para no duplicar config.

### Scripts npm ([`package.json`](../../package.json))

- `firebase` → invoca la CLI sin `--config` extra (usa `./firebase.json`).
- `firebase:deploy:firestore` → `firebase deploy --project portal-hospital-v2 --only firestore:rules,firestore:indexes`
- `firebase:deploy:functions` → **`node scripts/firebase-deploy-functions.mjs`**

### Script de deploy de Functions

[`scripts/firebase-deploy-functions.mjs`](../../scripts/firebase-deploy-functions.mjs) exporta **`FUNCTIONS_DISCOVERY_TIMEOUT=60`** antes del deploy para evitar:

`User code failed to load … Timeout after 10000`

(en equipos Windows o disco lento durante el “discovery” de funciones).

### Otras actualizaciones

- [`scripts/seed-v2/verify-pre-coding.mjs`](../../scripts/seed-v2/verify-pre-coding.mjs): comprueba existencia de `firebase.json` en raíz.
- [`README.md`](../../README.md): nota sobre troubleshooting de **Cloud Build / cuenta de servicio** y enlace a documentación Google.

---

## 3. Resultado del despliegue (cerrado 2026-05-02)

- **`npm run firebase:deploy:functions` completó correctamente** para todas las funciones en **southamerica-east1** (2nd gen, Node.js 22).
- **Causa del fallo previo (healthcheck / 404 en callables):** en la nube el paquete solo incluye la carpeta `functions/`. Varios módulos hacían `require("../../shared/runtimeFlags.json")`, que apunta al `shared/` del **repo** (fuera del ZIP). En Cloud Run el arranque fallaba con `Cannot find module '../../shared/runtimeFlags.json'` y el contenedor nunca escuchaba en el puerto → el navegador veía 404 y “CORS faltante”.
- **Corrección aplicada:** copia desplegable en [`functions/modules/shared/runtimeFlags.json`](../../functions/modules/shared/runtimeFlags.json) y `require("./shared/runtimeFlags.json")` en `rrhh.js`, `catalogosCore.js`, `catalogosLaborales.js`, `catalogosPersonales.js`.
- **Nota:** el archivo raíz [`shared/runtimeFlags.json`](../../shared/runtimeFlags.json) sigue usándose en el **front (Vite)**. Si se cambia `OPEN_ACCESS_TEMP`, actualizar **ambas** copias para no desalinear.

Mensaje eventual de la CLI sobre **política de limpieza de artefactos** (Artifact Registry): opcional ejecutar `firebase functions:artifacts:setpolicy` en el proyecto; no impide el servicio de las funciones.

### 403 en `OPTIONS` + “CORS Missing Allow Origin” (callables)

Si el preflight devuelve **403** y el navegador se queja de CORS, suele ser **IAM de Cloud Run** (el OPTIONS no lleva token de Firebase): el frontend no llega a ejecutar la callable. En Gen2, declarar en [`functions/index.js`](../../functions/index.js) `setGlobalOptions({ …, invoker: "public" })` para que los servicios Cloud Run acepten invocación pública en el borde; la **autorización de negocio** sigue en el código (`assertRrhh`, tokens, etc.).

---

## 4. Servidor de desarrollo (Vite)

- Comando desde la raíz del repo: **`npm run dev:web`**
- URL habitual: **http://localhost:5173/** (si el puerto está ocupado, Vite puede usar otro; mirar la salida de la terminal).

En la sesión actual se **reinició** el servidor tras liberar puertos **5173** / **5174**.

---

## 5. Verificación: conexión directa a BD y sin datos ficticios / mocks (cliente V2)

Revisión puntual del código al cerrar la tarea:

| Requisito | Cómo se cumple |
|-----------|----------------|
| Firebase en **nube** (sin emuladores en el cliente) | [`src/firebaseConfig.v2.js`](../../src/firebaseConfig.v2.js): solo `initializeApp` / `getFirestore` / `getAuth` / `getStorage`; sin `connectFirestoreEmulator`, `connectFunctionsEmulator`, etc. |
| Callables contra **Cloud Functions** reales | [`web/src/services/functionsV2.js`](../../web/src/services/functionsV2.js): `getFunctions(appV2, "southamerica-east1")` sin emulador. [`web/src/services/callables.js`](../../web/src/services/callables.js): `httpsCallable` a funciones desplegadas. |
| Onboarding sin catálogo maquetado | [`web/src/pages/Onboarding.jsx`](../../web/src/pages/Onboarding.jsx): grupos vía `callListarCatalogoOnboarding` / `callListarColeccionPublicaTemporal` (datos desde Firestore por función). |
| Alta de legajo contra Firestore | [`web/src/services/onboardingService.js`](../../web/src/services/onboardingService.js): `writeBatch` + `doc(db, …)` en colecciones reales (`personas`, `historial_laboral_cargos`). |
| Búsqueda de “mock” en `web/src` | Sin coincidencias de mocks de negocio en `*.js` / `*.jsx` (solo textos informativos en pantallas de datos personales/laborales que indican “BD real”). |

**Nota:** `horarioPlantillaOnboardingGenerico()` en `onboardingService` es una **plantilla estructural** por defecto (horario), no un listado ficticio de catálogos; catálogos y grupos vienen de la BD vía callables o reglas.

---

## 6. Próximos pasos opcionales

1. `firebase functions:artifacts:setpolicy` si se desea evitar acumulación de imágenes en Artifact Registry.
2. Unificar en un solo origen el flag `OPEN_ACCESS_TEMP` (build o script) para no duplicar `runtimeFlags.json` en raíz y en `functions/`.

---

## 7. Referencias rápidas

| Recurso | Ruta / comando |
|--------|----------------|
| Config deploy raíz | [`firebase.json`](../../firebase.json) |
| Código Functions | [`functions/`](../../functions) |
| Cliente web Firebase | [`src/firebaseConfig.v2.js`](../../src/firebaseConfig.v2.js) |
| Variables web | `.env.v2.local` (plantilla `.env.v2.example`) |
| Deploy functions | `npm run firebase:deploy:functions` |
| Flags runtime (Functions + sync con front) | [`functions/modules/shared/runtimeFlags.json`](../../functions/modules/shared/runtimeFlags.json), [`shared/runtimeFlags.json`](../../shared/runtimeFlags.json) |

---

*Última actualización del documento: 2026-05-02 — tarea de deploy y corrección `runtimeFlags` cerrada; verificación BD real / sin mocks en §5.*
