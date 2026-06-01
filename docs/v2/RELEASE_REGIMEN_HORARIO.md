# Release: Nuevo Sistema de Regímenes y Planificación Horaria

**Epic**: Régimen Horario V2  
**Branch**: `feature/ticketera-puente-campos-config`  
**Commits**: 9 fases (`24d37db` → `50d4075`)  
**Fecha**: Mayo 2026

---

## Release Notes (por rol)

### Para Todos los Colaboradores

- **Cálculo exacto de jornada**: al solicitar licencias o justificaciones de día completo, el sistema descuenta exactamente las horas planificadas para ese día (turno, nocturnidad, cruce de medianoche).
- **Ausencias parciales mejoradas**: se puede ingresar `hora_inicio` y `hora_fin` exactos. El motor valida contra el turno real y elimina falsos bloqueos por "superposición" cuando dos permisos parciales en el mismo día no colisionan.

### Para Jefes de Servicio

- **Grilla de planificación mensual**: nueva pantalla con sistema de "pincel" para pintar turnos (M/T/N/G/Franco) de todo el equipo.
- **Alertas inteligentes**: warnings al exceder días laborables, faltar francos o asignar turno a alguien con licencia aprobada.
- **Cambios tácticos (overrides)**: registrar cambios puntuales (cobertura de guardia, cambio de franco) directo desde la GSO, sin rehacer el plan mensual.

### Para Recursos Humanos

- **Catálogo dinámico de regímenes**: crear plantillas con patrones Fijo (L-V 7-14), Rotativo (2×2, 6×2) y Planificado, con tolerancias, horas extra y descansos.
- **Gobernanza unificada**: bandeja de aprobaciones con flujo BORRADOR → ENVIADO → AUTORIZADO_SUPERIOR → HABILITADO. Auditoría completa.
- **Asignación a nivel grupo (HLg)**: un profesional con múltiples cargos tiene reglas horarias independientes por servicio.

### Asistente de Ayuda

Botón flotante `?` en esquina inferior derecha. Panel lateral con manual paso a paso contextual según la pantalla actual + glosario de 20 términos del dominio.

---

## Resumen Técnico (9 Fases)

### Fase 1 — Schema Zod + Callables + Seed

**Commit**: `24d37db`

- Schema `regimenHorarioSchema` con `z.discriminatedUnion("tipo_patron")` para 3 arquetipos: fijo, rotativo, planificado.
- Callables backend: `guardarRegimenHorario`, `listarRegimenesHorarios`.
- Seed con 6 regímenes de ejemplo (admin, guardia 24hs, mixto 36hs, psicólogo flexible, enfermería rotativo, enfermería planificado).
- Firestore rules para `cfg_regimen_horario`.

**Archivos**: `web/src/schemas/regimenHorario.schema.js`, `functions/modules/catalogosRegimenHorario.js`, `scripts/seed-v2/seed-cfg.mjs`, `firebase-v2/firestore.rules`, + 3 más.

### Fase 2 — UI Catálogo RRHH

**Commit**: `893ee26`

- Página `/portal/rrhh/regimenes-horarios` con tabla, indicadores, filtros y búsqueda.
- Formulario dinámico con selector visual de `tipo_patron` y sub-editores condicionales (EditorFijo, EditorRotativo, EditorPlanificado).
- Validación Zod client-side antes de enviar al callable.
- Modal de detalle read-only con renderizado condicional por tipo.

**Archivos**: `web/src/pages/rrhh/RegimenesHorariosPage.jsx`, `web/src/pages/rrhh/regimenes/RegimenHorarioForm.jsx`, `web/src/pages/rrhh/regimenes/RegimenHorarioDetalle.jsx`, `web/src/App.jsx`, `web/src/constants/modulosEstado.js`.

### Fase 3 — Migración HLd → HLg

**Commit**: `07a078e`

