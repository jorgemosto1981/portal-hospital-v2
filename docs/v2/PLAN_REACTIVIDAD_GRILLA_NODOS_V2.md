# Plan — Reactividad por nodo (grilla operativa GSO)

> **Estado:** EN CURSO — supersession + ciclo UI 2026-06-19 · reset piloto jun-2026 · **tope movimientos** en RFC borrador  
> Handoff sesión: [`HANDOFF_SESION_2026-06-19_PAUSA_GRILLA_REACTIVIDAD.md`](./HANDOFF_SESION_2026-06-19_PAUSA_GRILLA_REACTIVIDAD.md)  
> Handoff intercambio: [`HANDOFF_SESION_2026-06-18_PAUSA_INTERCAMBIO_GUARDIA.md`](./HANDOFF_SESION_2026-06-18_PAUSA_INTERCAMBIO_GUARDIA.md)  
> **Prioridad UX:** impacto visible **sin salir del modal de mes** · reemplaza el modelo anterior de **outbox local** (cola + “aplicar después”).  
> **Piloto:** Sala Internación 1 `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · jun-2026 · Jaqueline `per_01KR3GZX9TB33NHTE2QD5ZP13V`.

---

## Objetivo

Cada celda/fila de la grilla es un **nodo** con snapshot de servidor + parches locales tras mutaciones (batch, fichada). La UI reacciona por `CellKey` sin recargar todo el mes salvo cuando haga falta.

---

## Fases

| Fase | Contenido | Estado |
|------|-----------|--------|
| **A0** | Contrato `CellKey` / `RowKey` + `nodosAfectadosPorOp` | ✅ |
| **A1** | `grillaMesNodoStore` (base + overlay + índice ops) | ✅ |
| **A2** | `GrillaDiaCelda` memo + `useGrillaMesNodos` | ✅ parcial |
| **A3** | Batch inmediato: `aplicarCambioInmediato` → `aplicarBatchAsistencia` + `grillaMesNodosBatchParches` | ✅ |
| **B** | Render anclado a `presentacion_compuesto` materializado; estado incompleto explícito | ⏳ en curso |
| **C** | Patch cache/store post-batch y post-fichada; reducir `invalidateGrillaGrupoPeriodo` / `vista.cargar` | ✅ parcial 2026-06-18 |
| **D** | Virtualización filas + RFC rendimiento | ⏳ |

---

## Motor servidor (alineado al plan)

| Pieza | Rol |
|-------|-----|
| `materializarTurnoTeoricoDia` | Único motor diario (mes batch delega aquí) |
| `computarCapaTeoricaSliceDia` | Cómputo sin persistir (firmas / oráculo) |
| `sanearMaterializacionDiaSiNecesario` | Callable oráculo + auto-sanación materialización |
| Traslado propio v2 | Origen franco / quita segmentos / destino aditivo |

**Sin compatibilidad hacia atrás** en datos viciados: no es obligatorio borrar overrides históricos; **en adelante** el motor debe materializar bien.

---

## Archivos núcleo (web)

- `shared/utils/grillaMesNodos/*` — store e impacto
- `web/src/features/grilla/useGrillaMesNodos.js`
- `web/src/features/grilla/grillaMesNodosBatchParches.js`
- `web/src/features/grilla/grillaAplicarCambioInmediato.js`
- `web/src/features/grilla/GrillaDiaCelda.jsx` · `grillaMesEquipoCeldaContenido.jsx`
- `web/src/features/grilla/useAutoSanacionDiaGrillaModal.js`
- `web/src/features/grilla/GrillaMesLicenciasPanel.jsx`

## Archivos núcleo (functions)

- `functions/modules/asistencia/rdaTurnoTeoricoWorker.js`
- `functions/modules/asistencia/cambiosTurno.js` (`aplicarBatchAsistencia`, `sanearMaterializacionDiaSiNecesario`)
- `shared/utils/grillaMaterializacionFirmaDia.js` (sync → functions)

---

## Scripts QA / ops (dev)

```bash
# Reset overrides gestión turno del mes (Sala jun-2026)
node scripts/sanear-invalidar-overrides-grilla-gdt-mes.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06
ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-invalidar-overrides-grilla-gdt-mes.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06 --apply

node scripts/verificar-jaqueline-dias-11-12-jun26.mjs
node scripts/debug-jaqueline-overrides-jun26.mjs
```

Esperado tras motor actual (Jaqueline): **día 11 franco**, **día 12 `T+N`**.

## Backlog intercambio guardia

| Ítem | Estado |
|------|--------|
| Materialización: excluir tramos cedidos de `turno_compuesto_id` / `segmentos[]` persistidos | ✅ 2026-06-19 (`filtrarSegmentosMaterializadosOperativos`) |
| Validación exclusividad: no recibir tramo que ya conservás + sin solape horario post-swap | ✅ 2026-06-19 (`intercambioGuardiaExclusividad` UI + `[BATCH-A007]`) |
| `upsertSegmento` por `segmento_id`+titular | Solo defensivo (no sustituye validación) |
| Supersession piernas opuestas + cadena N/M | ✅ 2026-06-19 (`overridesTurnoSupersession.js`, `rdaTurnoTeoricoWorker.js`) |
| Ciclo UI FIN_BLOQUEO vs POST sanación | ✅ 2026-06-19 (`grillaCicloAplicarCambioInmediato.js`) |
| Tope 2 movimientos / tramo / día | 📋 [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md) |
