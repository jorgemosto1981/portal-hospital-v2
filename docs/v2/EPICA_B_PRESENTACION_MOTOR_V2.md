# Épica B — Presentación materializada en motor (grilla GSO)

> **Estado:** **B1–B2 CERRADOS EN PROD** — smoke encadenado **CHAPARRO d25→26** ✅ **2026-06-23** · **B4** siguiente  
> **Plan madre:** [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) fase **B**  
> **Gate piloto:** **Q2.4 ✅** · smoke post-B **CHAPARRO d25→d26** ✅ **2026-06-23** prod  
> **Tope movimientos:** [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md) — **post-B4**

---

## Objetivo

La UI de grilla y `DiaGrillaDetalleModal` **leen** `vis_*` sin reconstruir turno desde heurísticas. El motor (`materializarTurnoTeoricoDia` → analítica) es la **única** fuente de:

- `tipo_dia` / `es_franco` / `rda_*` alineados a `capa_teorica_por_grupo`
- `presentacion_compuesto` **o ausencia explícita** (`FieldValue.delete()`)

---

## Deploy producción

| Artefacto | Fecha | Ref |
|-----------|--------|-----|
| **Commit** | 2026-06-23 | `8edddac` — `feat(motor): consolidar presentacion compuesto en motor (epica B)` |
| **Functions** | 2026-06-23 | Deploy completo `southamerica-east1` (incl. `materializarTurnoTeoricoDia`, batch grilla) |
| **Hosting** | 2026-06-23 | https://portal-hospital-v2.web.app — bundle `index-KF2-9gyc.js` |
| **Remoto** | 2026-06-23 | `origin/master` = `8edddac` |

**Verificación ops (Jaqueline jun-2026):** `node scripts/verificar-jaqueline-dias-11-12-jun26.mjs` — d11 **franco**; d12 **laborable** con `rda_turno_id` dictado por motor (p. ej. `N`). El criterio antiguo T+N en el script estaba desactualizado.

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

## Guía de diagnóstico rápido (operaciones)

**¿La celda no coincide con lo que el supervisor cree que debería ser?**

1. Abrir el **modal del día** en la grilla.
2. Revisar **cambios de turno / overrides / solicitudes** activas en ese día (el motor procesa datos persistidos, no suposiciones).
3. Si el historial y la teoría en modal son coherentes pero la celda pinta distinto: **Ctrl+F5**, luego **«Actualizar ahora»** (rematerialización del día).
4. Si tras rematerializar sigue desalineado grilla ↔ modal: escalar a soporte con **captura**, **persona**, **día**, **`gdt_id`**, y **lote batch** si hubo gestión de turno.

---

## Mensaje breve para operaciones (piloto jun-2026)

Piloto grilla Sala Internación 1: presentación de celdas y franco tras traslados los define el **motor en servidor** (deploy `8edddac`). Usar hard refresh y «Actualizar ahora» antes de abrir ticket. Tope de movimientos: **sin implementar** (RFC en análisis, después de B4).

---

## Tickets

| ID | Entrega | Estado |
|----|---------|--------|
| **B1** | Puerta motor + omitir presentación franco/saldo cero + filas vacías | ✅ prod |
| **B2** | `construirCeldaCtxTrasCapaMaterializada` en persistencia | ✅ prod |
| **B3** | Tests regresión traslado 3× origen franco (integración worker) | ⏳ |
| **B4** | Web: recortar heurísticas (`celdaVisTokenTeorico…`, cadena `mergeCeldaVisParche`) | ✅ **2026-06-23** |
| **B5** | Callable batch / CVC asume contrato; doc RFC filas celda | ⏳ |

### Alcance B4 (cuando smoke verde)

| Archivo | Acción prevista |
|---------|-----------------|
| `shared/utils/visCeldaFusionLectura.js` | Retirar o acotar `celdaVisTokenTeoricoSinSaldoOperativo` si motor siempre limpia `vis` |
| `shared/utils/grillaMesNodos/mergeCeldaVisParche.js` | Evaluar si basta `coherirPresentacion…` en fetch CVC únicamente |
| `web/.../grillaTurnoTeoricoDesdeVis.js` | Confiar en `vis` materializado; mantener solo lectura |
| Tests web | Mantener regresión mínima franco/incorporar N |

**No tocar en B4:** filtro teórico en hot path grilla para M/T/N con fichadas (empareje por franja) — es UX, no sustituto de presentación motor.

---

## Cierre formal épica B (checklist)

- [x] B1–B2 en prod (functions + hosting)
- [x] Jaqueline d11/d12 rematerialización coherente con motor
- [x] **Smoke post-deploy** — CHAPARRO **25/06** → **26/06**: 3 traslados (M, T, N); origen **F** / franco; destino **M+T+N** `06:00–06:00`; grilla + modal OK sin F5
- [x] **B4** merge (limpieza web)
- [ ] **B3/B5** backlog opcional

**Firma B1–B2:** **2026-06-23** — evidencia operador MOSTO · lotes `6d8f1058…`, `2e43aace…`, `bbd6feaf…`

---

## Deuda web (post-B4)

Mantenido en cliente (traslados **parciales** / cache CVC): `coherirPresentacionCompuestoAlTeoricoVis`, `alinearFlagsTipoDiaAlTeoricoOperativo` en `mergeCeldaVisParche`. **Retirado:** inferencia franco por token sin filas (`celdaVisTokenTeoricoSinSaldoOperativo`).

---

## Changelog

| Fecha | Nota |
|-------|------|
| 2026-06-23 | Inicio B1–B2 · Q2.4 cerrado |
| 2026-06-23 | Deploy prod `8edddac` · guía ops · script Jaqueline alineado a motor |
| 2026-06-23 | Smoke CHAPARRO d25→26 post-B · cierre formal B1–B2 |
| 2026-06-23 | **B4** — limpieza heurísticas web (motor SSoT franco) |
