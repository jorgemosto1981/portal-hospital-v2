# RFC — Tope de movimientos (límite blando) · gestión de turno

> **Estado:** **RATIFICADO RRHH** (2026-06-23) · `[BATCH-LIM-001]` en prod — vigencia **2026-07-01 00:00 ART**  
> **Gate técnico:** ✅ Épica B (B1–B4) · [`EPICA_B_PRESENTACION_MOTOR_V2.md`](./EPICA_B_PRESENTACION_MOTOR_V2.md)  
> **Workshop:** [`RFC_TOPE_MOVIMIENTOS_WORKSHOP_RRHH_V2.md`](./RFC_TOPE_MOVIMIENTOS_WORKSHOP_RRHH_V2.md)  
> **Relación:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) · [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md)

---

## 1. Problema

Sin tope, la cadena de traslados e intercambios en el mismo mes genera **caos operativo** y bugs de supersession difíciles de auditar. Un límite **duro** con bypass auditado fuerza intervención humana cuando un tramo/día supera la norma operativa.

---

## 2. Propuesta piloto (acordada D0–D7)

| Concepto | Definición |
|----------|------------|
| **Unidad (D0)** | **Tramo** × `persona_id` × `fecha_ymd` × `grupo_trabajo_id` — no tope agregado por día. |
| **Tope (D1)** | **Máximo 2 movimientos** por unidad en el mes GSO abierto. |
| **Movimiento** | Un `aplicarBatchAsistencia` que impacte ese tramo en ese día (origen o destino). |
| **Alcance v1 (D5)** | Solo **traslado propio v2** e **intercambio guardia v2**. |

### 2.1 Conteo por tipo de op

| Tipo batch | Conteo |
|------------|--------|
| **Traslado propio v2** | **+1** por cada par `(persona, fecha, segmento_canon, gdt)` en origen (cedido) y en destino (incorporado). |
| **Intercambio guardia v2 (D4)** | **+1** por agente y tramo involucrado en ese día (**2** en un swap bilateral típico). |
| **Adicional / reemplazo clásico** | **No cuenta** en v1. |

**Ida y vuelta** del mismo tramo en el mismo día consume 2; el **3.º** → rechazo (D2).

---

## 3. Comportamiento en error (D2, D7)

- **Código:** `[BATCH-LIM-001]` en `cambiosTurno.js` **antes** de la transacción Firestore.
- **Callable:** `failed-precondition` (alineado a BATCH-*).
- **Web (toast):** *«Límite de movimientos excedido para este tramo (máx. 2 por día). Contacte a RRHH para solicitar una excepción.»*

---

## 4. Bypass (D3)

- Perfiles: **solo RRHH** (`tokenHasRrhhLaborAccess`).
- Batch: `bypass_tope_movimientos: true` + **motivo obligatorio** en contexto; persistir en override / `registrarConsultaGestionTurnoGrilla`.
- Sin bypass válido → D2 duro.

---

## 5. Historial (D6)

- Contar solo overrides con `creado_en` **≥ `tope_movimientos_vigente_desde`**.
- **Ratificado:** `2026-07-01T03:00:00.000Z` (1 jul 2026 00:00 ART). Sin retroactivo jun-2026 QA.

---

## 6. Decisiones de producto — cerradas

| ID | Decisión |
|----|----------|
| D0 | Por **tramo** × día × persona × gdt |
| D1 | **2** movimientos |
| D2 | **Bloqueo duro** |
| D3 | Bypass **solo RRHH** (auditado) |
| D4 | Intercambio: **+1 por agente/tramo** |
| D5 | v1: **traslado v2 + intercambio** solamente |
| D6 | Conteo desde **2026-07-01 00:00 ART** |
| D7 | Mensaje §3 |

Ratificación formal RRHH: **2026-06-23** (ver workshop).

---

## 7. Criterios de aceptación

1. 3.er movimiento del mismo tramo/día/persona/gdt (sin bypass) → `[BATCH-LIM-001]`.
2. CHAPARRO d25→26 (M, T, N distintos) **no** bloquea al 3.er batch si cada tramo lleva ≤2 movimientos.
3. Bypass **solo RRHH** permite 3.er+ con auditoría.
4. Tests: ida/vuelta mismo tramo; intercambio +2; cadena N→franco→M (conteo por movimiento).
5. Adicional/reemplazo **no** incrementa contador en v1.

---

## 8. Fuera de alcance v1

- Tope agregado por día (D0-B).
- Advertencia blanda sin rechazo (D2 blando).
- Conteo retroactivo mes completo (D6 alternativa).
- Límite por mes acumulado.

---

## 9. Implementación `[BATCH-LIM-001]` (esqueleto)

### 9.1 Módulo puro (testeable)

- **Archivo:** `shared/utils/topeMovimientosGestionTurno.js` → sync functions.
- **`derivarIncrementosTopeDesdeBatchOp(op, gdt)`** → lista `{ persona_id, fecha_ymd, segmento_id_canon, delta }`.
- **`contarMovimientosTramoDia({ overridesMes, persona_id, fecha_ymd, segmento_id, gdt, vigenteDesde })`** → número.
- **`evaluarTopeMovimientosBatch({ ops, overridesMes, gdt, vigenteDesde, tope = 2, bypass })`** → `{ ok, violaciones[] }`.

Reglas: canonicalizar segmento como en `rdaTurnoTeoricoWorker`; **no duplicar** piernas del mismo `op_batch_id` al contar un batch ya persistido.

### 9.2 Integración backend

- **Hook:** en `cambiosTurno.js`, tras normalizar batch, **antes** de transacción:
  - si `bypass_tope_movimientos` y claim válido → skip con log auditoría;
  - si no → `evaluarTopeMovimientosBatch`; si falla → `err('failed-precondition', '[BATCH-LIM-001] ...')`.
- **Fuente datos:** `overrides_turno` del mes en `asistencia_diaria` (Firestore, no SQL); filtrar activos + histórico válido según supersession.

### 9.3 Config

- `tope_movimientos_vigente_desde` — ISO timestamp fijado en deploy (o `cfg_*` si se prefiere ops).

### 9.4 Web (v1.0 mínimo)

- Toast mapeado a `[BATCH-LIM-001]`.
- v1.1: preview en modales gestión turno (callable o lógica compartida).

### 9.5 Tests

- `functions/test/topeMovimientosGestionTurno.test.js` — casos D4, ida/vuelta, d25 patrón 3 tramos, bypass mock.

---

## 10. Changelog

| Fecha | Nota |
|-------|------|
| 2026-06-19 | Borrador inicial. |
| 2026-06-23 | Gate B4; workshop agenda. |
| 2026-06-23 | **Ratificación RRHH**; D3 solo RRHH; D6 = 2026-07-01 ART. |
