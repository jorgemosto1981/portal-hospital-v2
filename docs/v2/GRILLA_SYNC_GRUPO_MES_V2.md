# Fase 2 — Documento `grilla_sync_grupo_mes`

> **Estado:** ✅ **Piloto cerrado** — 2026-06-23 (Functions + Rules + Hosting prod).  
> **Commit ancla:** `38f9cfa` — lectura snapshot, trigger/callable sync, UX `GrillaSyncSectorBar`.  
> **Cierre doc + tests plan:** commit post-`51720dc` — RFC CVC-0 §3.1 + `listarVistaGrillaMesPorGrupo.snapshot.test.js`.  
> **Hosting:** https://portal-hospital-v2.web.app (`index-UIexrURZ.js` tras UX grilla 23-jun).

## Objetivo de la épica

Pasar de **listar = materializar síncrono** a **lectura optimista**: el callable entrega snapshots `vis_*` ya materializados; la consistencia eventual la resuelve un worker idempotente sobre `grilla_sync_grupo_mes`.

**Evidencia piloto (jun-2026, Sala Internación 1):** `listar` ~**2,4 s** con `materializacion_grupo.omitida: true` (antes: decenas de segundos por contención). Scripts: `scripts/smoke-grilla-sync-doc-jun26.mjs`, `scripts/smoke-grilla-sync-ciclo-jun26.mjs`.

## Colección

`grilla_sync_grupo_mes/{docId}` donde `docId = {gdt}_{anio}_{mm}` (ej. `gdt_01KQA…_2026_06`).

## Esquema

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `gdt` | string | `gdt_*` |
| `periodo` | string | `yyyy-mm` |
| `anio` / `mes` | number | Mes calendario |
| `estado` | `idle` \| `en_curso` \| `pendiente` | Máquina de estados |
| `solicitado_at` | timestamp | Última solicitud de reconciliación |
| `iniciado_at` | timestamp | Inicio de materialización async |
| `ultimo_ok_at` | timestamp | Última materialización exitosa |
| `origen_ultima_solicitud` | string | `listar_snapshot`, `rrhh_manual`, `jefe_manual`, etc. |
| `metadata` | object | `filas_sin_vis`, `materializacion_grupo`, … |
| `error` | `{ mensaje, en }` \| null | Fallo del worker |

## Flujo

1. **`listarVistaGrillaMesPorGrupo`** (lectura snapshot): batch `getAll` de `vis_*`; respuesta incluye `sync_estado`. Si `reconciliacion === "pendiente"`, encola doc `pendiente` (idempotente, fire-and-forget). Parámetro / callable `forzar_materializacion_grupo: true` conserva remat síncrono legacy (RRHH vía `solicitar…` + `forzar_sincrono`).
2. **Trigger `onGrillaSyncGrupoMesWritten`**: transición a `pendiente` (desde `idle` o doc nuevo) → `en_curso` → `materializarGrupoMes` → `idle` + `ultimo_ok_at`.
3. **Callable `solicitarReconciliacionGrillaGrupoMes`**: marca `pendiente` (async) o `forzar_sincrono: true` (solo RRHH) → `listar` con `forzar_materializacion_grupo`. Async: RRHH o jefe con `assertPlanAuth(..., "leer")` en el GDT del mes.
4. **UI web:** `useGrillaSyncState` + `GrillaSyncSectorBar` — badge + `onSnapshot` en cabecera del modal sector y en la franja «Trabajando en» (foco URL sin modal). Botón «Sincronizar sector»: RRHH (`puedeAccionesPeriodoLiquidacion`) o jefe con GSO escritura. Al pasar `en_curso` → `idle`, `vista.cargar({ bypassCache: true, background: true })`.
5. **Modal día:** sin fetch `obtenerVistaGrillaMesAgente` al abrir; placeholder «Sincronizando turno del día…» si la celda aún no está en el snapshot del listado.

## Reglas Firestore

- **Lectura:** usuario autenticado (`signedIn()`).
- **Escritura:** denegada en cliente; solo Admin SDK (Functions).

## Operación y monitoreo (post-piloto)

| Señal | Acción |
|-------|--------|
| Docs `grilla_sync_grupo_mes` en `pendiente` / `en_curso` > ~10 min | Revisar logs `onGrillaSyncGrupoMesWritten`; re-disparar con callable o `forzar_sincrono` (RRHH). |
| Latencia `listarVistaGrillaMesPorGrupo` | Debe permanecer en orden de segundos sin remat; picos → revisar tamaño sector y cold start. |
| Badge vs datos frescos | Job **día 5** y otros jobs pueden actualizar `vis_*` sin tocar el doc sync (observabilidad, no integridad). |

## Deuda técnica (no bloquea cierre de piloto)

| Tema | Notas |
|------|--------|
| **C8t / titular** | `obtenerVistaGrillaMesAgente` sigue con materialización lazy (`ensureMaterializacionVisMes`). |
| **Job día 5** | No actualiza `grilla_sync_grupo_mes`; el badge puede quedar «atrás» respecto a `vis` recién materializada por job. |
| **Épica B** | B1–B4 ✅ prod; B3/B5 opcional — [`EPICA_B_PRESENTACION_MOTOR_V2.md`](./EPICA_B_PRESENTACION_MOTOR_V2.md). |
| **O-P0-6** | Piloto `resolverFijo` / rematerializar UI (D2/D11) — backlog separado. |
| **v1.1 plan** | `onSnapshot` cliente directo a `vistas_grilla_mes_agente` en modal día — **diferido** (listado + CVC cubren piloto). |

## Trazabilidad documental

| ID | Estado |
|----|--------|
| **O-P0-7** | ✅ Piloto + **cierre Fase 5 plan** (RFC CVC-0, test listar snapshot). |
| **C8** (US-13 matriz) | ✅ Fase piloto cerrada — listar ya no es «efecto observador» síncrono de remat; reconciliación async documentada en fila C8. |

## Tests

- `node --test functions/test/listarVistaGrillaMesPorGrupo.snapshot.test.js` — default sin `materializarGrupoMes`; con `forzarMaterializacionGrupo` sí invoca worker.
- Existentes: `grillaMesAgenteCore.test.js`, `grillaSyncGrupoMesCore.test.js`.

## Módulos

- [`grillaMesAgenteCore.js`](../functions/modules/shared/grillaMesAgenteCore.js) — listado snapshot + `sync_estado`
- [`grillaSyncGrupoMesCore.js`](../functions/modules/shared/grillaSyncGrupoMesCore.js)
- [`onGrillaSyncGrupoMes.js`](../functions/triggers/onGrillaSyncGrupoMes.js)
- [`solicitarReconciliacionGrillaGrupoMes.js`](../functions/onCall/grilla/solicitarReconciliacionGrillaGrupoMes.js)
- Web: `useGrillaSyncState.js`, `GrillaBadgeSincronizacion.jsx`, `GrillaSyncSectorBar.jsx`
