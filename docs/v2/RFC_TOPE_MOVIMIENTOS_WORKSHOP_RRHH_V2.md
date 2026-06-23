# Workshop RRHH / jefe piloto — Tope de movimientos (gestión de turno)

> **Propósito:** cerrar decisiones de producto antes de implementar `[BATCH-LIM-001]`.  
> **RFC técnico:** [`RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md`](./RFC_BORRADOR_TOPE_MOVIMIENTOS_GESTION_TURNO_V2.md)  
> **Gate técnico cumplido:** Épica B (B1–B4) + smoke CHAPARRO d25→26 **2026-06-23**

---

## Agenda sugerida (30–45 min)

1. **Problema** — cadenas largas de traslados en el mismo mes (ida/vuelta, auditoría difícil).
2. **Propuesta piloto** — máx. **2 movimientos** por tramo × persona × día × gdt.
3. **Qué cuenta como movimiento** — traslado propio (origen + destino), intercambio (cada pierna).
4. **Excepciones** — ¿solo RRHH con bypass auditado? ¿jefe de sala en urgencia?
5. **Mensaje al usuario** — toast + derivación a RRHH.
6. **Fecha de corte** — conteo solo desde deploy del tope vs mes completo jun-2026.

---

## Decisiones a registrar (completar en reunión)

| # | Pregunta | Decisión | Fecha | Responsable |
|---|----------|----------|-------|-------------|
| D1 | ¿Tope = **2** movimientos por tramo/día/gdt? | ☐ Sí ☐ No → valor: ___ | | |
| D2 | ¿Bloqueo **duro** (batch rechazado) o advertencia con confirmación? | ☐ Duro ☐ Blando | | |
| D3 | ¿Bypass solo **RRHH** o también rol jefe piloto? | | | |
| D4 | ¿Intercambio cuenta **2** (uno por agente/tramo) o **1** por par? | | | |
| D5 | ¿Adicional / reemplazo clásico entra en el tope en v1? | ☐ No ☐ Sí | | |
| D6 | Conteo desde **fecha deploy** o **inicio mes GSO** abierto | | | |

---

## Preguntas resolutivas (llevar a la reunión)

Objetivo: salir con **D1–D6 completas** en ≤45 min. No abrir debate de implementación en la sala.

1. **D2 primero (bloqueo vs alerta):** ¿El tercer movimiento del **mismo tramo en el mismo día** debe **imposibilitar** guardar el batch, o solo mostrar advertencia y permitir confirmar con motivo?
2. **D1 (número):** ¿Confirmamos **2** como tope? ¿Aplica igual a **M**, **T** y **N** por separado en un día M+T+N?
3. **D4 (intercambio):** Swap LOKITO↔CHAPARRO un tramo: ¿son **2** movimientos (uno por agente en ese tramo) o **1** operación compartida?
4. **D3 (bypass):** ¿Quién puede autorizar un 3.er/4.º movimiento: solo RRHH, o jefe de sala con registro auditado?
5. **D6 (corte):** ¿Contamos solo batches **desde el deploy del tope**, o todo jun-2026 ya ejecutado entra al historial del contador?
6. **D5 (alcance v1):** ¿Excluimos **adicional** y **reemplazo clásico** del tope en la primera versión? (recomendación técnica: **sí**, solo traslado v2 + intercambio).

---

## Anexo técnico — casuísticas que el motor ya maneja (pre-workshop)

Usar para validar que **D1–D6** no generen falsos positivos con el comportamiento real post–Épica B.

| Caso | Comportamiento motor / piloto | Implicación para el tope |
|------|------------------------------|---------------------------|
| **Traslados encadenados mismo origen** (CHAPARRO d25→26: M, T, N en 3 batches) | Cada batch mueve **un tramo**; origen queda franco al vaciar el día | ¿**+1 por tramo** en origen (M, T, N) = 3 contadores distintos, o un solo “día origen”? RFC propone **por tramo** en ese día. |
| **Traslado parcial** (solo M a otro día; quedan T+N) | Origen sigue laborable; destino aditivo | **+1** en M origen y **+1** en M destino; T/N no cuentan hasta moverse. |
| **Cadena N→franco→M mismo día** (CAMPOS d10/d12) | Supersession revoca franco al incorporar M | Tope debe contar **movimientos**, no “estado final”; ¿el 3.er batch del **mismo tramo N** en el mismo día debe bloquear? |
| **Intercambio bilateral** (swap T↔N d8) | Cada agente cede y recibe un tramo | Alinear **D4**: típicamente **+1** por agente × tramo cedido/recibido en ese día. |
| **Ida y vuelta mismo tramo mismo día** | 2 batches consumen cupo del tramo | Con tope 2, el **3.er** debe disparar **D2** (bloqueo o alerta). |
| **Bypass RRHH** | No existe aún | **D3:** sin bypass, operación queda bloqueada; con bypass, `op_batch_id` + flag auditado. |

**Hueco a cerrar con RRHH:** si el tope es por **tramo×día**, un día M+T+N permite hasta **6** movimientos de traslado (2×M + 2×T + 2×N) antes de bloquear cualquiera — ¿es la intención operativa, o buscan tope **por día** agregado (más restrictivo, fuera del borrador actual)?

---

## Tras el workshop

1. Volcar decisiones en §8 del RFC borrador.
2. Implementar backend `cambiosTurno.js` + tests (cadena N→franco→M, intercambio).
3. Preview en modales gestión turno (opcional v1.1).
4. Piloto Sala jun-2026 — observar rechazos `[BATCH-LIM-001]` una semana antes de generalizar.

---

## Criterios de éxito piloto

- Ningún rechazo en movimientos **claramente legítimos** (falso positivo).
- Tercer movimiento abusivo en el mismo tramo/día **bloqueado** con mensaje claro.
- Bypass RRHH deja rastro en override / consulta gestión turno.
