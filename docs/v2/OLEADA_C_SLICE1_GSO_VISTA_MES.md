# Oleada C — Slice 1: GSO lee `vis_*` (calendario mes agente)

**Estado:** en implementación · **2026-05-21**  
**Base:** MDC Oleada B ya escribe `vistas_grilla_mes_agente` · evidencia [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md)

## Objetivo del slice

Consumir en UI la vista mensual **`vis_<YYYY>_<MM>_per_<ULID>`** sin recalcular veredictos en cliente: colores y `codigo_grilla` vienen de `dias[dd].eventos[]` (fan-out MDC).

## Fuera de este slice

- Planificación mensual rotativa (épica P del anexo RDA).
- `recalcularVeredicto` completo, fichadas, permutas, drawer auditoría completo.
- Sustituir el read-model laboral de `/portal/grilla` (se mantiene en pestaña aparte).

## Entregables Slice 1

| Capa | Entregable |
|------|------------|
| Backend | Callable `obtenerVistaGrillaMesAgente` |
| Web | Pestaña «Calendario licencias» en `GrillaOperativa.jsx` |
| Prueba | Titular `per_01KR3HD…` · mes **2026-03** · día **21** con `64-A` y `#3B82F6` |

## Slice 1b — C3 (UX detalle día) ✅

| Capa | Entregable |
|------|------------|
| Callable | `obtenerResumenSolicitudArticuloGrilla` |
| UI | Clic día → modal resumen + **Ver solicitud en bandeja** (`?sol_id=`) |
| Bandejas | Deep link `sol_id` en jefe y RRHH |

## Slice 2 — C2 (grupo + mes)

Backend + tabla multipersona ✅ · selector «Mi equipo» 🔲 — ver [`OLEADA_C2_HOJA_RUTA_GSO_EQUIPO.md`](./OLEADA_C2_HOJA_RUTA_GSO_EQUIPO.md) y [`OLEADA_C_SLICE2_GSO_VISTA_GRUPO.md`](./OLEADA_C_SLICE2_GSO_VISTA_GRUPO.md).

## Próximos slices C

| Slice | Contenido |
|-------|-----------|
| C4 | ✅ [`OLEADA_C4_GSO_PULIDO_UX.md`](./OLEADA_C4_GSO_PULIDO_UX.md) — tooltip + contraste + leyenda |

---

*Arquitectura: [`ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md`](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md) §5.*
