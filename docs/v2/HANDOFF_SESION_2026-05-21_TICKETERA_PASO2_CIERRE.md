# Handoff — Ticketera Fase 2 · Paso 2 entorno (callable + wizard) · 2026-05-21

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · región `southamerica-east1`  
**Hosting prod:** https://portal-hospital-v2.web.app  
**Dev local:** `npm run dev:web` → http://localhost:5173/

> **Retomar en otra PC (obligatorio):**
> ```bash
> git fetch origin
> git checkout feature/ticketera-puente-campos-config
> git pull origin feature/ticketera-puente-campos-config
> ```
> **HEAD al cerrar sesión:** `72c8ae6` (remoto sincronizado).

---

## 1. Qué se cerró hoy (mapa de commits)

| Commit | Contenido | Deploy prod |
|--------|-----------|-------------|
| `9319bf7` | Backend `validarEntornoOperativoSolicitud` + core + tests T2-ent-01…05 + RFC paso 2 | Functions: solo ese callable |
| `469d7d9` | React: wizard paso 2 llama callable; bloqueo 2→3; `entornoOk` para preview/envío | Hosting |
| `72c8ae6` | Fix RRHH: `resolvePersonaIdSolicitudFlujoAgente` (token si no hay `persona_id` en body) | Functions: `validarEntornoOperativoSolicitud` + `resolverContextoLaboralSolicitud` |

**Épicas:** Grilla Oleada C **cerrada** (no reabrir salvo bug). Ticketera Fase 2 **wizard + paso 2 gate** **implementado**; falta **smoke E2E operador** post-fix RRHH.

---

## 2. Flujo progresivo Patrón B (estado actual)

| Paso UI | Callable | Estado |
|---------|----------|--------|
| 1 Artículo | `listarArticulosIngresoAgente` | ✅ prod + wizard |
| 2 Fecha + HLg + grilla/turno | `validarEntornoOperativoSolicitud` | ✅ prod + wizard (**Continuar** async) |
| 3 Preview + envío | `previsualizarSolicitudPatronB` + alta `sol_*` | ✅ requiere `entornoOk` del paso 2 |

**UI auxiliar paso 2:** `resolverContextoLaboralSolicitud` sigue cargando select de grupos (no reemplaza el gate).

**Contrato:** [`RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md`](./RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md)

---

## 3. Archivos clave (otra PC)

| Capa | Archivo | Rol |
|------|---------|-----|
| Callable | `functions/onCall/solicitudes/validarEntornoOperativoSolicitud.js` | onCall delgado |
| Core | `functions/modules/ticketera/validarEntornoOperativoCore.js` | Orquestación paso 2 |
| Gate | `functions/modules/ticketera/grillaTurnoEntornoGate.js` | RDA + turno |
| Helper | `functions/modules/shared/helpers.js` | `resolvePersonaIdSolicitudFlujoAgente` |
| Web service | `web/src/services/callables.js` | `callValidarEntornoOperativoSolicitud` |
| Hook | `web/src/features/solicitudes/useSolicitud64AAlta.js` | `validarEntornoPaso2`, `entornoOk`, `entornoMensajes` |
| Form | `web/src/features/solicitudes/SolicitudPatronBForm.jsx` | Paso 2: alerta roja + botón bloqueado |
| Página | `web/src/pages/TicketeraPatronB.jsx` | Cableado props |

**Tests:** `node --test functions/test/validarEntornoOperativo.test.js`

---

## 4. Incidente resuelto (sesión tarde)

| Síntoma | Causa | Fix |
|---------|-------|-----|
| HTTP **400** al **Continuar** paso 2 (localhost) | Token con `CFG_RRHH`: callable exigía `persona_id` en body; front no lo enviaba | `72c8ae6` — fallback a persona del token; front envía `persona_id` explícito |

**Usuario piloto afectado:** sesión con `roles_hlc_vigentes: ["CFG_RRHH"]` y `persona_id` en token (`per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`).

---

## 5. Evidencia y pilotos

| Doc / ID | Rol |
|----------|-----|
| [`TICKETERA_EVIDENCIA_2026-05-21_FASE2_WIZARD.md`](./TICKETERA_EVIDENCIA_2026-05-21_FASE2_WIZARD.md) | Piloto `sol_01KS65KJW3Q163YEJ32GHDW12E` — alta Fase 2 **sin** paso 2 callable (pre-cableado) |
| [`HANDOFF_SESION_2026-05-21_GRILLA_OLEADA_C_CIERRE.md`](./HANDOFF_SESION_2026-05-21_GRILLA_OLEADA_C_CIERRE.md) | Épica grilla cerrada |

---

## 6. Dónde seguimos (actualizado 2026-05-22)

### Cerrado ✅

- **P0** smoke wizard + paso 2 + envío (`sol_01KS7N68…` — evidencia Oleada A + Fase 2).
- **Oleada A** + bandejas RRHH/jefe (filtros, paginación, expand).
- **D** autorización TC (ya no es P1 pendiente).

### P1 — Producto ticketera (elegir uno)

| Opción | Entrega | Doc |
|--------|---------|-----|
| **B** | F3a LAO: wizard o deep-link `fecha` desde hub | `PLAN_TICKETERA_V2.md` F3a |
| **C** | F2.5 listado todos Patrón B (`TICKETERA_LISTAR_TODOS_PATRON_B=1`) | `RFC_TICKETERA_FASE2_DINAMICA_V2.md` |
| **E** | Merge / PR → `main` | Cuando operador apruebe la rama |

| **A** | Smoke matriz paso 2 (casos borde) | RFC paso 2 §6 — opcional |

### P2 — Deuda menor

- Checklist visual grilla `vis_*` por solicitud nueva.
- Índice Firestore si historial bandeja jefe falla en prod.

---

## 7. Comandos útiles

```bash
# Dev
npm run dev:web

# Build + hosting (si solo cambió web)
npm run build:web
npx firebase deploy --project portal-hospital-v2 --only hosting

# Functions paso 2 (si cambió backend ticketera)
npx firebase deploy --project portal-hospital-v2 --only "functions:validarEntornoOperativoSolicitud,functions:resolverContextoLaboralSolicitud"

# Tests paso 2
node --test functions/test/validarEntornoOperativo.test.js
```

---

## 8. Índice documental actualizado (sesión 21-may tarde)

| Documento | Estado |
|-----------|--------|
| [`RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md`](./RFC_TICKETERA_FLUJO_PROGRESIVO_PASO2_ENTORNO_V2.md) | Implementado backend + UI |
| [`RFC_TICKETERA_FASE2_DINAMICA_V2.md`](./RFC_TICKETERA_FASE2_DINAMICA_V2.md) | §3bis actualizado |
| [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) | F2 + paso 2; handoff este archivo |
| [`TICKETERA_EVIDENCIA_2026-05-21_FASE2_WIZARD.md`](./TICKETERA_EVIDENCIA_2026-05-21_FASE2_WIZARD.md) | § paso 2 callable |

---

*Handoff cierre 2026-05-21 — ticketera paso 2 entorno cableado y desplegado; siguiente sesión: smoke E2E + elegir P1 (A/B/C/D).*
