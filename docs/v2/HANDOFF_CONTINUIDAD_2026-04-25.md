# Continuidad de trabajo — Portal Hospital V2

**Fecha de pausa:** 25 de abril de 2026.  
**Motivo:** retomar mañana desde **otro PC** con el repo al día en Git.

---

## 1. Cómo seguir en la otra máquina

1. **Clonar** o **pull** del remoto: rama usada (p. ej. `master` / `main` según el remoto).
2. En la **raíz** `portal-hospital-v2/`: `npm install`.
3. En `web/`: `npm install` (si no instala en monorepo único, la raíz suele alcanzar; si no, `npm install --prefix web`).
4. En `functions/`: `npm install --prefix functions`.
5. Copiar/crear **`.env.v2.local` en la raíz** (no se versiona) con `VITE_V2_FIREBASE_*` y opciones de emulador. Plantilla: `.env.v2.example` en el repo.
6. Para **seed o Admin** en scripts: `GOOGLE_APPLICATION_CREDENTIALS` = ruta al JSON de servicio (no subir a Git).
7. **JDK 21+** en PATH si vas a `npm run test:firestore:rules` o emulador de Firestore (el emulador dejó de aceptar Java 8; ver sección 4).
8. Revisar reglas de Cursor: `.cursor/rules/` (especialmente `portal-hospital-v2-modo-atomico-movil.mdc`).

**Comandos frecuentes (desde la raíz del repo):**

- `npm run dev:web` — app en Vite.  
- `npm run build:web` — build.  
- `npm run test:firestore:rules` — pruebas de reglas (requiere JDK 21+ y Firebase CLI).  
- `npm run verify:pre-coding` — chequeo de estructura y conexión.  
- `npm run firebase:emulators:with-functions` — emulador Firestore + Functions.

---

## 2. Instrucciones de producto / UX registradas (resumen)

Están incorporadas o ampliadas en **`.cursor/rules/portal-hospital-v2-modo-atomico-movil.mdc`**. Resumen:

- **Capas:** primero (cuando toque) **conexión + tipos / esquemas**; luego **lectura/escritura de datos** (servicios/hook); luego **componentes mínimos** (botones, inputs, tarjetas pequeñas), **sin** pantallas de diseño pesado hasta el paso de producto.  
- **JavaScript + JSDoc:** ancla en `web/src/types/v2-entities.js` (o migración futura a TypeScript o Zod). Conexión ya centralizada: `web/src/services/firebase.js` y `src/firebaseConfig.v2.js` (alias `@portalV2`).  
- **Tipografía:** títulos **1.25rem** (`text-xl` en Tailwind), cuerpo **1rem** (`text-base`); evitar forzar zoom.  
- **Táctil:** no depender de **hover**; **active** y **focus** / `focus-visible` en botones e inputs.  
- **Formularios:** `inputMode` adecuado: `numeric` (DNI, PIN), `email` (correos), etc.  
- **Pausa de validación (humano ↔ agente):** al probar, pedir: *"Detente aquí. No escribas más código hasta que pruebe en navegador/emulador."*  
- **Referencias a archivos** con @ en Cursor al pedir lógica (evitar conexiones inventadas).  
- **Refactor:** archivos &gt; ~**100 líneas** — separar en validación (`validators.js`), hooks, etc.

---

## 3. Qué se implementó (estado del repo a esta fecha)

### Infra y Firebase

- Proyecto V2, reglas iniciales `firebase-v2/firestore.rules` (cfg, `usuarios_cuenta`, `personas` + deny by default), índices, scripts `seed:cfg`, `verify:pre-coding`, despliegue documentado.  
- **Bloque 1:** pruebas de reglas con `@firebase/rules-unit-testing`, script `npm run test:firestore:rules` y archivo `tests/firestore-rules.mjs` (sujeto a **JDK 21+** en la máquina de desarrollo).

### Cloud Functions (`functions/index.js`)

- `healthV2`, `syncSessionClaims` (merge de **custom claims** con las existentes, p. ej. `portal_role`).  
- `rrhhAltaAgente` (claim `portal_role: "rrhh"`).  
- `registrarPrimerAcceso` (DNI+email+PIN, rate limit, transacción, evento, rollback).  
- Dependencia `ulid` en `functions/`.

### Web (`web/`)

- Vite + React + **Tailwind** vía `@tailwindcss/vite` (`index.css` con `@import "tailwindcss"`).  
- Feature **home** modular: `hooks/usePortalHome.js`, `devMessageUtils.js` (puro), `components/StatusSection.jsx`, `components/DevCallablesPanel.jsx`, `PortalHome.jsx`.  
- **Sin** `App.css` (eliminado; estilos vía Tailwind).  
- Callables: `web/src/services/callables.js` (incluye nuevas callables de paso A/B).  
- Tipos JSDoc: `web/src/types/v2-entities.js` (corte mínimo).

### Documentación

- `docs/v2/FASE_A_PASOS.md` actualizado con fases, tests y bloque 2 de callables.

---

## 4. Pendiente / riesgos conocidos

- **Emulador Firestore / pruebas de reglas** en Windows con **Java 8** fallan; hace falta **JDK 21+**.  
- **Invocación pública** de `registrarPrimerAcceso` en GCF2 puede requerir **ajuste IAM** en producción (mencionado en `FASE_A_PASOS.md`).  
- Asignar claim **`portal_role: "rrhh"`** a usuarios de prueba (solo **Admin SDK** o script, no desde la consola básica de Auth).  
- **Pausa explícita:** el siguiente lote de código debería empezar solo tras **confirmar en la otra PC** que el pull y `npm run build:web` / prueba local funcionan.

---

## 5. Comando sugerido para Git en la otra PC

Tras clonar: `git pull` y, si aplica, `git checkout` a la rama con el commit de handoff. Ver mensaje de commit del 25/04/2026 que acompaña a este documento.
