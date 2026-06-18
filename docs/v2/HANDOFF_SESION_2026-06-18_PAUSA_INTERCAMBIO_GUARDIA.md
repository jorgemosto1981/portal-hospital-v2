# Handoff — Pausa 2026-06-18 · intercambio de guardia (A-BATCH v2)

> **Fecha cierre:** 2026-06-18 (noche)  
> **Rama:** `master` (commit + push al cerrar sesión)  
> **Piloto:** Sala Internación 1 `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · jun-2026  
> **Estado:** **PAUSA** — intercambio sigue roto en QA manual pese a fixes parciales.

---

## 1. Punto de continuación (obligatorio — próxima sesión)

```
maldito intercambio de guardia no anda
```

**Traducción técnica (retomar aquí):**

1. **Caso QA que falló al cerrar sesión:** LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` **d8** (2026-06-08) turno **M+T** ↔ CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` (27667499) **d8** turno **M+N** — swap **M ↔ N** (8 h ↔ 8 h, equilibrado en modal).
2. **Esperado post-batch:** LOKITO d8 ≈ **T+N** (cede M, recibe N); CHAPARRO d8 ≈ **M+T** o **M** propio + **T** recibido según contrato; grilla + modal coherentes sin F5.
3. **Observado:** LOKITO d8 queda **M+T+N** todo **AUSENTE**; CHAPARRO d8 sigue **M+N AUSENTE** (captura usuario 2026-06-18).
4. **Auditar end-to-end:** `aplicarBatchAsistencia` → `rematerializarBatchOps` → `buildSegmentosPreCoberturaEnDia` → `dias_actualizados` → store `confirmarBatchTrasExito` → `GrillaDiaCelda` merge.
5. **Scripts útiles:**
   - `node scripts/audit-grilla-fantasma-presente-jun26.mjs`
   - `node scripts/_tmp-inspect-intercambio-d17.mjs` (adaptar fecha/agentes)
   - `node scripts/sanear-reset-lokito-campos-d17-plano-m-jun26.mjs` (sanación puntual)

**Primera acción mañana:**

```bash
git pull origin master
# Inspeccionar asi_* + vis_* LOKITO y CHAPARRO 2026-06-08 tras último batch fallido
# Comparar capa_teorica_por_grupo[gdt] vs rda_turno_id en vis
```

---

## 2. Hecho en esta extensión de sesión (antes de pausa)

| Área | Entregable |
|------|------------|
| **Functions deploy** | `buildSegmentosPreCoberturaEnDia`, orden remat origen→destino, `aplicarBatchAsistencia` |
| **Hosting deploy** | Merge celda store, fix modal "Presente" fantasma, parches Fase C |
| **Reset QA d17** | LOKITO + CAMPOS → M limpio (`sanear-reset-lokito-campos-d17-plano-m-jun26.mjs`) |
| **UI modal** | `DiaGrillaAuditoriaCumplimientoHorario` — no usar `horarioReal` como proxy de presencia |
| **Fase C parches** | `mergeCeldaVisParche` — no pisar `fichadas_reales` si parche no trae clave |
| **Grilla merge** | `grillaDiaCeldaMerge.js` — store gana sobre fallback post-batch |
| **Preview intercambio** | `grillaCoberturaParcialPreview`, inferencia fichadas, filtro tramos cedidos |
| **Audit** | 13 celdas con "Presente" fantasma (compuesto + sin marcas) — bug UI identificado |

---

## 3. Hipótesis abiertas (intercambio)

| # | Hipótesis | Dónde mirar |
|---|-----------|-------------|
| H1 | Materialización peer no incorpora segmentos del par (M de origen en destino) | `rdaTurnoTeoricoWorker.js` `aplicarCoberturaParcialV2EnDia`, `buildSegmentosPreCoberturaEnDia` |
| H2 | Parche batch / store pisa celda con teoría vieja o incompleta | `diasActualizadosDesdeParesRematerializacion`, `mergeCeldaVisParche`, `grillaDiaCeldaMerge` |
| H3 | UI muestra 3 tramos (M+T+N) por no invalidar presentación/analítica previa | `presentacion_compuesto`, `reconciliarFilasPresentacionDesdeAnalitica` |
| H4 | `dias_actualizados` del callable no incluye todos los pares del swap bilateral | `rematerializarBatchOps`, `paresRematerializacionBatchItem` |
| H5 | Claves planas vs nested en `vis_*` — fusión deja `rda_turno_id` stale | `visCeldaFusionLectura.js`, `aplicarAnaliticaValidacionVisDia` purga planas |

---

## 4. IDs de referencia

| Agente | persona_id |
|--------|------------|
| LOKITO | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` |
| CAMPOS | `per_01KR3GZX9TB33NHTE2QD5ZP13V` |
| CHAPARRO | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` (DNI 27667499) |
| GDT Sala Internación 1 | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |

**Fechas QA:** d8 (LOKITO↔CHAPARRO swap M↔N), d17 (LOKITO↔CAMPOS — reset a M).

---

## 5. Plan activo

[`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) — Fase C parcial; **bloqueante:** intercambio guardia A-BATCH v2.

Handoff anterior (misma jornada, batch/nodos): [`HANDOFF_SESION_2026-06-18_PAUSA_BATCH_SANACION_NODOS.md`](./HANDOFF_SESION_2026-06-18_PAUSA_BATCH_SANACION_NODOS.md).

---

## 6. Comandos

```bash
npm run test --prefix web -- --run grillaMesNodosBatchParches grillaDiaCeldaMerge
npm run test:batch-asistencia-normalize
node scripts/audit-grilla-fantasma-presente-jun26.mjs
npm run firebase:deploy:functions   # si hubo cambios backend sin deploy
npm run build:web && npx firebase deploy --project portal-hospital-v2 --only hosting
```