- `regimen_horario_id` movido de HLd a HLg (el régimen pertenece al grupo, no al cargo).
- Nuevo campo `regimen_fecha_ancla` en HLg para rotativos.
- Read model prioriza HLg con fallback a HLd para backward compatibility.
- Frontend actualizado: payloadBuilders, formLogic, constants, schema Zod, LaboralFormHlgFields.

**Archivos**: 7 archivos entre backend y frontend.

### Fase 4 — Motor `resolverTurnoDia`

**Commit**: `699425f`

- Cadena de prioridad: overrides manuales > plan mensual habilitado > cálculo directo (fijo/rotativo).
- `resolverFijo`: mapeo ISO weekday al array `dias[]`.
- `resolverRotativo`: aritmética modular con soporte para fechas pre/post ancla.
- `resolverPlanificado`: consulta `planes_turno_servicio` habilitado del mes.
- Cruce con calendario institucional (feriados/asuetos).
- Contrato enriquecido: `tipo_dia`, `turno_teorico`, `horas_efectivas_total`, `es_feriado`, `es_nocturno`, `cruza_medianoche`, `origen`.
- **30 tests unitarios** (`node:test`): fechas, weekdays, módulo negativo, cruce medianoche, fijo, rotativo.

**Archivos**: `functions/modules/asistencia/resolverTurnoDia.js`, `functions/test/resolverTurnoDia.test.js`.

### Fase 5 — Planes Turno Servicio + Gobernanza

**Commit**: `53df9e0`

- Schema Zod `planTurnoServicioSchema` con `z.discriminatedUnion("tipo_plan")`: perpetuo vs. mensual.
- 7 callables de máquina de estados:
  - `guardarPlanTurnoServicio` (BORRADOR)
  - `enviarPlanTurnoServicio` (→ ENVIADO, con validación de reglas)
  - `aprobarPlanTurnoServicio` (→ AUTORIZADO_SUPERIOR)
  - `rechazarPlanTurnoServicio` (→ BORRADOR + observaciones)
  - `habilitarPlanTurnoServicio` (→ HABILITADO + detección overrides fantasma)
  - `cerrarPlanPerpetuo` (→ CERRADO)
  - `listarPlanesTurnoServicio` (filtros estado/periodo)
- Override fantasma: al habilitar, detecta overrides huérfanos en `asistencia_diaria` y ofrece invalidarlos con `invalidado_por_replanificacion: true`.

**Archivos**: `functions/modules/asistencia/planesTurnoServicio.js`, `web/src/schemas/planTurnoServicio.schema.js`, + 4 más.

### Fase 6 — UI Jefe: Grilla + Bandeja

**Commit**: `942c17d`

- **PlanTurnoServicioPage**: filtros (grupo, período, estado), tabs "Mis planes" / "Bandeja aprobaciones", tabla de planes, modal detalle con grilla coloreada + historial aprobaciones.
- **GrillaMensualEditor**: matriz día×agente, sistema de pincel (M/T/N/G/F con click), columnas sticky, contadores trabajo/francos en tiempo real, agregar/quitar agentes dinámicamente.
- **PlanPerpetualViewer**: vigencia desde/hasta, lista de agentes con fecha ancla.
- **BandejaAprobaciones**: cards con planes pendientes, mini-grilla read-only inline, botones Aprobar/Habilitar/Rechazar, modal de rechazo con observaciones obligatorias.
- Ruta `/portal/jefe/planes-turno` + menú "Planes turno" en grupo jefe.

**Archivos**: 4 componentes nuevos + 2 modificados.

### Fase 7 — Overrides Puntuales + Modal GSO

**Commit**: `364154a`

- Schema Zod `overrideTurnoSchema`: tipo (reemplazo/adicional), ingreso/egreso HH:MM, horas_efectivas, motivo obligatorio.
- 3 callables: `registrarCambioTurno` (arrayUnion en `overrides_turno[]`), `eliminarCambioTurno` (soft-delete con `eliminado: true`), `listarOverridesTurno`.
- **ModalCambioTurno**: log de overrides existentes con badges de tipo, formulario nuevo override con selector visual, horarios, motivo con contador.
- Integrado en GSO: columna "Turno" con botón "Cambio" por fila.

