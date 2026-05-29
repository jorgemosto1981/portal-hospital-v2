# Punto de Continuación — Próxima Sesión

**Última actualización**: Viernes 29 Mayo 2026  
**RETOMAR AQUÍ**: [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md)  
**Handoff anterior (grilla aprobada UI):** [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md)

| Campo | Valor |
|-------|--------|
| **Branch** | `feat/epic-turnos-compuestos-v2` |
| **Último commit** | `730b4b9` — unifica VER plan en todas las pantallas |
| **Tags** | `v2-pre-grilla-aprobada-plt`, `v2-grilla-aprobada-plt` |
| **Producción** | https://portal-hospital-v2.web.app |
| **Plan piloto mayo** | `plt_01KSR8J55H1TN10M3ANSSWMPF2` (Sala Internación 1, 2026-05, HABILITADO) |
| **Plan piloto junio (incidente NL)** | `plt_01KSSPY2H5EZA925FQP4S1G2XW` — ver handoff 29/05 |

---

## Objetivo principal próxima sesión

1. **Limpieza táctica (RRHH):** HLGs zombie — handoff 29/05 § datos afectados.  
2. **Evolución motor (PR):** Regla **Plan > HLG** en materialización por aprobar/rehabilitar plan.  
3. **DoD épica:** Auditoría `node scripts/audit-vis-junio-2026.mjs` en verde + UI alineada sin parche de enriquecimiento.

Ver también matriz del handoff 28/05.

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

1. ~~**RRHH:** Cerrar HLGs zombie CHAPARRO + MOSTO~~ — hecho (una HLG vigente c/u). Correr `audit-vis-junio-2026.mjs`.
2. **Dev:** PR materialización Plan > HLG (`rdaTurnoTeoricoWorker.js`).
3. Re-auditar junio (`audit-vis-junio-2026.mjs`) + matriz handoff 28/05.
4. Probar gate `depende_rda` con/sin turno materializado.

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
