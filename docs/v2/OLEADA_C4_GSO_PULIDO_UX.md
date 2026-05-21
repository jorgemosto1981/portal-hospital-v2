# Oleada C4 — Pulido UX calendario licencias (GSO)

**Estado:** implementado · **2026-05-21**  
**Deploy:** solo hosting (sin cambios MDC/functions).

## Entregables

| Ítem | Implementación |
|------|----------------|
| Tooltip hover | `GrillaMesCeldaLicencia` + `lineasTooltipCelda` (código, estado, `sol_id` corto, persona en tabla) |
| Contraste pendiente vs aprobado | `estiloVisualCelda`: pendiente = `#F59E0B` + borde punteado ámbar oscuro; aprobado = `#3B82F6` + borde sólido y texto claro |
| Leyenda | Bloque “piedra rosetta” en `GrillaMesLicenciasPanel` alineado a tokens MDC |

## Cierre épica Grilla licencias MDC

Slices **C1** (mes agente), **C3** (detalle día), **C2c/d** (selector + equipo), **C4** (pulido) — smoke prod en [`OLEADA_C_SMOKE_HOSTING_2026-05-21_C2C_C2D.md`](./OLEADA_C_SMOKE_HOSTING_2026-05-21_C2C_C2D.md).

---

*Siguiente fuera de esta épica: otras vistas GSO / planificación RDA según arquitectura maestra.*
