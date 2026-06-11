# Handoff — Sesión 2026-06-11 · Cierre Camino B (capabilities periféricas) + bloque macro permisos

**Estado:** **Camino B CERRADO** en `master` (squash + docs + deploy hosting).  
**Producción:** https://portal-hospital-v2.web.app · bundle **`index-CCAzVApV.js`**  
**Índice RETOMAR AQUÍ:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) — bandeja aprobación **3 meses (P2)**  
**Contexto GDT / T-05:** [`HANDOFF_SESION_2026-06-08_PAUSA_T05_CONTEXTO_GDT.md`](./HANDOFF_SESION_2026-06-08_PAUSA_T05_CONTEXTO_GDT.md)

---

## 1. Resumen ejecutivo

| Bloque | Estado | Referencia `master` |
|--------|--------|---------------------|
| **T-06** guardrails US-13 (modal · combo · outbox) | ✅ | `5c3fd86` |
| **Camino A** capabilities GSO (grilla + planes por shell) | ✅ | `b12ab13` |
| **T-07 / T-07b** caché RAM grilla + catálogo laboral | ✅ | `a5ca021` · `9a5875b` |
| **Camino A planes** consola jefe (intenciones · acordeón · outbox) | ✅ | `b557d12` |
| **Camino B** periferia (`esRrhh` / claims en UI) | ✅ | `f1d7add` (squash) |
| **Índice sesión + deploy** | ✅ | `e442ca5` · hosting 2026-06-11 |

---

## 2. Camino B — entregables

### 2.1 Commits

| Commit | Mensaje |
|--------|---------|
| `f1d7add` | `refactor(capabilities): extinguir deuda tecnica de esRrhh periferico, menu dinamico y redirect por local shell` |
| `e442ca5` | `docs: marcar Camino B capabilities como completado al 100% en master` |

Rama de trabajo local (histórico): `feat/gso-capabilities-saneamiento-periferico` (`b34cf94` + `78606a9` → squash).

### 2.2 Módulos clave

| Área | Archivos |
|------|----------|
| Capabilities periféricas | `web/src/features/routing/portalPerifericoCapabilities.js` (+ tests) |
| Persistencia shell GSO | `web/src/features/routing/portalGsoShellStorage.js` · clave `last_visited_gso_shell` |
| Redirect `/portal/grilla` | `web/src/features/routing/GrillaPortalRedirect.jsx` |
| Menú por ruta | `web/src/components/layout/menuGrupoAcceso.js` · `shellMenuPortalDesdePathname` |
| Export matriz | `permiteExportarMatrizMacro` en `grillaOperativaCapabilities.js` |
| Normalización claims | `claimsIncludeRrhh` **solo** en `portalRole.js` (UI viva sin grep reactivo) |

### 2.3 Tests

- Vitest periférico: **16/16** (`portalPerifericoCapabilities`, `portalGsoShellStorage`, `menuGrupoAcceso`, `grillaOperativaCapabilities`).

### 2.4 Deploy

```text
npm run build:web
firebase deploy --project portal-hospital-v2 --only hosting
```

Smoke estático bundle `web/dist/assets/index-CCAzVApV.js`:

- `last_visited_gso_shell` — presente (localStorage).
- `shellMenuPortalDesdePathname` — nombre minificado en prod; lógica vía rutas (`grilla-operativa`, etc.).

---

## 3. Próximo sprint sugerido

**P2 — Bandeja de aprobación 3 meses (RRHH):** reutilizar patrón panorámico de la consola triple horizonte jefe para auditoría trimestral institucional. Ver fila **Camino B** cerrada y backlog §3 en [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md).

---

## 4. Operador

- `master` sincronizado con `origin/master` post-handoff.
- Sin tag de release nuevo en esta sesión (opcional futuro si RRHH pide versión nombrada).
