# RFC — Fase 4 MVP: bandeja RRHH (solicitudes Patrón B)

**Estado:** implementado en código · **2026-05-19**  
**Plan:** [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md)

---

## 1. Objetivo

Gestionar solicitudes en `cfg_esa_en_revision_rrhh` (derivadas por jefe): **aprobar** → `cfg_esa_aprobada` o **rechazar** → `cfg_esa_rechazada` + reverso saldo Patrón B.

---

## 2. Seguridad

- Solo **`tokenHasRrhhLaborAccess`** (rol HLC RRHH en claims).
- Callables Admin SDK; sin `update` cliente en `solicitudes_articulo`.

---

## 3. Callables

| Callable | Rol |
|----------|-----|
| `listarSolicitudesBandejaRrhh` | Lista hasta 80 en `cfg_esa_en_revision_rrhh` |
| `resolverDecisionRrhhSolicitud` | `aprobar` \| `rechazar` + `motivo` opcional |

| Decisión | Estado | Saldo |
|----------|--------|-------|
| `aprobar` | `cfg_esa_aprobada` | Mantiene descuento al alta |
| `rechazar` | `cfg_esa_rechazada` | Reverso bolsa (`motor_reverso_rrhh_aplicado`) |

Auditoría: `rrhh_revision_persona_id`, `rrhh_revision_en`, `rrhh_motivo`.

Reverso compartido: `solicitudPatronBReversoSaldo.js` (mismo criterio que bandeja jefe).

---

## 4. UI

- Ruta: `/portal/rrhh/solicitudes-articulo` (dentro de `RoleGuard`)
- Menú RRHH: **Bandeja solic.**

---

## 5. Deploy

```powershell
firebase deploy --only "functions:listarSolicitudesBandejaRrhh,functions:resolverDecisionRrhhSolicitud"
```

Re-deploy opcional de jefe si se desplegó reverso compartido sin RRHH:

```powershell
firebase deploy --only "functions:resolverDecisionJefeSolicitud"
```

---

## 6. Pruebas (R1–R3)

| # | Caso |
|---|------|
| R1 | RRHH ve `sol_*` en `cfg_esa_en_revision_rrhh` (p. ej. post J2) |
| R2 | Aprobar → `cfg_esa_aprobada`, saldo sin cambio |
| R3 | Rechazar → `cfg_esa_rechazada` + bolsa restaurada |

Piloto: `sol_01KS0896610NA49M9G6VABMMEK` tras J2.
