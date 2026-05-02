# Continuidad de trabajo — Portal Hospital V2

**Fecha de pausa:** 25 de abril de 2026.  
**Remoto publicado:** [jorgemosto1981/portal-hospital-v2](https://github.com/jorgemosto1981/portal-hospital-v2) — URL `https://github.com/jorgemosto1981/portal-hospital-v2.git`, rama **master** = `origin/master`. En otra PC: `git clone` + sección 1 (dependencias, `.env`).

---

## 0. Remoto (hecho) — comprobación

```bash
git remote -v
# origin  https://github.com/jorgemosto1981/portal-hospital-v2.git (fetch/push)
```

Cambios nuevos: `git add` → `git commit` → `git push` · Otra PC: `git pull`.

**Si hace falta otro clon** (sin historial de la máquina vieja), creá otra copia y volvé a los pasos de sección 1. Para un repo nuevo vacío en otra plataforma, se puede reutilizar el procedimiento: `git remote set-url` o añadir un segundo `remote` (p. ej. `backup`).

---

## 1. Cómo seguir en la otra máquina

1. **Clonar** o **pull** del remoto: rama usada (p. ej. `master` / `main` según el remoto).
2. En la **raíz** `portal-hospital-v2/`: `npm install`.
3. En `web/`: `npm install` (si no instala en monorepo único, la raíz suele alcanzar; si no, `npm install --prefix web`).
4. En `functions/`: `npm install --prefix functions`.
5. Copiar/crear **`.env.v2.local` en la raíz** (no se versiona) con `VITE_V2_FIREBASE_*` (proyecto en la nube). Plantilla: `.env.v2.example` en el repo.
6. Para **seed o Admin** en scripts: `GOOGLE_APPLICATION_CREDENTIALS` = ruta al JSON de servicio (no subir a Git).
7. **JDK / CLI:** solo si tu flujo personal usa herramientas que lo requieran; para la app web basta Node + `.env.v2.local`.
8. Revisar reglas de Cursor: `.cursor/rules/` (especialmente `portal-hospital-v2-modo-atomico-movil.mdc`).

**Comandos frecuentes (desde la raíz del repo):**

- `npm run dev:web` — app en Vite.  
- `npm run build:web` — build.  
- `npm run test:firestore:v2` — prueba conectividad del cliente Firestore contra el proyecto remoto (`.env.v2.local`).  
- `npm run verify:pre-coding` — chequeo de estructura y conexión.  
- `npm run firebase:deploy:functions` — despliega Cloud Functions al proyecto V2 (plan Blaze según consola).

---

## 2. Instrucciones de producto / UX registradas (resumen)

Están incorporadas o ampliadas en **`.cursor/rules/portal-hospital-v2-modo-atomico-movil.mdc`**. Resumen:

- **Capas:** primero (cuando toque) **conexión + tipos / esquemas**; luego **lectura/escritura de datos** (servicios/hook); luego **componentes mínimos** (botones, inputs, tarjetas pequeñas), **sin** pantallas de diseño pesado hasta el paso de producto.  
- **JavaScript + JSDoc:** ancla en `web/src/types/v2-entities.js` (o migración futura a TypeScript o Zod). Conexión ya centralizada: `web/src/services/firebase.js` y `src/firebaseConfig.v2.js` (alias `@portalV2`).  
- **Tipografía:** títulos **1.25rem** (`text-xl` en Tailwind), cuerpo **1rem** (`text-base`); evitar forzar zoom.  
- **Táctil:** no depender de **hover**; **active** y **focus** / `focus-visible` en botones e inputs.  
- **Formularios:** `inputMode` adecuado: `numeric` (DNI, PIN), `email` (correos), etc.  
- **Pausa de validación (humano ↔ agente):** al probar, pedir: *"Detente aquí. No escribas más código hasta que pruebe en navegador contra el proyecto en la nube."*  
- **Referencias a archivos** con @ en Cursor al pedir lógica (evitar conexiones inventadas).  
- **Refactor:** archivos &gt; ~**100 líneas** — separar en validación (`validators.js`), hooks, etc.

---

## 3. Qué se implementó (estado del repo a esta fecha)

### Infra y Firebase

- Proyecto V2, reglas iniciales `firebase-v2/firestore.rules` (cfg, `usuarios_cuenta`, `personas` + deny by default), índices, scripts `seed:cfg`, `verify:pre-coding`, despliegue documentado.  
- **Bloque 1:** archivo `tests/firestore-rules.mjs` con `@firebase/rules-unit-testing` disponible para quien configure su propio flujo; conectividad documentada vía `npm run test:firestore:v2`.

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

- **Invocación pública** de `registrarPrimerAcceso` en GCF2 puede requerir **ajuste IAM** en producción (mencionado en `FASE_A_PASOS.md`).  
- Asignar claim **`portal_role: "rrhh"`** a usuarios de prueba (solo **Admin SDK** o script, no desde la consola básica de Auth).  
- **Pausa explícita:** el siguiente lote de código debería empezar solo tras **confirmar en la otra PC** que el pull y `npm run build:web` / prueba local funcionan.

---

## 5. Comando sugerido para Git en la otra PC

Tras clonar: `git pull` y, si aplica, `git checkout` a la rama con el commit de handoff. Ver mensaje de commit del 25/04/2026 que acompaña a este documento.

---

## 6. Cierre de entrega (sesión de preparación y sync)

- **Código y docs** alineados al plan V2, **push** a GitHub realizado, **área de trabajo** sin cambios sin commitear (salvo `.env` local, credenciales y caché).  
- **Siguiente fase** de producto: según `docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md` (pendientes: matriz de reglas / IAM para callables en prod, `completarOnboardingDatos`, UI gating) — **solo** cuando confirmes en la otra PC que `git pull` + `npm run build:web` (y a la vez `dev:web` si aplica) funcionan.  
- No hay tareas técnicas bloqueando el **uso del repo** para continuar; lo que queda es **entorno** (Node, `.env.v2.local`, JSON de servicio para seeds) en cada máquina.
