## Resumen ejecutivo

Este PR entrega el **blindaje GSO** acordado post-épica plan paralelo: se impide que un plan mensual con días `laborable`/`guardia` sin `turno_id` llegue a **HABILITADO**, y se elimina el estado ambiguo de celdas “en blanco” en la grilla operativa.

Las historias **US-9, US-1, US-16, US-14, US-3 y US-10** forman una cadena única: **prevención en editor → visibilidad y navegación en GSO → bloqueo estricto en backend**.

**Impacto:** ningún plan habilitado nuevo debería contener días laborables sin asignación de turno; la GSO muestra **INCOMPLETO_PLAN** (rayado rosa) y guía al jefe a corregir el plan mensual.

---

## Qué incluye

### Backend — US-9 (guardián final)

- `validacionesPlanTurno.js`: `assertPlanSinHuecosTurno` → `failed-precondition` **`[PLT-US9-001]`**.
- Cableado en `guardarPlan` (mensual), `aprobarPlanTurnoServicio` y `ejecutarAprobarPlanIncorporacion`.

### GSO — US-1 / US-16

- `celdaEsIncompletoPlanVis`, variante `incompletoPlan`, chip “Sin turno”.
- `tieneDatos` incluye incompleto; gestión táctica bloqueada en huecos de plan.

### GSO — US-14 / US-3 (reconciliación UX)

- `DiaGrillaDetalleModal`: mensaje + CTA **Corregir plan** → `/portal/jefe/planes-turno?grupo_id=&periodo=`.
- Licencia sobre plan incompleto: aviso adicional (escenario B) sin habilitar override.

### Editor — US-10 (prevención proactiva)

- Banner en `GrillaMensualEditor`: contador en tiempo real de huecos (misma regla US-9).
- `PlanTurnoServicioPage`: **Enviar** deshabilitado + tooltip; guard en `handleTransicion` (enviar/aprobar).

### Deep-link

- `PlanTurnoServicioPage` lee `?grupo_id=` y `?periodo=` desde el CTA del modal GSO.

---

## Tests / dry run

- [x] `npm run test:validaciones-plan-turno` (4/4)
- [x] `npm run test:blindaje-gso-dry-run` (2/2) — cadena lógica US-10 contador → US-9 assert
- [x] `npm run test -- --run src/features/grilla/grillaMesEquipoDisplay.test.js` (5/5)
- [x] `npm run test -- --run src/pages/jefe/planes/planHuecosTurnoUtils.test.js` (4/4)

---

## Test plan manual post-merge

- [ ] Editor plan: dejar un laborable sin turno → banner rosa con contador > 0; **Enviar** deshabilitado.
- [ ] Guardar borrador con huecos → backend rechaza o persiste según flujo; aprobar/habilitar → **`PLT-US9-001`**.
- [ ] GSO equipo: celda rayada rosa → modal → **Corregir plan** abre editor con grupo/mes correctos.
- [ ] Celda incompleta + licencia: modal muestra licencia + advertencia plan incompleto.
- [ ] Plan sin huecos: envío y habilitación sin regresión.

---

## Fuera de alcance (backlog)

- **US-17** inventario global planes `HABILITADO` con huecos históricos.
- Tooltip/disable **Aprobar** en bandeja RRHH (backend US-9 ya protege).
- **US-15** y resto P1 GSO en `PENDIENTES_IMPLEMENTACION_V2.md`.

---

## Documentación

- `docs/v2/CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md` (escenarios B, C, US-9, US-10)
- `docs/v2/ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`
- `docs/v2/PENDIENTES_IMPLEMENTACION_V2.md` §2
