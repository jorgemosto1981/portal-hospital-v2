# Handoff — Pausa sesión 2026-06-16 (Fase F + QA teoría ↔ real)

> **Fecha pausa:** 2026-06-16  
> **Rama:** `feature/grilla-fase1-colision`  
> **Prod:** https://portal-hospital-v2.web.app  
> **RETOMAR:** **Continuamos revisando fichadas día por día de teoría vs real** — matriz [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md) · piloto **Sala Internación 1** · `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · **2026-06**.

---

## 1. Punto de continuación (copiar al abrir Agent)

```
Continuamos revisando fichadas día por día de teoría vs real en grilla piloto junio 2026
(Sala Internación 1). Rama feature/grilla-fase1-colision. Validar motor analitica_cumplimiento
+ validacion_fichada_dia + visual celda/modal vs MATRIZ_FICHADA_TEORIA_REAL_V2.md.
Handoff: docs/v2/HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md
```

---

## 2. Entregables de la sesión (código + BD)

| Entregable | Estado |
|------------|--------|
| Fase F: `validacion_fichada_dia` persistido, semáforo V/A/R, futuro gris | ✅ en rama (+ commits previos) |
| Motor por **segmentos** (M+N): tardanza/salida por tramo, sin salida falsa 960 min | ✅ `calcularDeltasCumplimiento.js` + tests |
| Celda: **dos badges ▼** por tramo (ej. ▼60m + ▼480m), sin chip agregado `-540m` | ✅ UI local; **verificar deploy hosting** en otra PC |
| `enriquecerIncumplimientoCeldaPorSegmento` → `incumplimiento_celda_*` por `segmento_id` | ✅ shared + sync functions |
| Alineación noche / carga manual (ingreso–egreso, roles ABM) | ✅ `fichadasAlineacionTeoria.js` |
| Fix borrar fichada (`Timestamp` en `fichadas_borradas`) | ✅ `fichadasCapaDiaCore.js` |
| Script backfill Fase F | ✅ `scripts/backfill_fase_f_validacion.mjs` · `npm run db:backfill-fase-f-validacion` |
| **Backfill ejecutado 2026-06-16** | ✅ 150 días mat · **120** celdas refrescadas · auditoría **V2 / A7 / R25** |
| Resumen cumplimiento jefe + alertas UI | ✅ archivos nuevos en `web/src/features/grilla/` |

---

## 3. Caso referencia QA (siguiente revisión manual)

| Agente | Día | Teoría | Real | Esperado celda (post-hosting) | Modal |
|--------|-----|--------|------|-------------------------------|-------|
| LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` | **14** | M+N (06–14 + 22–06) | 07:00–14:00 | **▼ 60m** (M tardanza) + **▼ 480m** (N ausente), **no** `-540m` | Déficit total 540m en bloque carga horaria (auditoría) |

**Motivo producto:** licencias futuras pueden cubrir solo un tramo (N) y dejar M como franquicia horaria — el motor ya separa por `segmentos_cumplimiento`.

**CHAPARRO junio Sala (M+T+N continuo):** días **13–15** revisados en grilla — ver tabla §3 casos verificados.

| Agente | Día | Teoría | Real | Esperado | QA |
|--------|-----|--------|------|----------|-----|
| CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` | **13** | M+T+N 06:00–06:00 | 06:38–05:35 | ▼38m tardanza | ✅ 2026-06-17 |
| CHAPARRO | **14** | idem | 06:35–05:40 | Modal ingreso tardío 35m; celda ▼35m | ✅ 2026-06-17 |
| CHAPARRO | **15** | idem | ABM 05:45–04:00 | ▼120m salida anticipada | ✅ 2026-06-17 |

---

## 4. Comandos útiles

```bash
git fetch origin
git checkout feature/grilla-fase1-colision
git pull origin feature/grilla-fase1-colision
npm install && npm install --prefix web

# Tests motor + UI grilla
node --test functions/test/calcularDeltasCumplimiento.test.js
npm run test --prefix web -- --run src/features/grilla/grillaAnaliticaCumplimientoUi.test.js

# Re-materializar mes piloto (credenciales .env.v2.local)
npm run db:backfill-fase-f-validacion

# Deploy si UI/functions locales no están en prod
npm run build:web
npm run firebase:deploy:functions   # según package.json del repo
firebase deploy --project portal-hospital-v2 --only hosting
```

---

## 5. Archivos clave tocados en sesión

| Área | Rutas |
|------|--------|
| Motor shared | `shared/utils/calcularDeltasCumplimiento.js`, `fichadasAlineacionTeoria.js`, `resolverValidacionFichadaDia.js` |
| Functions (sync) | `functions/modules/shared/*` espejo + `fichadasCapaDiaCore.js`, `rdaTurnoTeoricoWorker.js` |
| UI grilla | `grillaAnaliticaCumplimientoUi.js`, `DiaGrillaCelda.jsx`, modal auditoría, `resumenCumplimientoFichadaJefe.js` |
| Tests | `functions/test/calcularDeltasCumplimiento.test.js`, `grillaAnaliticaCumplimientoUi.test.js` |
| Ops | `scripts/backfill_fase_f_validacion.mjs`, `package.json` script `db:backfill-fase-f-validacion` |

---

## 6. Gate y épica bloqueada

- **No merge** a `master` hasta matriz §2–§3 crítica en verde (checklist origen [`HANDOFF_SESION_2026-06-12_PAUSA_QA_FICHADAS_COLISION.md`](./HANDOFF_SESION_2026-06-12_PAUSA_QA_FICHADAS_COLISION.md) §3).
- **Decreto 1919 / motor solicitudes:** ⏸ tras gate fichadas.

---

## 7. Referencias

- RFC Fase F: [`RFC_FASE_F_VALIDACION_FICHADA_GRILLA_V2.md`](./RFC_FASE_F_VALIDACION_FICHADA_GRILLA_V2.md)
- Índice continuidad: [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)
- Materialización al abrir equipo: [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md) (si existe en repo)

---

**Última actualización:** 2026-06-16 — pausa con commit + push remoto; siguiente sesión QA día a día teoría vs real.
