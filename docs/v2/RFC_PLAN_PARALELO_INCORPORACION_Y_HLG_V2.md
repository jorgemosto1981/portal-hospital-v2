---
name: Plan paralelo incorporación y ciclo HLg
status: aprobado-producto
fase_implementacion: "Fases 0–2 backend core 2026-06-04; Fases 3–5 pendientes"
piloto: "Sala junio 2026 (gdt_01KQA6QCA8TDQK9YBTHKYA4R2V)"
---

# RFC — Planes paralelos de incorporación y ciclo de vida HLg (V2)

## 1. Contexto y principios rectores

Brecha detectada: al **incorporar** agentes en un mes ya **HABILITADO**, el código actual pasa el **mismo** `plt_*` a `EN_REVISION`, degradando la operación de la dotación ya aprobada (LOKITO/MOSTO en piloto Sala).

Principios:

1. **Sin compatibilidad hacia atrás en HLg anuladas:** las HLg deshabilitadas o anuladas se **borran físicamente** de `historial_laboral_grupos`. Trazabilidad mínima en `evt_*` (B6), no documento HLg huérfano.
2. **Inmutabilidad del régimen en HLg vigente:** prohibido cambiar `regimen_horario_id` en una fila existente. Cambio de régimen = **cerrar** HLg (adelantar `fecha_fin`) o **eliminar** + **alta nueva**.
3. **Plan principal estable:** el `plt_*` con `plan_rol=principal` y `estado=HABILITADO` **no muta** salvo **merge explícito** tras aprobar un `plt_inc` o flujos RRHH distintos (revertir plan completo, fuera de este RFC).
4. **Regímenes planificado vs fijo/rotativo:**
   - **Planificado** sin fila en plan principal → flujo **`plt_inc`** + aprobación RRHH (turnos explícitos).
   - **Fijo / rotativo** con HLg nueva → **sin** `plt_inc` y **sin** auto-append al `agentes[]` del principal. Teoría vía materialización desde HLg + `cfg_regimen_horario`. UI: **aviso de novedad** (informativo), no CTA de incorporación.

Referencias: [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md), [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md), [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md) §4.4.1, [`SIMULACION_IMPACTOS_HLG_PLAN_TURNO_GSO_V2.md`](./SIMULACION_IMPACTOS_HLG_PLAN_TURNO_GSO_V2.md) (§A2 queda **obsoleto** respecto a edición de régimen).

---

## 2. Eje A — Arquitectura de incorporación (planes paralelos)

### 2.1 Modelo conceptual

| Rol | `plan_rol` | Estado operativo típico | Consumidor materialización |
|-----|------------|-------------------------|----------------------------|
| **Plan principal** | `principal` | `HABILITADO` | `obtenerPlanHabilitado*` — dotación aprobada |
| **Plan de incorporación** | `incorporacion` | `BORRADOR` → `ENVIADO` → `EN_REVISION` | Solo agentes nuevos; al aprobar → merge al principal |

Vínculo: `plan_padre_id` → id del principal. Un principal **HABILITADO** puede coexistir con **un** hijo en flujo activo (`BORRADOR` \| `ENVIADO` \| `EN_REVISION`).

### 2.2 Ciclo de vida del plan paralelo

1. **Generación:** banner ámbar (solo planificados) → jefe **Incorporar** → callable crea `plt_inc` en `BORRADOR` (solo agentes nuevos permitidos por `detectarAgentesNuevosPlanificados`).
2. **Flujo aislado:** guardar/enviar actúan **solo** sobre `plt_inc`. El principal permanece `HABILITADO`.
3. **Rechazo RRHH:** hijo → `BORRADOR` (re-edición y reenvío). Principal intacto.
4. **Aprobación y merge:**
   - Materializar **solo** `persona_id` del hijo (`materializarGrupoMes` con filtro + `planCache` del hijo).
   - Transacción atómica: merge `agentes[]` al principal; **append** quirúrgico en `grilla_aprobada.agentes` (amendment a RFC grilla aprobada); actualizar arrays denormalizados; registrar en `incorporaciones_mergeadas[]` del padre.
   - Hijo → estado **`MERGEADO`** (terminal, read-only). **No** borrado físico.

### 2.3 Estado `MERGEADO`

- Añadir a `ESTADOS_VALIDOS` del backend.
- Excluido de bandejas pendientes, `elegirPlanMensualCanonico` operativo y `obtenerPlanHabilitado*`.
- Visible en historial / auditoría (`plan_padre_id`, `resultado_merge`).

### 2.4 UI (objetivo Fase 3)

- Dos tarjetas en mes con principal habilitado: principal + incorporación activa (si existe).
- Bandeja RRHH: pendientes = solo `plan_rol=incorporacion`.
- **Banner dual:** ámbar + CTA incorporar (planificados); novedad informativa (fijo/rotativo sin fila en plan).

---

## 3. Eje B — HLg y efecto cascada en `plt_*`

### 3.1 Eliminación / anulación HLg

- **BD:** `delete` del documento `hlg_*` tras cascada exitosa.
- **Evento:** `crearEventoDatosLaborales` con refs antes del delete.
- **Planes:** búsqueda por `agentes_hlg_ids` `array-contains` (campo denormalizado, Fase 1). **Purga selectiva:** quitar bloque del agente en `agentes[]`. Si `agentes[]` queda vacío → borrado lógico del plan (`eliminado: true`) o política mensual acordada.

### 3.2 Cierre HLg (adelanto `fecha_fin`)

