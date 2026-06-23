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
