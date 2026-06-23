# Épica B — Presentación materializada en motor (grilla GSO)

> **Estado:** EN CURSO — **B1/B2** iniciado **2026-06-23**  
> **Plan madre:** [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) fase **B**  
> **Gate piloto:** **Q2.4 ✅** (CHAPARRO d19 · prod)  
> **Tope movimientos:** [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md) — **post-B**

---

## Objetivo

La UI de grilla y `DiaGrillaDetalleModal` **leen** `vis_*` sin reconstruir turno desde heurísticas. El motor (`materializarTurnoTeoricoDia` → analítica) es la **única** fuente de:

- `tipo_dia` / `es_franco` / `rda_*` alineados a `capa_teorica_por_grupo`
- `presentacion_compuesto` **o ausencia explícita** (`FieldValue.delete()`)

---

## Contrato (SSoT)

| Regla | Implementación |
|-------|----------------|
| Franco / NL / sin segmentos | **No** `presentacion_compuesto` en `vis` |
| Compuesto M+T+N | `resolverPresentacionCompuestoCelda` vía `resolverPresentacionVisMaterializada` |
| Celda ctx analítica | `construirCeldaCtxTrasCapaMaterializada` — capa manda sobre `vis` stale |
| Filas vacías tras filtro teórico | `null` (no `turno_compuesto_id` huérfano) |

**Módulo:** `shared/utils/materializarPresentacionVisCelda.js` (sync → `functions/modules/shared/`).

**Cableado:**

- `validacionFichadaDiaPersistencia.ejecutarAnaliticaYValidacionFichadaDia`
- `rdaTurnoTeoricoWorker.persistirAnaliticaCumplimientoDia`

**Tests:** `functions/test/materializarPresentacionVisCelda.test.js`

---

## Tickets

| ID | Entrega | Estado |
|----|---------|--------|
| **B1** | Puerta motor + omitir presentación franco/saldo cero + filas vacías | ✅ código |
| **B2** | `construirCeldaCtxTrasCapaMaterializada` en persistencia | ✅ código |
| **B3** | Tests regresión traslado 3× origen franco (integración worker) | ⏳ |
| **B4** | Web: reducir `coherirPresentacionCompuestoAlTeoricoVis` a defensa opcional | ⏳ tras deploy B1–B2 |
| **B5** | Callable batch / CVC asume contrato; doc RFC filas celda | ⏳ |

---

## Deuda web (hasta B4)

Parches en `visCeldaFusionLectura.js` (`celdaVisTokenTeoricoSinSaldoOperativo`, etc.) siguen protegiendo celdas **no rematerializadas**. Tras B en prod, medir y recortar.

---

## Changelog

| Fecha | Nota |
|-------|------|
| 2026-06-23 | Inicio B1–B2 · Q2.4 cerrado |
