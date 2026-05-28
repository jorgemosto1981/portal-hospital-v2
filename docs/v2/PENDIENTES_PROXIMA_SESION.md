# Punto de Continuación — Próxima Sesión

**Última actualización**: Jueves 28 Mayo 2026  
**RETOMAR AQUÍ**: [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md)

| Campo | Valor |
|-------|--------|
| **Branch** | `feat/epic-turnos-compuestos-v2` |
| **Último commit** | `730b4b9` — unifica VER plan en todas las pantallas |
| **Tags** | `v2-pre-grilla-aprobada-plt`, `v2-grilla-aprobada-plt` |
| **Producción** | https://portal-hospital-v2.web.app |
| **Plan piloto** | `plt_01KSR8J55H1TN10M3ANSSWMPF2` (Sala Internación 1, 2026-05, HABILITADO) |

---

## Objetivo principal próxima sesión

**CONTROL ESTE TURNO EN TODAS LAS PANTALLAS DE VISTA, IMPACTO DE DATOS EN ASI / VIS Y DEMÁS REGISTROS, E IR CORROBORANDO CÓMO SE FORMA GRILLA OPERATIVA ANTES DE RECIBIR FICHADAS.**

Ver matriz de 10 ítems y scripts en el handoff del 28/05.

---

## Hecho en sesión 28/05 (resumen)

1. `grilla_aprobada` inmutable en `plt_*` al habilitar.
2. Callable `obtenerVistaPlanTurnoServicio` — lectura única VER plan.
3. UI unificada: Explorador, Bandeja RRHH, detalle jefe.
4. Regla un plan activo por grupo/mes (`PLT-GRD-001`, `PLT-APR-DUP`).
5. Backfill piloto + deploy functions/hosting.
6. RFC [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md).

---

## Pendientes priorizados

### Alta (próxima sesión)

1. Ejecutar matriz de control plan vs `asi_*` vs `vis_*` vs grillas UI (handoff § matriz).
2. Documentar hallazgos por agente (LOKITO compuesto, CHAPARRO/MOSTO fijo).
3. Probar gate `depende_rda` con/sin turno materializado.

### Media

4. RFC **cierre turno mensual RRHH** (realidad vs plan aprobado).
5. Indicador visual “grilla operativa difiere del plan” (opcional).
6. `git push` remoto hecho — verificar pull en otra PC.

### Baja

7. Fichadas reales (reloj).
8. Code splitting bundle > 500KB.

---

## Archivos clave

| Área | Archivo |
|------|---------|
| RFC snapshot | `docs/v2/RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md` |
| Builder snapshot | `functions/modules/asistencia/planGrillaAprobadaBuilder.js` |
| Callables plan | `functions/modules/asistencia/planesTurnoServicio.js` |
| Materialización | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Modal VER | `web/src/features/planes/PlanGrillaVistaModal.jsx` |
| Hook | `web/src/features/planes/useVistaPlanTurno.js` |

---

## Historial (sesión anterior — régimen horario)

Ver commits `24d37db`…`aa107fd` y tag `v2.0.0-regimen-horario` en [`RELEASE_REGIMEN_HORARIO.md`](./RELEASE_REGIMEN_HORARIO.md) para el epic régimen horario (mayo 2026).
