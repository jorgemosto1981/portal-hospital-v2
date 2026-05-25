# Oleada C — Slice 2: GSO vista mes por grupo (C2)

**Estado:** backend + grilla multipersona **implementados** · bandeja combobox **pendiente (C2c)** · **2026-05-21**  
**Hoja de ruta producto:** [`OLEADA_C2_HOJA_RUTA_GSO_EQUIPO.md`](./OLEADA_C2_HOJA_RUTA_GSO_EQUIPO.md) (`obtenerVistaGrillaEquipo` = alias de negocio de `listarVistaGrillaMesPorGrupo`).  
**Base:** Slice 1 (`obtenerVistaGrillaMesAgente`) + MDC `vis_*` por persona.

## Objetivo

Matriz **personas × días** para un `gdt_*` en un mes: integrantes con HLg vigente al **último día del mes**, hasta **60** personas por consulta. Misma semántica de celda que el calendario individual (color/código desde MDC, borde punteado si revisión).

## Entregables

| Capa | Entregable |
|------|------------|
| Core | `listarVistaGrillaMesPorGrupo` en `grillaMesAgenteCore.js` |
| Callable | `listarVistaGrillaMesPorGrupo` |
| Web | Subpestaña **Por grupo (C2)** en calendario licencias · `GrillaMesGrupoPanel.jsx` |
| UX compartida | `DiaGrillaDetalleModal` + `grillaMesCellUtils.js` |

## Labels resumen (C3+)

Callable `obtenerResumenSolicitudArticuloGrilla` expone `jefe_revision_label` y `rrhh_toma_conocimiento_label`; el modal muestra nombre legible en lugar de `per_*`.

## Prueba sugerida

- Grupo piloto: `gdt_01KR3H81ENQK84ZK21EQWEQQXG`
- Mes **2026-03** · fila `per_01KR3HD…` · día **21** `64-A` · clic → resumen con nombres en cierre jefe / TC RRHH.

## Límites

- Sin paginación ni export CSV en este slice.
- Sin filtro por subgrupo ni rol dentro del GDT.

---

*Siguiente: C4 (leyenda/tooltip) o ampliar escala C2.*
