# Handoff — Cierre 2026-06-17 (análisis carga horaria · grilla M/T/N · dual badges · pausa)

> **Fecha:** 2026-06-17  
> **Piloto QA:** Sala Internación 1 `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · período **jun-2026**  
> **Rama:** `feature/grilla-fase1-colision`  
> **Estado:** **PAUSA** — código + tests + documental listos; push remoto para continuar desde otra PC.

---

## 1. Punto de continuación (próxima sesión)

```
RETOMAR AQUÍ — prioridad inmediata:

1) Ver cambio de día (turnos nocturnos / cruce medianoche T+N / M+T+N): ¿anda bien en grilla y motor?
   — Auditar fichadas con fecha_egreso_ymd distinta; segmentos con egreso_iso en día siguiente.
   — Agentes piloto con N: CHAPARRO días 13–16; casos LOKITO d10 (M+T una fichada).

2) Auditar piloto jun-2026 tras dual badges:
   — CAMPOS d8 (M+T): ▼ 2h 15m + ▼ 1h 30m en M; T AUSENTE.
   — Backfill opcional para persistir badges[] en presentacion_compuesto (UI reconcilia desde analítica).

3) Verificar si el plan de hoy (sesión 2026-06-17) está completado:
   — RFC análisis carga F1–F4 ✅
   — Render M/T/N + reconciliación estado_tramo ✅
   — Dual badge tardanza+salida mismo tramo ✅
   — Split marcas M+T una fichada (LOKITO/CAMPOS) ✅
   — Test T+N análogo CAMPOS d8 ✅
   — Bandeja «Auditoría diaria del sector» eliminada ✅
   — Pendiente: QA cambio de día + merge/deploy cuando matriz en verde

