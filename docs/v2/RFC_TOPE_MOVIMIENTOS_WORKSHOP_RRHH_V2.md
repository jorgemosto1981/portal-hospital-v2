# Workshop RRHH / jefe piloto — Tope de movimientos (gestión de turno)

> **Propósito:** cerrar decisiones de producto antes de implementar `[BATCH-LIM-001]`.  
> **RFC técnico:** [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md)  
> **Gate técnico:** ✅ Épica B (B1–B4) + smoke CHAPARRO d25→26 **2026-06-23**  
> **Estado decisiones:** ✅ **Cerradas (simulacro piloto técnico 2026-06-23)** — ratificar con RRHH formal si aplica.

---

## Decisiones registradas

| # | Pregunta | Decisión | Notas |
|---|----------|----------|--------|
| **D0** | Unidad de conteo | **A — por tramo × día × persona × gdt** | M+T+N = tres cupos independientes (hasta 2 movimientos por M, por T, por N). |
| **D1** | Número máximo | **2** | Piloto Sala; 1 corrección + 1 cambio justificado; 3.º bloqueado. |
| **D2** | Superar tope | **Duro** — batch rechazado, sin advertencia blanda | `[BATCH-LIM-001]` pre-transacción. |
| **D3** | Bypass | **RRHH + jefe de sala** (motivo auditado, `op_batch_id`) | Claim/capability + flag en contexto batch. |
| **D4** | Intercambio guardia | **+1 por agente y tramo** en el batch (= **2** incrementos en un swap bilateral típico) | No colapsar a +1 global. |
| **D5** | Alcance v1 | **Solo traslado propio v2 + intercambio guardia v2** | Fuera: adicional, reemplazo clásico. |
| **D6** | Historial contador | **Desde fecha deploy del tope** | No retroactivo sobre QA jun-2026 previo. |
| **D7** | Mensaje usuario | Ver RFC §3 | Menciona RRHH y jefe de sala. |

**Responsable simulacro:** decisor técnico piloto · **Fecha:** 2026-06-23.

---

## Mensaje usuario (D7)

*«Límite de movimientos excedido para este tramo (máx. 2 por día). Contacte a RRHH o Jefe de Sala para una excepción.»*

---

## Agenda (referencia reunión RRHH)

1. Problema — cadenas largas de traslados en el mes.
2. Validar tabla D0–D7 (especialmente D0 tramo vs día y D6 no retroactivo).
3. Bypass y auditoría (D3).
4. Fecha de activación en prod (D6 → constante `tope_movimientos_vigente_desde`).

---

## Anexo técnico — casuísticas (validadas con D0-A)

| Caso | Con D0-A + D1=2 |
|------|------------------|
| CHAPARRO d25→26 (M, T, N en 3 batches) | Tres tramos → cada uno +1 en origen; **no** bloquea al 3.er batch si son tramos distintos. |
| Ida y vuelta **mismo tramo** mismo día | 3.er movimiento de **ese** tramo → **D2 duro**. |
| Intercambio bilateral | **D4:** +1 contador por persona/tramo afectado en ese día. |
| Cadena N→franco→M mismo día | Cuenta **movimientos** en historial overrides, no estado final franco. |

---

## Tras ratificación RRHH

1. Volcar en §6 del RFC borrador (hecho en repo).
2. Implementar `BATCH-LIM-001` — ver RFC §9.
3. Piloto: observar rechazos una semana antes de ampliar ámbito.

---

## Criterios de éxito piloto

- Sin falsos positivos en traslados legítimos (parcial, d25→26).
- 3.er movimiento del **mismo tramo/día** bloqueado con mensaje D7.
- Bypass jefe/RRHH auditado en override o consulta gestión turno.
