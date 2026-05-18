# Backlog — Check-in de saldos RRHH (patrones A/B/C)

**Relación:** [`HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md`](./HANDOFF_SESION_2026-05-18_CHECKIN_SALDOS.md) · [`RFC_LAO_CHECKIN_SALDOS_V2.md`](./RFC_LAO_CHECKIN_SALDOS_V2.md) · [`RFC_SALDOS_PATRONES_ABC_V2.md`](./RFC_SALDOS_PATRONES_ABC_V2.md) · [`FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md`](./FLUJO_ONBOARDING_RRHH_ALTA_AGENTE_V2.md)

**Estimación:** **S** ≈ hasta medio día · **M** ≈ 1–2 días · **L** ≈ 3+ días o varios frentes.

**Ruta web:** `/portal/rrhh/checkin-saldos` (legado `/portal/rrhh/lao-checkin` → misma página).

> **PAUSA (2026-05-18):** Oleada 1 hecha; epic **sin cerrar**. Próxima sesión: avisar que hay que **terminar la tarea** — ver [`HANDOFF_SESION_2026-05-18_PAUSA_ALTA_CHECKIN.md`](./HANDOFF_SESION_2026-05-18_PAUSA_ALTA_CHECKIN.md).

---

## Decisiones registradas (producto)

| ID | Decisión | Estado |
|----|----------|--------|
| 16 | `anio_corte_portal_a` en persona se escribe en **guardados parciales** (LAO, B, C) y en **cierre global** — comportamiento actual; revisar en oleada producto si debe quedar solo en cierre. | Documentado |
| 17 | En la **guía de alta RRHH**, el paso check-in “Listo” exige **`checkin_saldos_portal_en`** (cierre global), no solo LAO parcial. | Documentado |
| 18 | El **cierre global** no garantiza que estén cargadas todas las bolsas B/C ni LAO; es cierre administrativo del portal para la persona. | Documentado |

---

## Alta prioridad (correctitud y operación)

| # | Tarea | Est. | Estado |
|---|--------|------|--------|
| 1 | Validar **días enteros** en Patrón A (FE `validateCheckinFilas` + inputs) | S | Oleada 1 |
| 2 | Validar **días enteros** en Patrón B (FE `validateCheckinEstandar` + inputs) | S | Oleada 1 |
| 3 | Definir regla de **cierre global**: advertencia en modal o bloqueo con checklist mínimo | M | Pendiente |
| 4 | **Guardado Patrón B/C**: evitar estado a medias (batch / transacción / rollback UI) | L | Pendiente |
| 5 | **Deprecar** `cerrarCheckinSaldosPortal` (un contrato canónico `cerrarCheckinGlobal`) | S | Oleada 1 |
| 6 | Corregir **mensajes de error** (`callableMessage`) → `cerrarCheckinGlobal` | S | Oleada 1 |
| 7 | **Check-in nuevo**: validar HLc operativo en servidor (≥1 vigente) | M | Pendiente |

---

## Media prioridad (UX, claridad, escala)

| # | Tarea | Est. | Estado |
|---|--------|------|--------|
| 8 | **Patrón C**: copy/UI saldo vacío (= no informado / 0) y **saldo negativo** | S | Oleada 1 |
| 9 | Pestañas B/C: listado artículos con `metaError` / sin patrón | M | Pendiente |
| 10 | **Precarga**: filtrar en `obtenerSaldosCheckinPersona` o acotar payload | M | Pendiente |
| 11 | **Toast precarga**: solo si hubo datos precargados (no en cada reentrada) | S | Oleada 1 |
| 12 | **Combobox personas**: búsqueda server-side o paginación (check-in + guía alta) | L | Pendiente |
| 13 | **Cache** `fetchArticuloCheckinMeta(artId, anioA)` por sesión | M | Pendiente |
| 14 | **Guía alta**: tracker sin listar colecciones completas por persona | M | Pendiente |
| 15 | Renombrar cliente `callCerrarCheckinGlobal` (+ alias deprecado del nombre viejo) | S | Oleada 1 |

---

## Baja prioridad (deuda técnica y calidad)

| # | Tarea | Est. | Estado |
|---|--------|------|--------|
| 19 | Eliminar carpeta legacy **`web/src/features/laoCheckin/`** (ruta legada sigue en página unificada) | S | Oleada 1 |
| 20 | Una sola copia de **`checkinFilasUtils`** (solo `checkinSaldos/`) | S | Oleada 1 |
| 21 | Refactor `useCheckinSaldosPage` en hooks más chicos | L | Pendiente |
| 22 | Tests unitarios: validadores, precarga, patrón, onboarding | M | Pendiente |
| 23 | Ampliar smoke `lao-smoke-checkin-bolsas.mjs` (B/C / rectificación) | M | Pendiente |
| 24 | `obtenerSaldosCheckinPersona`: revisar campos expuestos | S | Pendiente |
| 25 | **`persona_id` en URL**: no pisar selección manual del operador | S | Oleada 1 |

---

## Resumen por tamaño

| Tamaño | Cantidad | IDs |
|--------|----------|-----|
| **S** | 14 | 1, 2, 5, 6, 8, 11, 15, 16–18 (doc), 19, 20, 24, 25 |
| **M** | 7 | 3, 7, 9, 10, 13, 14, 22, 23 |
| **L** | 3 | 4, 12, 21 |

---

## Orden sugerido (sprints)

### Oleada 1 — rápida (~2–3 días)

1, 2, 5, 6, 8, 11, 15, 19, 20, 25 + decisiones 16–18.

### Oleada 2 — operación sólida (~1 semana)

3, 7, 9, 10, 13, 14, 22.

### Oleada 3 — escala y deuda

4, 12, 21, 23.

---

## Registro de implementación

| Fecha | Oleada | Notas |
|-------|--------|--------|
| 2026-05-18 | 1 | Backlog creado. Implementado: enteros A/B (FE+BE parcial), copy C, toast precarga acotado, `callCerrarCheckinGlobal`, mensaje IAM, sync URL persona sin pisar selección manual, eliminación `laoCheckin/` legacy, deprecación `cerrarCheckinSaldosPortal` en Functions. Índice en `docs/v2/README.md`, enlace en handoff y flujo onboarding. |