Handoff: docs/v2/HANDOFF_SESION_2026-06-17_CIERRE_ANALISIS_CARGA_GRILLA_V2.md
RFC carga: docs/v2/RFC_ANALISIS_CARGA_HORARIA_TOTAL_REGIMEN_V2.md
RFC filas: docs/v2/RFC_CUMPLIMIENTO_TURNO_COMPUESTO_FILAS_CELDA.md
Matriz QA: docs/v2/MATRIZ_FICHADA_TEORIA_REAL_V2.md
```

```bash
git pull origin feature/grilla-fase1-colision
node scripts/sync-shared-to-functions.mjs
node --test functions/test/calcularDeltasCumplimiento.test.js functions/test/resolverPresentacionCompuestoCelda.test.js
npm run test --prefix web -- grillaPresentacionCompuestoUi.test.js grillaAnaliticaCumplimientoUi.test.js
npm run db:backfill-fase-f-validacion -- --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06
```

---

## 2. Entregables de la sesión (completo)

| Bloque | Estado | Notas |
|--------|--------|-------|
| **RFC análisis carga horaria** F1–F4 (schema, motor, UI, backfill piloto) | ✅ | `RFC_ANALISIS_CARGA_HORARIA_TOTAL_REGIMEN_V2.md` |
| **Fix render N amarillo** (reconciliación `estado_tramo` desde analítica) | ✅ | `grillaPresentacionCompuestoUi.js` |
| **Dual badge** tardanza + salida en mismo tramo (dim A) | ✅ | CAMPOS d8 M+T; motor + UI + modal |
| **Split marcas** una fichada en compuesto (ingreso primer tramo / egreso último) | ✅ | LOKITO d10, CAMPOS d5 |
| **T+N análogo CAMPOS d8** (tests motor + UI) | ✅ | Requiere ISO segmento T con `+1d` en egreso |
| **Backfill piloto jun-2026** (ronda 1) | ✅ | 150 días mat., 68 celdas vis |
| **Eliminar bandeja «Auditoría diaria del sector»** | ✅ | Auditoría en grilla + modal día |

---

## 3. Separación dimensiones (contrato cerrado)

| Dimensión | Parámetros | Efecto en grilla M/T/N |
|-----------|------------|------------------------|
| **A — Disciplina** | `tolerancia_ingreso/egreso` por turno M/T/N | Color piso + badges ▲/▼ por tramo (puede haber **varios** badges por fila) |
| **B — Carga total** | `analisis_carga_horaria_total_habilitado` + `tolerancia_debitohorario_minutos` | Semáforo jefe + modal; **no** badge ni color por tramo |

**Campos nuevos en segmento analítica:** `incumplimiento_celda_tardanza_minutos`, `incumplimiento_celda_salida_minutos`.  
**Presentación:** `filas[].badges[]` (array); reconciliación en lectura desde analítica si materializado viejo.

---

## 4. Casos QA de referencia

| Agente | Día | Turno | Escenario |
|--------|-----|-------|-----------|
| CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` | 13–16 | M+T+N | N verde salvo d15 `▼ 2h` |
| CAMPOS `per_01KR3GZX9TB33NHTE2QD5ZP13V` | 8 | M+T | Fichada 08:15–12:30 → M dual badge; T ausente |
| CAMPOS | 5 | M+T | Sin egreso duplicado en fila M |
| LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` | 10 | M+T | Una fichada → ingreso M / egreso T |

**T+N (sintético, tests):** fichada 16:15–20:30 → T `▼ 2h 15m` + `▼ 1h 30m`; N AUSENTE. Mismo comportamiento que M+T si segmentos cruzan medianoche con ISO correcto.

---

## 5. Backfill ejecutado (2026-06-17, ronda 1)

```bash
npm run db:backfill-fase-f-validacion -- --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06
```

| Métrica | Valor |
|---------|-------|
| Días materializados | 150 |
| Celdas refrescadas (1b) | 68 |
| Agentes vis_* | 4 |

**Nota:** tras dual badges, conviene **re-ejecutar backfill** en próxima sesión para persistir `badges[]` en Firestore (la UI ya reconcilia en lectura).

---

## 6. Archivos clave (código)

| Área | Ruta |
|------|------|
| Motor dim A/B + dual badge | `shared/utils/calcularDeltasCumplimiento.js` |
| Presentación celda + `badges[]` | `shared/utils/resolverPresentacionCompuestoCelda.js` |
| UI pisos M/T/N + marcas split | `web/src/features/grilla/grillaPresentacionCompuestoUi.js` |
| Render filas | `web/src/features/grilla/GrillaPresentacionCompuestoFilas.jsx` |
| Modal analítica | `web/src/features/grilla/grillaAnaliticaCumplimientoUi.js` |
| Grilla equipo | `web/src/features/grilla/GrillaMesEquipoTabla.jsx` |
| Backfill | `scripts/backfill_fase_f_validacion.mjs` |

**Eliminados:** `GrillaRrhhBandejaAuditoriaDiaria.jsx`, `grillaAuditoriaDiariaResumen.js` (+ tests).

---

## 7. Tests

```bash
node scripts/sync-shared-to-functions.mjs
node --test functions/test/calcularDeltasCumplimiento.test.js functions/test/resolverPresentacionCompuestoCelda.test.js
npm run test --prefix web -- grillaPresentacionCompuestoUi.test.js grillaAnaliticaCumplimientoUi.test.js grillaOperativaCapabilities.test.js
```

Cobertura relevante: `M+T un tramo: persiste tardanza y salida…`, `T+N un tramo: tardanza y salida…`, `M+T CAMPOS d8`, `T+N análogo CAMPOS d8`, `M+T una fichada: ingreso en M y egreso en T`.

---

## 8. Pendiente próxima sesión — **supersedido por cierre 2026-06-18**

- [x] **Cambio de día / medianoche:** fixes + QA operativo piloto.
- [x] **Auditar piloto** jun-2026 tras dual badges.
- [x] **Plan del día completado** (tabla §2).
- [ ] Backfill ronda 2 (opcional, persistir `badges[]`).
- [x] Deploy functions + hosting.
- [x] Merge a `master` (`f43f7e1`).

---

## 9. Cierre operativo 2026-06-18

| Ítem | Valor |
|------|--------|
| **Git** | `master` @ `f43f7e1` · rama `feature/grilla-fase1-colision` alineada |
| **Prod** | Functions + hosting desplegados · https://portal-hospital-v2.web.app |
| **Extra sesión 18/06** | UI IDs opacos (`orden`, MA/TN simple), slate fallback, `persona_id` overrides, UX sticky/outbox/persona |
| **SSoT continuación** | [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) — RETOMAR backlog / épica 1919 |

*Fin handoff — épica piloto presentación compuesto jun-2026 **cerrada**. Origen pausa 2026-06-17.*
