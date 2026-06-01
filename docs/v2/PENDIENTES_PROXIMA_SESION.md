# Punto de Continuación — Próxima Sesión

**Última actualización**: Viernes 29 Mayo 2026  
**RETOMAR AQUÍ**: [`HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md`](./HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md)

**Mapa E2E (HLG → turnos → materialización → GSO):** [`ANALISIS_INTEGRAL_HLG_TURNOS_MATERIALIZACION_GSO.md`](./ANALISIS_INTEGRAL_HLG_TURNOS_MATERIALIZACION_GSO.md)

| Campo | Valor |
|-------|--------|
| **Branch trabajo** | `feat/epic-turno-mensual-fase2-pr3` |
| **Épica base** | `feat/epic-turnos-compuestos-v2` |
| **Estado PR3** | Implementado + QA prod OK — **pausa antes de merge PR4** |
| **Producción** | https://portal-hospital-v2.web.app |
| **Plan piloto junio** | `plt_01KSSPY2H5EZA925FQP4S1G2XW` (2026-06, HABILITADO, comentarios jefe) |
| **Plan piloto mayo** | `plt_01KSR8J55H1TN10M3ANSSWMPF2` (2026-05, VER validado) |

---

## Objetivo principal próxima sesión

1. **Merge** rama `feat/epic-turno-mensual-fase2-pr3` en `feat/epic-turnos-compuestos-v2` (o PR en GitHub).
2. **PR4 — Fase 3 GSO:** horarios `rda_*` legibles + menú/ruta RRHH `/portal/rrhh/grilla-operativa`.
3. Continuar matriz **C** (grilla operativa jun-2026) y smoke fichadas (Fase 5D) según plan maestro.

Handoff anterior (28/05): [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md)

---

## Hecho hasta la pausa (29/05)

### PR1 + PR2 (en épica `cbe14d3`, deploy functions)

- Foto teórica en borrador, comentarios jefe, token concurrencia, max 50 agentes.
- `grilla_aprobada` desde foto; materialización/RDA; sin `slice` UTC en display.

### PR3 (rama `feat/epic-turno-mensual-fase2-pr3`, deploy 29/05)

- Vistas VER unificadas (Explorador, Detalle Grilla, Jefe detalle; Bandeja = mismo modal).
- `obtenerVistaPlanTurnoServicio`: enrich personas, historial, `turno_etiquetas`, `comentarios_jefe`.
- Imprimir nativo (`window.print`).
- Known issue documentado: fijos sin `turno_id` → sin segmentos en snapshot.

---

## Pendientes priorizados

### Alta (retomar)

1. Merge PR3 → épica.
2. PR4 GSO + ruta RRHH grilla operativa.
3. Matriz C: `vis_*` / `asi_*` jun-2026 vs plan (`plt_01KSSPY2…`).

### Media

4. Confirmar Bandeja → Ver turno (B3) si falta tick explícito.
5. Pulido UX: encabezado duplicado modal VER.
6. `display_linea1/2` en builder al aprobar (opcional; hoy formatter web).

### Baja

7. Épica R2 biométrico + segmentos “fantasma” fijos.
8. Code splitting bundle > 500KB.

---

## Archivos clave

| Área | Archivo |
|------|---------|
| Handoff pausa | `docs/v2/HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md` |
| RFC snapshot | `docs/v2/RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md` |
| Callables plan | `functions/modules/asistencia/planesTurnoServicio.js` |
| Display VER | `web/src/features/planes/planGrillaCeldaDisplay.js` |
| Print + tabla | `web/src/features/planes/PlanGrillaVerContenido.jsx` |
