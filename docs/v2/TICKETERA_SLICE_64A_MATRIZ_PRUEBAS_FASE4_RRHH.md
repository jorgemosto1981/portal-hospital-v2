# Matriz pruebas — Fase 4 bandeja RRHH (MVP)

| ID | Precondición | Acción | Esperado |
|----|--------------|--------|----------|
| R1 | `sol_*` en `cfg_esa_en_revision_rrhh` | Abrir `/portal/rrhh/solicitudes-articulo` | Aparece en lista |
| R2 | R1 | Aprobar | `cfg_esa_aprobada`; saldo consumido se mantiene | **OK** | `sol_01KS0896610NA49M9G6VABMMEK` · 28914247 — 2026-05-19 |
| R3 | Otra pendiente RRHH | Rechazar | `cfg_esa_rechazada`; `motor_reverso_rrhh_aplicado`; bolsa OK |

**Deploy:** `listarSolicitudesBandejaRrhh`, `resolverDecisionRrhhSolicitud`.
