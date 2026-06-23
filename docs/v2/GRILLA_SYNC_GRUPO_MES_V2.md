# Fase 2 — Documento `grilla_sync_grupo_mes`

> **Estado:** implementado en Functions (trigger + callable). **UI (badge / onSnapshot):** PR siguiente.

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
| `origen_ultima_solicitud` | string | `listar_snapshot`, `rrhh_manual`, etc. |
| `metadata` | object | `filas_sin_vis`, `materializacion_grupo`, … |
| `error` | `{ mensaje, en }` \| null | Fallo del worker |

## Flujo

1. **`listarVistaGrillaMesPorGrupo`** (lectura snapshot): si `sync_estado.reconciliacion === "pendiente"`, escribe doc `pendiente` (idempotente).
2. **Trigger `onGrillaSyncGrupoMesWritten`**: transición a `pendiente` (desde `idle` o doc nuevo) → `en_curso` → `materializarGrupoMes` → `idle` + `ultimo_ok_at`.
3. **Callable `solicitarReconciliacionGrillaGrupoMes`**: marca `pendiente` (async) o `forzar_sincrono: true` (solo RRHH) → `listar` con `forzar_materializacion_grupo`. Async: RRHH o jefe con `assertPlanAuth(..., "leer")` en el GDT del mes.
4. **UI web**: `GrillaSyncSectorBar` / `useGrillaSyncSectorBar` — badge + listener en cabecera del modal sector y en la franja «Trabajando en» (foco URL sin modal). Botón «Sincronizar sector»: RRHH (`puedeAccionesPeriodoLiquidacion`) o jefe con GSO escritura en el sector.

## Reglas Firestore

- **Lectura:** usuario autenticado (`signedIn()`).
- **Escritura:** denegada en cliente; solo Admin SDK (Functions).

## Módulos

- [`grillaSyncGrupoMesCore.js`](../functions/modules/shared/grillaSyncGrupoMesCore.js)
- [`onGrillaSyncGrupoMes.js`](../functions/triggers/onGrillaSyncGrupoMes.js)
- [`solicitarReconciliacionGrillaGrupoMes.js`](../functions/onCall/grilla/solicitarReconciliacionGrillaGrupoMes.js)
