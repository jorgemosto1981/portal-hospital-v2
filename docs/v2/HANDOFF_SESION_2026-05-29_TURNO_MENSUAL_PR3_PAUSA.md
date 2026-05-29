---
fecha: 2026-05-29
branch: feat/epic-turno-mensual-fase2-pr3
epic_base: feat/epic-turnos-compuestos-v2
retomar_aqui: true
pausa_implementacion: true
---

# Handoff — Pausa post PR3 (Fase 2 UI VER + impresión)

**RETOMAR AQUÍ** en la próxima sesión (otra PC: `git pull` de esta rama).

## Punto de pausa (29/05/2026)

Implementación **detenida justo después de validar PR3 en producción**. PR3 está **implementado en rama local** y documentado; **siguiente trabajo = merge a épica + PR4 (GSO)**.

| Ítem | Valor |
|------|--------|
| **Rama de trabajo** | `feat/epic-turno-mensual-fase2-pr3` (desde `feat/epic-turnos-compuestos-v2`) |
| **Último commit épica (base)** | `cbe14d3` — Fase 1 PR2 (grilla desde foto, materialización) |
| **PR3** | Cambios en working tree → commit `feat(turnos): Fase 2 UI VER plan + impresión` (este handoff) |
| **Producción** | https://portal-hospital-v2.web.app |
| **Deploy 29/05** | Functions + Hosting (incl. `obtenerVistaPlanTurnoServicio` enrich) |

### Planes piloto QA

| Plan | Período | Uso |
|------|---------|-----|
| `plt_01KSSPY2H5EZA925FQP4S1G2XW` | **2026-06** | Épica junio — foto + comentarios + re-aprobación PR2; **PR3 UI validado** (Explorador VER, Detalle Grilla, Jefe detalle) |
| `plt_01KSR8J55H1TN10M3ANSSWMPF2` | 2026-05 | Mayo — matriz B1–B4 VER también validada en prod |

**Grupo:** Sala Internación 1 — `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`

---

## Entregado en PR3 (Fase 2 UI)

### Backend

- `obtenerVistaPlanTurnoServicio`: `comentarios_jefe`, `agentes_meta` (batch personas), `historial_aprobaciones` con nombre actor, `turno_etiquetas` (desde regímenes del plan).
- Helpers: `loadPersonaDocsMap`, `loadTurnoEtiquetasPorRegimenes` en `planesTurnoServicio.js`.

### Frontend

- `planGrillaCeldaDisplay.js` — presentación celda (dos líneas turno + horario; `shared` `horarioInstitucionalDisplay`).
- `PlanGrillaVerContenido.jsx` — encabezado, comentarios, tabla, **Imprimir / Exportar** (`window.print` + `planGrillaPrint.css`).
- `PlanGrillaAprobadaTable.jsx` — celdas estilo editor.
- `PlanGrillaVistaModal.jsx`, `useVistaPlanTurno.js`, `ExploradorTurnosRrhhPage.jsx`, `PlanTurnoServicioPage.jsx`.

### Documentación

- Plan maestro Cursor: sección **Deuda técnica / Known issues** — fijos sin `turno_id` → `segmentos: []`, `fichadas_esperadas: 0` (resolver en Épica R2 Biometría).

### QA matriz B (vistas turno) — validado en prod 29/05

| # | Pantalla | Estado |
|---|----------|--------|
| B1 | Explorador → VER | OK |
| B2 | Explorador → Detalle → Grilla | OK |
| B3 | Bandeja → Ver turno | Mismo modal (confirmar si no se probó explícitamente) |
| B4 | Jefe → Planes turno → detalle | OK (`comentarios_jefe`, grilla, historial nombres, imprimir) |

---

## Hecho antes de PR3 (épica, ya en `cbe14d3` / deploy previo)

- **PR1 Fase 0:** foto teórica en borrador, `comentarios_jefe`, `plan_version_token`, PLT-MAX-050.
- **PR2 Fase 1:** `horarioInstitucionalDisplay`, `grilla_aprobada` desde foto al aprobar, materialización/RDA HH:mm AR, atomicidad HABILITADO.

---

## NO iniciado (próxima sesión)

| PR | Contenido |
|----|-----------|
| **Merge** | `feat/epic-turno-mensual-fase2-pr3` → `feat/epic-turnos-compuestos-v2` |
| **PR4** | Fase 3 GSO: `GrillaMesEquipoTabla`, titular, modal día; ruta RRHH `/portal/rrhh/grilla-operativa` |
| **PR5** | R1/R2 RBAC + biométrico |
| **Fase 5 E2E** | Matriz C (grilla operativa jun-2026) + smoke fichadas |
| **Pulido opcional** | Doble encabezado en modal VER; `display_linea1/2` en snapshot al aprobar (hoy formatter en web) |

---

## Comandos al retomar (otra PC)

```bash
git fetch origin
git checkout feat/epic-turno-mensual-fase2-pr3
git pull origin feat/epic-turno-mensual-fase2-pr3
```

Deploy solo si hubo cambios locales post-pull:

```bash
npm run firebase:deploy:functions
cd web && npm run build && cd .. && firebase deploy --project portal-hospital-v2 --only hosting
```

Plan maestro (Cursor): `turno_mensual_jun-2026_371c6708.plan.md` en `.cursor/plans/`.

---

## Archivos clave PR3

| Área | Archivo |
|------|---------|
| Callable vista | `functions/modules/asistencia/planesTurnoServicio.js` |
| Display celda | `web/src/features/planes/planGrillaCeldaDisplay.js` |
| Contenedor VER + print | `web/src/features/planes/PlanGrillaVerContenido.jsx` |
| Modal VER | `web/src/features/planes/PlanGrillaVistaModal.jsx` |
| Hook | `web/src/features/planes/useVistaPlanTurno.js` |
| Índice pendientes | `docs/v2/PENDIENTES_PROXIMA_SESION.md` |

---

## Transcript sesión

`agent-transcripts/66101908-684b-4729-b70e-21c8234918f3/66101908-684b-4729-b70e-21c8234918f3.jsonl`
