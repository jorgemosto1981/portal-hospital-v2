# RFC (borrador) — Tope de movimientos (límite blando) · gestión de turno

> **Estado:** ANÁLISIS — sin implementación en código (piloto grilla jun-2026).  
> **Relación:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) · [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) · handoff [`HANDOFF_SESION_2026-06-19_PAUSA_GRILLA_REACTIVIDAD.md`](./HANDOFF_SESION_2026-06-19_PAUSA_GRILLA_REACTIVIDAD.md)

---

## 1. Problema

Sin tope, la cadena de traslados e intercambios en el mismo mes (ida/vuelta, N luego M, etc.) genera **caos operativo** y bugs de supersession difíciles de auditar. Un límite blando fuerza intervención humana (RRHH) cuando la gestión del día/tramo deja de ser estable.

---

## 2. Propuesta piloto (límite blando)

| Concepto | Definición |
|----------|------------|
| **Unidad** | **Tramo** ejecutable (`segmento_id` / token de turno simple: M, T, N, …) — unidad mínima de negocio en turno compuesto M+T+N. |
| **Ámbito** | `persona_id` × `fecha_ymd` × `segmento_id` × `grupo_trabajo_id` (gdt). |
| **Tope** | **Máximo 2 movimientos** por tramo en ese ámbito (mes GSO abierto). |
| **Movimiento** | Un `aplicarBatchAsistencia` que **impacte** ese tramo en ese día (origen o destino). |

### 2.1 Cómo cuenta cada tipo de op

| Tipo batch | Conteo sugerido |
|------------|-----------------|
| **Traslado propio v2** | **+1** en cada día/tramo afectado: origen (segmento cedido) y destino (segmento incorporado). |
| **Intercambio guardia v2** | **+1** por agente y tramo involucrado en el intercambio (cada pierna del par bilateral). |
| **Reemplazo clásico / adicional** | Definir en implementación (¿1 por celda/día o por `turno_id`?). Piloto: priorizar traslado + intercambio. |

**Ida y vuelta** del mismo tramo en el mismo día puede consumir 2 movimientos; el **tercero** debe bloquearse.

---

## 3. Comportamiento en error

- **Código:** `[BATCH-LIM-001]` desde `cambiosTurno.js` **antes** de la transacción Firestore.
- **HTTP / callable:** `failed-precondition` (o `invalid-argument` alineado al resto BATCH-*).
- **Web:** toast: *«Superaste el límite de cambios operativos para este tramo. Solicitá una excepción a RRHH.»*

---

## 4. Arquitectura de implementación (futura)

### 4.1 Backend (autoridad)

1. Tras normalizar la op a ítems batch, derivar pares `(persona_id, fecha_ymd, segmento_id, gdt)`.
2. Para cada par, contar en `asistencia_diaria.overrides_turno` del mes:
   - entradas **activas** y **históricas no invalidadas** (`eliminado` / `supersedido` / `invalidado_por_replanificacion`) que hayan movido ese tramo;
   - criterio exacto a fijar en implementación (incl. `op_batch_id` para no duplicar piernas del mismo batch).
3. Si `conteo + delta_op > 2` → `err(..., '[BATCH-LIM-001] ...')`.

### 4.2 Excepción RRHH

- Flag en perfil/claims (ej. `puede_bypass_tope_movimientos_gestion_turno`) **solo RRHH**.
- Batch acepta header/context `bypass_tope_movimientos: true` si el token lo autoriza (auditoría obligatoria en override).

### 4.3 Frontend (preview)

- Misma función de conteo (callable ligero o duplicar lógica en preview) en modales A/B/C **antes** de enviar batch — evita frustración y round-trip.

---

## 5. Fuera de alcance (borrador)

- Límite por mes completo agregado (solo por día/tramo en piloto).
- Bloqueo duro sin vía RRHH.
- Migración de datos históricos (conteo solo hacia adelante o desde fecha corte).

---

## 6. Criterios de aceptación (cuando se implemente)

1. Tercer movimiento del mismo tramo/día/persona/gdt → batch rechazado con `[BATCH-LIM-001]`.
2. RRHH con bypass aplica cuarto movimiento y queda auditado.
3. Tests unitarios en `functions/test` con cadena N→franco→M y intercambio bilateral.
4. Documentación de conteo alineada a este RFC.

---

## 7. Changelog

| Fecha | Nota |
|-------|------|
| 2026-06-19 | Borrador incorporado desde propuesta piloto (sin código). |