- Planes de **meses posteriores** al corte: purga selectiva del agente (como eliminación).
- Plan del **mes de corte:** mantener agente en `agentes[]` pero **truncar** `dias` desde el día posterior al corte.
- **Materialización:** `purgeCapaTeoricaGdtRango` / `materializarRango` por persona; **no** `materializarGrupoMes` completo del grupo.

### 3.3 Cambio de régimen

No existe como edición. Flujo: cierre HLg vieja → nueva HLg → si planificado y mes con principal habilitado → `plt_inc`.

### 3.4 Atomicidad

- Batch/transacción: si falla actualización de algún `plt_*`, **no** borrar HLg.
- Límite Firestore 500 ops: en piloto, fallar con listado de `plt_id` si excede umbral.

---

## 4. Esquema `planes_turno_servicio` (extensiones mensual)

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `plan_rol` | `principal` \| `incorporacion` | Sí (default `principal` post-migración) | Rol en el par grupo+período |
| `plan_padre_id` | string \| null | Sí en incorporación | FK `plt_*` principal |
| `agentes_persona_ids` | string[] | Mantenido en writes | Query purga / auditoría |
| `agentes_hlg_ids` | string[] | Mantenido en writes | Cascada HLg |
| `incorporaciones_mergeadas` | array | No | `{ plan_id, mergeado_en, mergeado_por_persona_id }` en principal |
| `resultado_merge` | object \| null | No | En hijo al pasar a `MERGEADO` |

### 4.1 Índices Firestore (Fase 1)

- Compuesto listados: `grupo_id`, `periodo`, `tipo_plan`, `plan_rol`, `estado`.
- `agentes_hlg_ids` + `array-contains` para cascada.

### 4.2 Invariantes (reemplazan `PLT-GRD-001` / `PLT-APR-DUP` parcial)

- Un `principal` activo (`eliminado !== true`, no `CERRADO`/`MERGEADO`) por `grupo_id + periodo`.
- Un `incorporacion` en flujo activo por mismo par.
- Aprobar incorporación: permitido con principal `HABILITADO` presente (no error duplicado).

---

## 5. Amendment — `grilla_aprobada`

Tras habilitar, el snapshot es inmutable **por agente ya aprobado**. Al merge de `plt_inc`:

- **Solo append** de nuevos `agentes[]` en `grilla_aprobada` (misma transacción que merge de `agentes[]` editor).
- Agentes preexistentes (LOKITO/MOSTO): **sin** reescritura.

---

## 6. Fase 0 — Limpieza BD (sin compatibilidad atrás)

Script: [`scripts/fase0-rfc-plan-paralelo-cleanup.mjs`](../../scripts/fase0-rfc-plan-paralelo-cleanup.mjs)

| Paso | Acción |
|------|--------|
| 0a | Auditoría: HLg `activo===false`, `plt_*` con `eliminado:true` y `estado:HABILITADO`, refs `hlg_id` huérfanas |
| 0b | `--apply`: delete físico HLg deshabilitadas |
| 0c | `--apply`: quitar `agentes[]` que referencien HLg borradas |
| 0d | `--apply`: normalizar fantasmas → `estado:CERRADO` si `eliminado:true` |

**Evidencia 2026-06-04 Fase 0:** `--apply` — 15 HLg borradas, 3 fantasmas `CERRADO`, 3 planes purgados (21 ops).

**Evidencia 2026-06-04 Fase 1:** `fase1-migrate-plan-paralelo-schema.mjs --apply` — 2 `plt_*` test hard-deleted, 9 planes migrados (`plan_rol`, arrays denormalizados). Índices desplegados vía `firebase deploy --only firestore:indexes` (compuestos + `fieldOverrides` array-contains en `agentes_hlg_ids` / `agentes_persona_ids`).

---

## 7. Roadmap de implementación

| Fase | Contenido |
|------|-----------|
| **0** | Limpieza BD + este RFC — **hecho** (`fase0-rfc-plan-paralelo-cleanup.mjs`) |
| **1** | Schema, índices, `MERGEADO`, migración — **hecho** (`planTurnoServicioMeta.js`, `fase1-migrate-plan-paralelo-schema.mjs`, `firebase-v2/firestore.indexes.json`) |
| **2** | Backend `plt_inc` — **hecho**: `iniciarIncorporacionPlanMensual`, `guardar` en hijo, `aprobar` merge, `materializarGrupoMes({ personaIdsFilter })` |
| **3** | UI jefe + bandeja RRHH + banner dual |
| **4** | HLg inmutabilidad régimen, delete físico, `purgaAgentePlanesPorHlg` |
| **5** | Tests + criterios GSO |

---

## 8. Impacto GSO (resumen)

- Planificados pendientes de `plt_inc`: no son “fantasma” del habilitado; estado **pendiente incorporación**.
- Fijo/rotativo: teoría desde HLg aunque no estén en `agentes[]` del plan; aviso informativo, sin blanco si materialización OK.
- Celda blanca sigue siendo error P0 ([`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md)).

---

## 9. Brecha código actual (referencia)

- [`planesTurnoServicio.js`](../../functions/modules/asistencia/planesTurnoServicio.js): `modo_incorporacion_agentes_nuevos` muta el mismo doc y baja `HABILITADO` → `EN_REVISION`.
- [`planGrupoAgentesNuevos.js`](../../functions/modules/asistencia/planGrupoAgentesNuevos.js): merge y detección solo planificados — **se reutiliza** en hijo.
- [`grillaMesAgenteCore.js`](../../functions/modules/shared/grillaMesAgenteCore.js): `obtenerPlanHabilitadoCache` debe filtrar `plan_rol=principal` (Fase 1).
