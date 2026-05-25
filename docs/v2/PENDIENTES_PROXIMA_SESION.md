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

## Tema Abierto: Solicitud jornada completa vs parcial (diseño confirmado)

### Decisión de diseño

- Nuevo campo `es_jornada_completa` (boolean) en la solicitud.
- Caso A (día completo): `{ es_jornada_completa: true, horas_solicitadas: null }` — motor calcula horas desde grilla.
- Caso B (parcial): `{ es_jornada_completa: false, horas_solicitadas: 3.5 }` — agente inserta horas.
- Nuevo campo configurador `permite_jornada_parcial` (boolean) en `bloque_topes_plazos_computo`.
- Wizard muta según config: muestra toggle "Completa/Parcial" si `permite_jornada_parcial=true`.
- Artículos afectados: 68-B (compensatorio), 70-bis (24hs/mes, aún no creado).

### Preguntas pendientes

1. Grilla: `capa_teorica` siempre tiene `ingreso/egreso_teorico` para agentes activos?
2. Multi-día jornada completa: sumar horas reales de cada día o valor fijo?
3. 70-bis: reinicio mensual o bolsa global con tope mensual?

---

## PREREQUISITO: Catálogo de Regímenes Horarios (BLOQUEANTE)

> **Estado:** Sin definir — debe resolverse ANTES de implementar jornada completa/parcial.
> **Razón:** Sin un régimen horario asignado al agente, la `capa_teorica` no existe
> y el motor no puede calcular las horas de la jornada para `es_jornada_completa=true`.

### Problema actual

La carga horaria se guarda como array estático de 7 días en `historial_laboral_grupos` (HLg).
Esto asume "lunes a viernes en horario fijo" y no soporta la realidad hospitalaria:
- Enfermería rotativos (2x2, 1x3, franqueros de fin de semana)
- Médicos de guardia (24hs un día específico, con cambios)
- Directores/jefes (dedicación exclusiva, 44hs semanales sin horario fijo)

### Solución: Desacoplar "Dónde trabaja" de "Cuándo trabaja"

Crear un catálogo `catalogo_regimenes_horarios` gestionado por RRHH.
Cada agente recibe un `regimen_horario_id` en su historial laboral.
El sistema usa el régimen para proyectar la `capa_teorica` mensual automáticamente.

### Los 3 arquetipos de régimen

#### Patrón 1 — Fijo / Semanal (administrativos)

- **UI:** Checkboxes días (L-D) + franja horaria (inicio/fin) + carga auto-calculada.
- **Francos:** Implícitos (días no marcados).
- **Feriados:** Debe impactar calendario institucional (asuetos, feriados).
- **Ejemplo:** Admin L-V 07:00 a 14:00 (7hs).

#### Patrón 2 — Guardia fija (profesionales Ley 9282)

- **Similar al Patrón 1** pero con carga horaria distinta y días no laborados
  son "días no laborales" (no francos).
- **UI:** Día de guardia + duración (12h/24h) + horario inicio.
- **Feriados:** Impacta calendario institucional.
- **Ejemplo:** Médico guardia jueves 08:00 a viernes 08:00 (24hs).

#### Patrón 3 — Rotativo / Cíclico (enfermería)

- **UI:** Días trabajo consecutivos (T) + días descanso consecutivos (F) + franja horaria.
- **Fecha ancla:** Al asignar al agente, se indica el Día 1 del ciclo.
  El sistema proyecta hacia futuro con módulo matemático `(T+F)`.
- **Servicio 24hs abierto**, pero turnos de 8hs y/o 6hs.
- **Ejemplo:** Enfermería rotativo 2x2, turno noche 22:00-06:00 (8hs).

### Ciclo de vida operativo

1. **Catálogo:** RRHH crea regímenes ("Admin 35h", "Guardia Martes", "Rotativo 2x2 Noche").
2. **Onboarding:** Al agente se le asigna un `regimen_horario_id` en su HL.
3. **Batch mensual:** Cron job proyecta el mes siguiente → crea `asi_YYYYMMDD_per*` con `capa_teorica`.
4. **Validación jefe:** El jefe abre la grilla, ve la proyección, ajusta cambios puntuales, aprueba.
5. **Motor V2:** Al solicitar 68-B, el motor lee `capa_teorica` del día y sabe cuántas horas descontar.

### Dependencias

- Este catálogo es **prerequisito** para:
  - Jornada completa automática (`es_jornada_completa`)
  - Artículo 70-bis
  - Cualquier artículo futuro que compute en horas
- Sin él, el motor solo puede operar con horas manuales (estado actual).

---

## Estado del sistema al cierre de sesión

- Motor V2 universal: 3 patrones (A/B/C) sobre `runMotorPipeline`.
- Smoke test E2E Patrón C: `sol_01KSG4MA559JESFB9Z1PK2M42A` — 6hs debitadas, 94hs restantes.
- Catálogo abierto: discovery dinámico por `collectionGroup("versiones")`.
- 6 fixes aplicados en producción (ver RFC §8).
- Todos los tests pasando (23/23).
- 0 huérfanos en auditoría CI (76 campos).
