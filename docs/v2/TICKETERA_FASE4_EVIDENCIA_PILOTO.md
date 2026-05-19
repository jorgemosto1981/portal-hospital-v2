# Ticketera Fase 4 — Evidencia piloto bandeja RRHH

**Fecha:** 2026-05-19  
**Operador RRHH:** DNI **28914247** · `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`

---

## R2 — Aprobar definitivo (OK)

| Campo | Valor |
|-------|--------|
| Solicitud piloto | `sol_01KS0896610NA49M9G6VABMMEK` (cadena J2 → RRHH) |
| UI | Toast «Solicitud aprobada (definitiva).» |
| Estado esperado | `cfg_esa_aprobada` |
| Campos auditoría esperados | `rrhh_revision_persona_id`, `rrhh_revision_en`, `rrhh_motivo` (opcional) |
| Saldo | Sin reverso; `motor_descuento_aplicado` permanece `true` |

**Verificación Firestore:** `solicitudes_articulo/sol_01KS0896610NA49M9G6VABMMEK` → `estado_solicitud_id` = `cfg_esa_aprobada`.

**Nota de producto (pendiente):** en este piloto hubo **dos clics «Aprobar»** (jefe luego RRHH). Ver análisis en [`HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md`](./HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md) § 4 — revisar si RRHH debe ser *toma de conocimiento* y no segunda aprobación.

---

## R1 / R3

| ID | Estado |
|----|--------|
| R1 | Implícito OK (lista + selección previa a R2) |
| R3 | Pendiente (rechazo RRHH + reverso en otra `sol_*`) |
