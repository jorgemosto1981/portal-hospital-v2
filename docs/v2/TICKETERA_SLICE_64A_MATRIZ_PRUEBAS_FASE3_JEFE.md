# Matriz pruebas — Fase 3 bandeja jefe (MVP)

| ID | Precondición | Acción | Esperado |
|----|--------------|--------|----------|
| J1 | `sol_*` en `cfg_esa_en_revision_jefe`; jefe HLg mismo GT, nivel menor que titular | Abrir `/portal/jefe/solicitudes` | Aparece la solicitud |
| J2 | J1 | Aprobar | `estado_solicitud_id` = `cfg_esa_en_revision_rrhh`; campos `jefe_revision_*` | **OK** | `sol_01KS0896610NA49M9G6VABMMEK` · revisor DNI **28914247** — 2026-05-19 |
| J3 | Otra `sol_*` pendiente | Rechazar + motivo | `cfg_esa_rechazada`; bolsa Patrón B revertida si `motor_descuento_aplicado` | **OK** | 64-B · reverso en doc + **saldos_articulo_agente** verificado en BD — 2026-05-19 |
| J4 | Usuario jefe sin subordinados en HLg | Listar bandeja | Lista vacía, sin error |
| J5 | Usuario RRHH (`CFG_RRHH`) | Listar | Ve todas las pendientes (no solo subordinados) |
| J6 | Titular de la solicitud | Intentar aprobar propia (callable) | Error permiso |

**Deploy previo:** `listarSolicitudesBandejaJefe`, `resolverDecisionJefeSolicitud`.
