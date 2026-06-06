---
name: Plan paralelo incorporación y ciclo HLg
status: aprobado-producto
fase_implementacion: "Fases 0–5 cerradas (jun 2026) — ver §7"
piloto: "Sala junio 2026 (gdt_01KQA6QCA8TDQK9YBTHKYA4R2V)"
---

# RFC — Planes paralelos de incorporación y ciclo de vida HLg (V2)

## 1. Contexto y principios rectores

Brecha detectada: al **incorporar** agentes en un mes ya **HABILITADO**, el código actual pasa el **mismo** `plt_*` a `EN_REVISION`, degradando la operación de la dotación ya aprobada (LOKITO/MOSTO en piloto Sala).

Principios:

1. **HLg anulada = borrado lógico permanente (compliance):** las asignaciones dadas de baja por error de carga o anulación RRHH **no se eliminan físicamente** del datastore. El documento `hlg_*` permanece con `eliminado: true`, `estado: ANULADO`, `activo: false`, más **`evt_*` obligatorio** antes del cierre lógico. Los lectores operativos (solape, materialización, planes) **ignoran** HLg anuladas. *La Fase 0 ejecutó un saneamiento puntual con delete físico de legado; no es el flujo productivo a futuro.*
2. **Inmutabilidad de HLg vigente:** prohibido cambiar `regimen_horario_id` o `grupo_de_trabajo_id` en una fila existente (`VAL-HLG-018`, `VAL-HLG-IMM-002`). Cambio de régimen o grupo = **cerrar** HLg (`fecha_fin`) + **alta nueva** HLg.
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

### 3.1 Anulación HLg (`rrhhEliminarHlgAnulada`)

Orden **inamovible**:

1. **Purga planes** (`purgaAgentePlanesPorHlg`, modo `anulacion`) en transacción. Si falla → **no** se toca la HLg.
2. **`evt_*`** (`accion: anular_hlg`). Si falla auditoría → **no** se anula la HLg.
3. **Soft delete** en `hlg_*`: `eliminado: true`, `estado: ANULADO`, `activo: false`, metadatos `anulado_en` / `anulado_motivo`.
4. **Capa teórica:** `purgeCapaTeoricaGdtRango` + `materializarRango` **solo** `persona_id` afectada (sin `materializarGrupoMes` del grupo).

**Planes:** query `agentes_hlg_ids` `array-contains`. Purga selectiva del bloque en `agentes[]` y arrays denormalizados. Si `agentes[]` queda vacío → `plt_*` con `eliminado: true` (y `HABILITADO` → `CERRADO` si aplica).

### 3.2 Cierre HLg (adelanto `fecha_fin`)

- Planes de **meses posteriores** al corte: purga selectiva del agente (como eliminación).
- Plan del **mes de corte:** mantener agente en `agentes[]` pero **truncar** `dias` desde el día posterior al corte.
- **Materialización:** `purgeCapaTeoricaGdtRango` / `materializarRango` por persona; **no** `materializarGrupoMes` completo del grupo.

### 3.3 Cambio de régimen

No existe como edición. Flujo: cierre HLg vieja → nueva HLg → si planificado y mes con principal habilitado → `plt_inc`.

### 3.4 Atomicidad y límite de transacción

- Transacción Firestore en purga de planes: si falla cualquier `plt_*`, **no** se deshabilita ni anula la HLg.
- **Límite operativo:** máx. **450** writes por transacción de purga (`PLT-PURGE-002`). Si una HLg referencia más planes que el límite, el callable **aborta antes** de mutar la HLg y devuelve `plan_ids` afectados para intervención RRHH (purga asistida por lotes o revisión de datos). *No hay purga parcial silenciosa.*
- **Deshabilitar HLg** (`rrhhDeshabilitarHlg`): misma purga previa (modo `cierre_hlg`), luego `activo: false` + materialización acotada por persona.

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

## 6. Fase 0 — Saneamiento one-shot (histórico, no flujo productivo)

Script: [`scripts/fase0-rfc-plan-paralelo-cleanup.mjs`](../../scripts/fase0-rfc-plan-paralelo-cleanup.mjs). Ejecutado **una vez** para legado previo al RFC (jun 2026). Incluyó delete físico de HLg `activo:false` acumuladas en piloto.

**A partir de Fase 4**, toda baja/anulación operativa usa **soft delete + `evt_*` + purga** (§3.1). No re-ejecutar delete físico de HLg en producción salvo script de migración explícito y aprobado.

**Evidencia 2026-06-04 Fase 0:** 15 HLg legado purgadas físicamente, 3 `plt_*` fantasmas → `CERRADO`, 3 planes depurados.

**Evidencia 2026-06-04 Fase 1:** `fase1-migrate-plan-paralelo-schema.mjs --apply` — 2 `plt_*` test hard-deleted, 9 planes migrados (`plan_rol`, arrays denormalizados). Índices desplegados vía `firebase deploy --only firestore:indexes` (compuestos + `fieldOverrides` array-contains en `agentes_hlg_ids` / `agentes_persona_ids`).

---

## 7. Roadmap de implementación

| Fase | Contenido |
|------|-----------|
| **0** | Limpieza BD + este RFC — **hecho** (`fase0-rfc-plan-paralelo-cleanup.mjs`) |
| **1** | Schema, índices, `MERGEADO`, migración — **hecho** (`planTurnoServicioMeta.js`, `fase1-migrate-plan-paralelo-schema.mjs`, `firebase-v2/firestore.indexes.json`) |
| **2** | Backend `plt_inc` — **hecho**: `iniciarIncorporacionPlanMensual`, `guardar` en hijo, `aprobar` merge, `materializarGrupoMes({ personaIdsFilter })` |
| **3** | UI jefe + bandeja RRHH + banner dual — **hecho** |
| **4** | HLg inmutabilidad régimen/grupo, `purgaAgentePlanesPorHlg`, `rrhhEliminarHlgAnulada`, integración `rrhhDeshabilitarHlg` — **hecho** |
| **5** | Deploy hosting, checklist E2E incorporación + purga HLg, criterios GSO §6.7, manual ayuda — **hecho** (jun 2026) |

---

## 8. Impacto GSO (resumen)

- Planificados pendientes de `plt_inc`: no son “fantasma” del habilitado; estado **pendiente incorporación**.
- Fijo/rotativo: teoría desde HLg aunque no estén en `agentes[]` del plan; aviso informativo, sin blanco si materialización OK.
- Celda blanca sigue siendo error P0 ([`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md)).

---

## 9. Implementación (referencia código)

- [`purgaAgentePlanesPorHlg.js`](../../functions/modules/asistencia/purgaAgentePlanesPorHlg.js) — purga transaccional por `agentes_hlg_ids`.
- [`catalogosLaborales.js`](../../functions/modules/catalogosLaborales.js) — `rrhhEliminarHlgAnulada`, `rrhhDeshabilitarHlg` + purga previa.
- [`catalogosShared.js`](../../functions/modules/catalogosShared.js) — `VAL-HLG-018`, `VAL-HLG-IMM-002`.