**Archivos**: 3 nuevos + 4 modificados.

### Fase 8 — HelpDrawer Contextual + Glosario

**Commit**: `d13d1ee`

- **20 definiciones** de glosario cubriendo todo el dominio.
- **3 manuales contextuales** (regímenes RRHH: 6 pasos, planes jefe: 6 pasos, GSO: 5 pasos).
- `resolverAyudaContextual(pathname)`: resuelve manual + glosario filtrado según ruta.
- **HelpDrawer**: panel lateral derecho con tabs Manual/Glosario, pasos numerados, buscador de texto libre.
- **HelpFab**: botón flotante `?` integrado globalmente en PortalLayout.

**Archivos**: `web/src/constants/helpContent.js`, `web/src/components/ui/HelpDrawer.jsx`, `web/src/features/routing/PortalLayout.jsx`.

### Fase 9 — Motor V2 Consume resolverTurnoDia

**Commit**: `50d4075`

- **turnoRegimenGate.js**: `validarTurnoRegimenParaSolicitud` itera cada día, invoca `resolverTurnoDia`, emite `SIN_REGIMEN_HORARIO` / `SIN_TURNO_DIA`, calcula horas (jornada completa vs. parcial), valida rangos horarios (`HORARIO_FUERA_DE_TURNO`, `HORARIO_EXCEDE_TURNO`), genera `snapshot_turno`.
- **validarSuperposicionIntraDia**: dos solicitudes parciales en el mismo día no colisionan si sus franjas horarias no se solapan.
- **patronCAltaMotorV2.js**: nueva Fase H al pipeline (P→C→E→W→F→T→S→G→**H**), `motor_snapshot` enriquecido con `turno_regimen` y `horas_jornada_total`.
- **grillaTurnoEntornoGate.js**: consulta `planes_turno_servicio` (HABILITADO) antes del fallback a `planificacion_mensual_rotativa`.

**Archivos**: 1 nuevo + 2 modificados.

---

## Diagrama de Flujo: Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    cfg_regimen_horario                          │
│              (catálogo de moldes horarios)                      │
│         Fijo │ Rotativo │ Planificado                          │
└──────┬──────────┬──────────────┬────────────────────────────────┘
       │          │              │
       ▼          ▼              ▼
┌──────────────────────────────────────┐
│   HLg (historial_laboral_grupos)     │
│   regimen_horario_id + fecha_ancla   │
└──────────────┬───────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐  ┌──────────────────────┐
│ Cálculo     │  │ planes_turno_servicio │
│ directo     │  │ (gobernanza mensual)  │
│ (fijo/rot)  │  │ BORRADOR → HABILITADO│
└──────┬──────┘  └──────────┬───────────┘
       │                    │
       └────────┬───────────┘
                ▼
       ┌─────────────────┐
       │ resolverTurnoDia │◄── overrides_turno[]
       │ (bajo demanda)   │    (asistencia_diaria)
       └────────┬─────────┘
                │
                ▼
       ┌─────────────────┐
       │   Motor V2      │
       │   Fase H        │
       │ (turnoRegimenGate)
       └────────┬─────────┘
                │
                ▼
       ┌─────────────────┐
       │  motor_snapshot  │
       │ horas_jornada    │
       │ turno_regimen    │
       │ es_nocturno      │
       │ cruza_medianoche │
       └──────────────────┘
