# Pendientes — Próxima Sesión

> **Creado:** 2026-05-25
> **Contexto:** Motor V2 completo (LAO + Patrón B + Patrón C) desplegado y validado en producción.

---

## Tema Abierto: Compensatorios en horas — ¿cómo justifican el día?

### Problema

Los artículos de Patrón C (compensatorios, permisos gremiales) computan en **horas**,
pero la grilla/planilla del hospital trabaja en **días**. Hay una zona gris entre
consumo parcial y justificación de ausencia completa:

- **Horas totales del día:** Si el agente solicita las horas completas de su jornada
  según la carga horaria del día (ej: 6hs de un turno de 6hs), ¿el día queda
  justificado como ausencia completa?

- **Horas parciales:** Si solicita menos horas que su jornada (ej: 3hs de un turno
  de 6hs), ¿el día NO se justifica como ausencia pero sí se debitan las horas?
  ¿Cómo se marca esta diferencia en la grilla MDC?

- **Carga horaria variable:** ¿Se busca la carga horaria del día específico
  (turno asignado en la grilla) o se usa un valor fijo por cargo/grupo?
  ¿Qué pasa con agentes de turnos rotativos?

- **Multi-día:** Si la solicitud abarca múltiples días, ¿se busca la carga horaria
  de **cada día** del rango o se aplica un promedio?

### Artículos afectados

- **68-B (Compensatorio):** Horas acumuladas por trabajo extra, consumidas como
  ausencia parcial o completa.
- **Permisos gremiales por horas:** Mismo patrón — artículo que puede justificar
  el día completo pero computa en horas.

### Preguntas de diseño

1. ¿El motor debe consultar la grilla/turno del agente para determinar si las horas
   solicitadas cubren la jornada completa?
2. ¿Se necesita un nuevo campo en `motor_snapshot` como `justifica_dia_completo: true/false`?
3. ¿La grilla MDC ya tiene la información de horas por turno, o hay que agregarla?
4. ¿El `nivel_ocupacion_dia_id` del configurador resuelve este problema?
5. ¿RRHH necesita ver en la bandeja si la solicitud justifica ausencia o es parcial?

### Impacto técnico estimado

- **Motor:** Posible nueva fase o extensión de Fase G (Grilla) para comparar
  `horas_solicitadas` contra `horas_jornada_dia`.
- **Snapshot:** Agregar campo `justifica_dia_completo` y/o `horas_jornada_dia`.
- **Grilla MDC:** Verificar si el turno ya expone horas diarias.
- **Frontend:** Mostrar indicador de "justifica día" o "parcial" en la bandeja.

---

## Estado del sistema al cierre de sesión

- Motor V2 universal: 3 patrones (A/B/C) sobre `runMotorPipeline`.
- Smoke test E2E Patrón C: `sol_01KSG4MA559JESFB9Z1PK2M42A` — 6hs debitadas, 94hs restantes.
- Catálogo abierto: discovery dinámico por `collectionGroup("versiones")`.
- 6 fixes aplicados en producción (ver RFC §8).
- Todos los tests pasando (23/23).
- 0 huérfanos en auditoría CI (76 campos).