```

---

## Plan de Pruebas QA

### Bloque A: Integridad del Catálogo

| # | Caso | Entrada | Resultado esperado |
|---|------|---------|--------------------|
| A1 | Crear régimen fijo | Admin L-V 07-14, 7hs/día, 35hs/sem | OK, aparece en tabla |
| A2 | Crear régimen rotativo | 2×2 noche, ciclo=4, ancla=2026-06-01 | OK, ciclo validado |
| A3 | Crear régimen planificado | Enfermería M/T/N, francos mín. 8 | OK, turnos_disponibles=3 |
| A4 | Editar régimen existente | Cambiar horas efectivas de 7 a 8 | OK, actualizado |
| A5 | Validación Zod frontend | Enviar sin nombre | Error client-side |
| A6 | Validación backend | Rotativo con ciclo.length ≠ ciclo_total | Error PLT-xxx |

### Bloque B: Circuito de Gobernanza

| # | Caso | Entrada | Resultado esperado |
|---|------|---------|--------------------|
| B1 | Crear plan mensual borrador | Grupo X, junio 2026, 3 agentes | Estado: BORRADOR |
| B2 | Enviar plan | Plan B1 | Estado: ENVIADO + warnings si aplica |
| B3 | Aprobar por superior | Plan B2 | Estado: AUTORIZADO_SUPERIOR |
| B4 | Habilitar por RRHH | Plan B3 | Estado: HABILITADO |
| B5 | Rechazar plan | Plan en ENVIADO + observaciones | Estado: BORRADOR + obs. guardadas |
| B6 | Override fantasma | Habilitar plan con overrides previos | Prompt confirmación + invalidación |
| B7 | Plan perpetuo | Crear + cerrar con fecha | Estado: CERRADO + vigente_hasta |

### Bloque C: Operativa Diaria

| # | Caso | Entrada | Resultado esperado |
|---|------|---------|--------------------|
| C1 | Override reemplazo | Franco → Turno M, motivo obligatorio | Override en array, turno reemplazado |
| C2 | Override adicional | Doble guardia 20-08, motivo | Override sumado al turno existente |
| C3 | Eliminar override | Soft-delete con motivo | eliminado: true, visible en auditoría |
| C4 | Modal GSO | Click "Cambio" en fila agente | Modal con overrides existentes + form |

### Bloque D: Motor V2 (Stress Test)

| # | Caso | Entrada | Resultado esperado |
|---|------|---------|--------------------|
| D1 | Solicitud sin régimen | Agente sin HLg.regimen_horario_id | Bloqueante: SIN_REGIMEN_HORARIO |
| D2 | Solicitud sin turno | Día sin plan mensual | Bloqueante: SIN_TURNO_DIA |
| D3 | Jornada completa | Solicitud día completo, turno 8hs | Descuenta 8hs exactas |
| D4 | Parcial dentro de turno | 10:00-12:00 en turno 07-14 | OK, descuenta 2hs |
| D5 | Parcial fuera de turno | 15:00-17:00 en turno 07-14 | Warning: HORARIO_FUERA_DE_TURNO |
| D6 | Dos parciales mismo día | 08-10 y 12-14, mismo agente | OK: no colisionan |
| D7 | Dos parciales solapados | 08-11 y 10-13, mismo agente | Bloqueante: superposición |
| D8 | Parcial + completa | Parcial 08-10 + completa mismo día | Bloqueante: superposición |

---

## Decisiones Arquitectónicas Clave

1. **Cálculo bajo demanda** (`resolverTurnoDia`) en lugar de proyección batch: evita inconsistencias por datos stale y simplifica la arquitectura.
2. **Régimen en HLg** (no HLd): permite regímenes diferentes por grupo/servicio para el mismo profesional.
3. **Override como array** en `asistencia_diaria`: soporta múltiples cambios por día (doble guardia) sin perder el turno original.
4. **Soft-delete** para overrides: pista de auditoría completa, crítica en entorno hospitalario.
5. **Override fantasma**: invalidación automática al re-planificar, evita duplicación de cálculos.
6. **Greenfield puro**: sin backward compatibility forzada, corte limpio hacia la nueva arquitectura.
