---
name: Catalogo Regimen Horario
overview: "Sistema completo de regimenes horarios: catalogo (fijo/rotativo/planificado), asignacion en HLg (por grupo), planes de turno con gobernanza unificada, resolucion bajo demanda, y conexion con Motor V2."
todos:
  - id: fase-1-schema
    content: "Fase 1: Schema Zod catalogo cfg_regimen_horario (3 tipos) + callable + seed"
    status: pending
  - id: fase-2-ui-catalogo
    content: "Fase 2: UI RRHH catalogo de regimenes (fijo/rotativo/planificado)"
    status: pending
  - id: fase-3-hlg
    content: "Fase 3: Mover regimen_horario_id de HLd a HLg + fecha_ancla + impacto"
    status: pending
  - id: fase-4-resolver
    content: "Fase 4: Servicio resolverTurnoDia (calculo bajo demanda)"
    status: pending
  - id: fase-5-planes-turno
    content: "Fase 5: Planes turno servicio + gobernanza + rechazo"
    status: pending
  - id: fase-6-ui-jefe
    content: "Fase 6: UI jefe planificacion mensual + bandeja aprobacion"
    status: pending
  - id: fase-7-overrides
    content: "Fase 7: Cambios operativos durante el mes (overrides puntuales)"
    status: pending
  - id: fase-8-docs
    content: "Fase 8: Glosario + manual de uso RRHH (modal flotante contextual)"
    status: pending
  - id: fase-9-motor
    content: "Fase 9: Motor V2 consume resolverTurnoDia para es_jornada_completa"
    status: pending
isProject: false
---

# Catalogo de Regimenes Horarios — Plan de Implementacion

## Contexto

- La coleccion `cfg_regimen_horario` ya existe (vacia) y esta registrada en whitelists backend/frontend.
- El campo `regimen_horario_id` existe como FK en `historial_laboral_datos` (HLd) — **se movera a HLg**.
- HLg ya tiene `carga_por_dia_semana` (array de 7 dias con horas) — el regimen horario es la version enriquecida.
- La `capa_teorica` en `asistencia_diaria` tiene `{tipo_id, ingreso_teorico, egreso_teorico}` pero no se proyecta.
- Sin este catalogo, el motor Patron C no puede calcular horas de jornada completa automaticamente.
- La coleccion `planificacion_mensual_rotativa` existe como "hueco" (Epic P): el gate la consulta pero no hay CRUD/UI/trigger.

## Escenarios reales confirmados

Basado en relevamiento del hospital:

- **Enfermeria:** 6hs/dia fijo (5+2), 8hs/dia fijo (5+2), 6hs rotativo, 8hs rotativo
- **Medicos:** Guardia 24hs dia fijo, guardia 24hs rotativa, guardia 12hs dia fijo, mixto (consultorio + guardia)
- **Cambios de turno:** ocurren algunas veces al mes (el jefe debe poder sobrescribir)
- **Nivel de detalle:** completo (tolerancias, descansos, nocturnidad, feriados)
- **Flexibilidad horaria:** algunos agentes tienen banda de ingreso flexible
- **Turno partido:** existe pero es infrecuente (extension futura)

---

## Contrato de datos: `cfg_regimen_horario/{id}`

### Campos comunes (todos los tipos)

- `id`: `CFG_REG_HOR_<ULID>`
- `nombre`: string — nombre visible (ej: "Enfermeria Rotativo 2x2 Noche 8hs")
- `codigo`: string — codigo corto estable para logs/reportes (ej: "ENF_ROT_2x2_N8")
- `activo`: boolean
- `tipo_patron`: `"fijo"` | `"rotativo"` | `"planificado"` (discriminante principal)
- `carga_horaria_semanal_teorica`: number — horas/semana promedio (auto-calculable)
- `impacta_calendario_institucional`: boolean — feriados/asuetos anulan el dia laborable
- `tipo_contrato_ids`: array string | null — filtro opcional
- `notas_rrhh`: string | null — observaciones libres
- `creado_en` / `actualizado_en`: Timestamp

### Bloque de turno (embebido, reutilizado por todos los tipos)

```json
"turno": {
  "ingreso": "07:00",
  "egreso": "14:00",
  "horas_efectivas": 7,
  "es_nocturno": false,
  "tolerancia_ingreso_min": 10,
  "tolerancia_egreso_min": 10,
  "banda_ingreso": null,
  "banda_egreso": null,
  "descanso": {
    "duracion_min": 30,
    "es_pago": true,
    "despues_de_horas": 4
  }
}
```

- `horas_efectivas`: horas computables (puede diferir de egreso-ingreso si hay descanso no pago)
- `es_nocturno`: flag para recargo/computo especial (horas entre 21:00-06:00)
- `tolerancia_*_min`: minutos de margen antes de registrar atraso/salida anticipada
- `banda_ingreso` / `banda_egreso`: rango flexible (ej: `{ "desde": "07:00", "hasta": "08:00" }`). null = horario rigido.
- `descanso`: refrigerio/colacion (pago o no, despues de cuantas horas). null = sin descanso formal.
- **Turno partido:** extension futura (`turnos[]` array en vez de `turno` singular)

### Patron FIJO — Semanal (`tipo_patron: "fijo"`)

Cubre: administrativos, medicos de consultorio, guardias de dia fijo, enfermeria semanal fija, psicologos.

```json
{
  "tipo_patron": "fijo",
  "dias": [
    { "dia_semana": 1, "tipo_dia": "laborable", "turno": { "ingreso": "07:00", "egreso": "14:00", "horas_efectivas": 7, "es_nocturno": false, "tolerancia_ingreso_min": 10, "tolerancia_egreso_min": 10, "banda_ingreso": null, "banda_egreso": null, "descanso": null } },
    { "dia_semana": 6, "tipo_dia": "franco", "turno": null },
    { "dia_semana": 7, "tipo_dia": "franco", "turno": null }
  ],
  "impacta_calendario_institucional": true,
  "horas_extra_max_semanal": 10,
  "horas_extra_max_mensual": 30
}
```

- `dia_semana`: 1=lunes a 7=domingo (ISO 8601). Los 7 dias deben estar presentes.
- `tipo_dia`: `"laborable"` | `"guardia"` | `"no_laborable"` | `"franco"`
- Cada dia puede tener su propio turno con horarios distintos (soporta mixto: consultorio L-M-X + guardia J)

### Patron ROTATIVO — Ciclico (`tipo_patron: "rotativo"`)

Cubre: enfermeria rotativa, guardias rotativas, franqueros.

```json
{
  "tipo_patron": "rotativo",
  "ciclo": [
    { "posicion": 1, "tipo_dia": "laborable", "turno": { "ingreso": "06:00", "egreso": "14:00", "horas_efectivas": 8 } },
    { "posicion": 2, "tipo_dia": "laborable", "turno": { "ingreso": "06:00", "egreso": "14:00", "horas_efectivas": 8 } },
    { "posicion": 3, "tipo_dia": "franco", "turno": null },
    { "posicion": 4, "tipo_dia": "franco", "turno": null }
  ],
  "ciclo_total": 4,
  "impacta_calendario_institucional": false,
  "horas_extra_max_semanal": null,
  "horas_extra_max_mensual": 20
}
```

- `ciclo[]`: array ordenado por `posicion` (1-based). Define el patron completo que se repite.
- `ciclo_total`: longitud del ciclo (debe coincidir con `ciclo.length`)
- **Fecha ancla:** va en la **asignacion al agente** (HLg), no en el catalogo

### Patron PLANIFICADO — Jefe de servicio (`tipo_patron: "planificado"`)

Cubre: enfermeria con turnos variables (M/T/N) donde el jefe arma la grilla mensual.

```json
{
  "tipo_patron": "planificado",
  "turnos_disponibles": [
    { "turno_id": "M", "etiqueta": "Manana", "ingreso": "06:00", "egreso": "14:00", "horas_efectivas": 8, "es_nocturno": false, "tolerancia_ingreso_min": 5, "tolerancia_egreso_min": 5, "banda_ingreso": null, "banda_egreso": null, "descanso": { "duracion_min": 30, "es_pago": true, "despues_de_horas": 4 } },
    { "turno_id": "T", "etiqueta": "Tarde", "ingreso": "14:00", "egreso": "22:00", "horas_efectivas": 8, "es_nocturno": false, "tolerancia_ingreso_min": 5, "tolerancia_egreso_min": 5, "banda_ingreso": null, "banda_egreso": null, "descanso": { "duracion_min": 30, "es_pago": true, "despues_de_horas": 4 } },
    { "turno_id": "N", "etiqueta": "Noche", "ingreso": "22:00", "egreso": "06:00", "horas_efectivas": 8, "es_nocturno": true, "tolerancia_ingreso_min": 5, "tolerancia_egreso_min": 5, "banda_ingreso": null, "banda_egreso": null, "descanso": { "duracion_min": 30, "es_pago": true, "despues_de_horas": 4 } }
  ],
  "reglas_planificacion": {
    "dias_trabajo_max_mes": 23,
    "dias_franco_min_mes": 8,
    "max_consecutivos_trabajo": 6,
    "min_consecutivos_franco": 1
  },
  "impacta_calendario_institucional": false,
  "horas_extra_max_semanal": null,
  "horas_extra_max_mensual": 20
}
```

- `turnos_disponibles[]`: la paleta que el jefe puede usar. Turno IDs libres (no hardcodeados).
- `reglas_planificacion`: el sistema valida la grilla del jefe contra estas reglas
- No tiene `dias[]` ni `ciclo[]`: esa info la aporta el jefe via el plan mensual

---

## Asignacion del regimen: de HLd a HLg

### Decision arquitectonica

El `regimen_horario_id` se **mueve de HLd a HLg** (historial_laboral_grupos).

**Razon:** un medico con un cargo de 30hs puede estar en dos grupos:
- 20hs en Clinica (regimen: consultorio L-M-X)
- 10hs en Emergencias (regimen: guardia jueves)

El regimen es por **persona + grupo**, no por persona sola. HLg ya es el nivel que vincula persona con grupo y ya tiene `carga_por_dia_semana`.

### Campos nuevos en HLg

- `regimen_horario_id`: FK a `cfg_regimen_horario` (obligatorio para planes habilitados)
- `regimen_fecha_ancla`: string YMD | null — solo para rotativos (dia 1 del ciclo del agente)

### Vigencia del regimen

La vigencia del regimen la dan los `fecha_inicio` / `fecha_fin` que HLg ya tiene. Cuando cambia el regimen de un agente en un grupo:

1. Se cierra el HLg actual: `fecha_fin = ultimo_dia_regimen_viejo`, `activo = false`
2. Se crea un nuevo HLg: `fecha_inicio = primer_dia_regimen_nuevo`, `fecha_fin = null`, con el nuevo `regimen_horario_id`
3. El HLg cerrado queda como historial de auditoria

Ejemplo — Lopez cambia de Fijo Manana a Rotativo 2x2 en julio:
```
HLg_viejo (cerrado):
  grupo=EnfCirugia, regimen=Fijo8hsManana, fecha_inicio=2025-01-01, fecha_fin=2026-06-30

HLg_nuevo (vigente):
  grupo=EnfCirugia, regimen=Rotativo2x2, fecha_inicio=2026-07-01, fecha_fin=null
  regimen_fecha_ancla=2026-07-01
```

`resolverTurnoDia(per_lopez, "2026-03-15")` → encuentra HLg_viejo → Fijo Manana
`resolverTurnoDia(per_lopez, "2026-08-20")` → encuentra HLg_nuevo → Rotativo 2x2

**Ventajas:**
- Usa el mecanismo existente de HLg (sin campos nuevos de fecha)
- La validacion `findSolapeHlgMismoCargo` ya impide solapamientos
- Consistente con el patron de HLc (cierre + apertura cuando cambian condiciones)
- Historial completo de todos los regimenes que tuvo cada agente en cada grupo

### Relacion con `carga_por_dia_semana`

- `carga_por_dia_semana` = horas contractuales comprometidas (reconciliacion con `carga_horaria_total` del cargo)
- `regimen_horario_id` = como se distribuyen esas horas (ingreso, egreso, tolerancias, descanso)
- Son complementarios: `carga_por_dia_semana` es el "que" (7hs lunes), el regimen es el "como" (07:00 a 14:00, tolerancia 10min)
- Para regimenes planificados: `carga_por_dia_semana` es una aproximacion (horas promedio)

### Impacto en codigo (8 archivos)

| Archivo | Cambio |
|---------|--------|
| `functions/modules/catalogosLaborales.js` | Mover validacion/persistencia de rama HLd a rama HLg |
| `web/src/pages/datos-laborales/payloadBuilders.js` | Sacar de `buildHldPayload`, agregar a `buildHlgPayload` |
| `web/src/pages/datos-laborales/formLogic.js` | Cambiar inicializacion del campo |
| `web/src/pages/datos-laborales/constants.js` | Mover ayuda y default a seccion HLg |
| `web/src/constants/datosLaboralesSchema.js` | Mover de fieldList HLd a fieldList HLg |
| `web/src/pages/DatosLaborales.jsx` | Ajustar estado inicial del formulario |
| `web/src/pages/datos-laborales/sections/LaboralFormHlgFields.jsx` | Ya esta ahi (no cambia UI) |
| `web/src/pages/GrillaOperativa.jsx` | Ajustar lectura del read-model |

**Riesgo: bajo.** La UI ya muestra `regimen_horario_id` en la seccion HLg. El dato solo cambia de documento de persistencia.

---

## Resolucion bajo demanda (sin proyector batch)

### Principio

No hay batch mensual que pre-proyecte `capa_teorica`. El turno de un dia se **calcula al vuelo** cuando alguien lo necesita.

### Servicio `resolverTurnoDia(personaId, fecha, grupoId?)`

Orden de resolucion:
1. **Override manual:** busca en `asistencia_diaria` si hay `es_override_manual: true` para ese dia → usa el override
2. **Plan mensual:** si el regimen es `planificado`, busca en `planes_turno_servicio` el plan HABILITADO del mes → lee `turno_id` del dia → resuelve el turno desde `turnos_disponibles` del regimen
3. **Calculo directo:** si el regimen es `fijo`, calcula `diaSemana(fecha)` → busca en `dias[]`. Si es `rotativo`, calcula `(diffDias(fecha, fecha_ancla) % ciclo_total) + 1` → busca en `ciclo[]`
4. **Feriado:** cruza con calendario institucional si `impacta_calendario_institucional=true`

Retorna (respuesta enriquecida con todos los flags, para que ningun consumidor recalcule):
```json
{
  "tipo_dia": "laborable",
  "turno_teorico": {
    "ingreso": "06:00",
    "egreso": "14:00",
    "horas_efectivas": 8,
    "es_nocturno": false,
    "cruza_medianoche": false,
    "tolerancia_ingreso_min": 5,
    "tolerancia_egreso_min": 5
  },
  "overrides": [],
  "horas_efectivas_total": 8,
  "es_feriado": false,
  "evento_calendario_id": null,
  "es_dia_laborable": true,
  "origen": "regimen_fijo",
  "regimen_horario_id": "CFG_REG_HOR_xxx",
  "hlg_id": "hlg_xxx"
}
```

### Ventajas sobre proyeccion batch

- Sin proceso batch, sin escrituras masivas a `asistencia_diaria`
- Sin riesgo de desincronizacion (el calculo siempre usa la fuente actual)
- Sin duplicacion de datos (el regimen ES la verdad, no una copia)
- Para fijo/rotativo el calculo es trivial (una operacion modular)
- Mas simple de implementar y mantener

### Cuando SI se escribe en `asistencia_diaria`

Solo se escribe en `asistencia_diaria` cuando hay algo que difiere de lo teorico:
- Override manual del jefe (cambio de turno puntual)
- Aporte normativo de una solicitud aprobada (licencia, compensatorio)
- Fichada real (futuro)
- Consolidacion MDC

---

## Plan de Turnos del Servicio — Gobernanza unificada

Coleccion: `planes_turno_servicio/{planId}`

Reemplaza/extiende la existente `planificacion_mensual_rotativa`. El gate existente se actualiza.

**Principio:** TODO plan de turnos pasa por la misma cadena, sin importar el tipo de regimen. El jefe de servicio siempre inicia. RRHH siempre valida.

### Tipos de plan

**Plan perpetuo** (para regimenes fijo y rotativo):
- Se crea una vez
- `vigencia_desde` obligatoria, `vigencia_hasta` null = sin fin
- Queda vigente hasta que se cierre y se cree uno nuevo
- Modificacion: se cierra el plan viejo (pone `vigencia_hasta = hoy`) y se crea uno nuevo. Queda historial.

**Plan mensual** (para regimen planificado):
- Se crea cada mes por el jefe del servicio
- `periodo`: YYYY-MM
- Contiene la grilla dia por dia con turno asignado a cada agente
- Deadline configurable por RRHH (ej: "antes del 25 del mes anterior")

### Estados del plan

```
BORRADOR → ENVIADO → AUTORIZADO_SUPERIOR → HABILITADO
                │                                ▲
                └── (sin superior) ──────────────┘
                │
                └── RECHAZADO → (vuelve a BORRADOR con observaciones)
```

- `BORRADOR`: jefe esta armando, puede editar libremente
- `ENVIADO`: jefe lo envio para aprobacion, no se puede editar
- `AUTORIZADO_SUPERIOR`: el superior jerarquico lo aprobo (solo si existe superior)
- `HABILITADO`: RRHH valido, el plan esta activo
- `RECHAZADO`: superior o RRHH rechazo, vuelve a `BORRADOR` con `observaciones_rechazo`

Si el servicio no tiene superior jerarquico (huerfano), ENVIADO va directo a RRHH.

### Documento: Plan perpetuo (fijo/rotativo)

```json
{
  "id": "plt_01XXXX",
  "grupo_de_trabajo_id": "gdt_xxx",
  "tipo_plan": "perpetuo",
  "vigencia_desde": "2026-06-01",
  "vigencia_hasta": null,
  "estado_plan": "BORRADOR",
  "deadline_envio": null,
  "creado_por": "per_jefe_xxx",
  "creado_en": "2026-05-20T...",
  "actualizado_en": "2026-05-20T...",
  "aprobaciones": {
    "enviado_en": null,
    "superior_persona_id": null,
    "superior_aprobado_en": null,
    "superior_rechazado_en": null,
    "rrhh_persona_id": null,
    "rrhh_habilitado_en": null,
    "rrhh_rechazado_en": null,
    "observaciones_rechazo": null
  },
  "agentes": {
    "per_admin_001": {
      "regimen_horario_id": "CFG_REG_HOR_admin_7hs",
      "regimen_fecha_ancla": null
    },
    "per_admin_002": {
      "regimen_horario_id": "CFG_REG_HOR_admin_7hs",
      "regimen_fecha_ancla": null
    }
  }
}
```

### Documento: Plan mensual (planificado)

```json
{
  "id": "plt_01YYYY",
  "grupo_de_trabajo_id": "gdt_xxx",
  "tipo_plan": "mensual",
  "periodo": "2026-06",
  "estado_plan": "BORRADOR",
  "deadline_envio": "2026-05-25",
  "creado_por": "per_jefe_xxx",
  "creado_en": "2026-05-15T...",
  "actualizado_en": "2026-05-20T...",
  "aprobaciones": {
    "enviado_en": null,
    "superior_persona_id": null,
    "superior_aprobado_en": null,
    "superior_rechazado_en": null,
    "rrhh_persona_id": null,
    "rrhh_habilitado_en": null,
    "rrhh_rechazado_en": null,
    "observaciones_rechazo": null
  },
  "agentes": {
    "per_enfermero_001": {
      "regimen_horario_id": "CFG_REG_HOR_enf_8hs_plan",
      "dias": [
        { "dia": 1, "turno_id": "M", "tipo_dia": "laborable" },
        { "dia": 2, "turno_id": "T", "tipo_dia": "laborable" },
        { "dia": 3, "turno_id": null, "tipo_dia": "franco" },
        { "dia": 4, "turno_id": "N", "tipo_dia": "laborable" },
        { "dia": 5, "turno_id": "M", "tipo_dia": "laborable" }
      ]
    }
  }
}
```

### Ciclo de vida del plan mensual

1. RRHH configura `deadline_envio` para el proximo mes (ej: "antes del 25")
2. Jefe abre UI de planificacion, ve la grilla de su equipo
3. Asigna turnos dia por dia, sistema valida contra `reglas_planificacion` del regimen
4. Jefe envia (BORRADOR → ENVIADO)
5. Si tiene superior: superior revisa y aprueba (ENVIADO → AUTORIZADO_SUPERIOR)
6. Si tiene superior y rechaza: vuelve a BORRADOR con observaciones
7. Si no tiene superior (huerfano): va directo a RRHH
8. RRHH valida y habilita (→ HABILITADO) o rechaza (→ BORRADOR con observaciones)
9. El servicio `resolverTurnoDia` lee el plan HABILITADO para calcular turnos del mes

### Vigencia de planes perpetuos

Cuando un plan perpetuo se modifica (ej: administrativo cambia de horario):
1. Se cierra el plan actual: `vigencia_hasta = fecha_cierre`, `estado_plan = "CERRADO"`
2. Se crea un nuevo plan con la nueva configuracion
3. El plan cerrado queda como historial/auditoria
4. El servicio `resolverTurnoDia` siempre busca el plan HABILITADO con vigencia que incluya la fecha consultada

### Archivo historico

Planes mensuales HABILITADOS son inmutables. No se borran, se archivan despues de 3-6 meses. Quedan como referencia de auditoria.

### Reglas de planificacion: warnings, no bloqueos

Todas las `reglas_planificacion` del regimen son **advertencias**, no bloqueos duros:
- El sistema muestra warnings al jefe (ej: "Lopez solo tiene 6 francos, minimo es 8")
- El jefe puede enviar el plan CON warnings
- RRHH decide si acepta o rechaza con observaciones

Razon: un agente que se incorpora el dia 15 no puede cumplir 20 dias de trabajo. Un agente con licencia medica tampoco. Las reglas son guias, no leyes rigidas.

Se elimina `dias_trabajo_min_mes` (no aporta valor real). Se mantienen como warnings:
- `dias_trabajo_max_mes`: advertencia si se excede
- `dias_franco_min_mes`: advertencia si no se cumplen
- `max_consecutivos_trabajo`: advertencia si se excede
- `min_consecutivos_franco`: advertencia si no se cumple

### Licencias visibles al armar la grilla

Cuando el jefe abre la UI de planificacion del mes, el sistema muestra las solicitudes de licencia/ausencia de cada agente **desde su estado inicial** (no solo aprobadas):

- **Solicitud aprobada:** celda bloqueada, color solido, no asignable
- **Solicitud pendiente/en revision:** celda marcada con indicador visual (rayado/tenue), asignable con warning
- **Solicitud rechazada:** no se muestra, celda libre

Si el jefe asigna turno a un dia con solicitud pendiente, el sistema muestra warning: "Lopez tiene solicitud pendiente de licencia medica para este dia."

La UI consulta `solicitudes_articulo` (todos los estados activos) para el mes planificado.

### Turno parcial / incompleto

El jefe puede dejar dias sin asignar. Escenarios legitimos:
- Agente con licencia parte del mes (ej: licencia medica hasta el 15)
- Agente que se incorpora a mitad de mes (cambio de regimen el dia 15)
- Dia sin definir que se resolvera despues (queda como pendiente)

Los dias sin asignar no generan `capa_teorica`. Si el agente intenta pedir un articulo para un dia sin turno asignado, el gate rechaza con `TURNO_NO_PLANIFICADO`.

### Re-habilitacion y overrides existentes (Override Fantasma)

Cuando un plan mensual se rechaza, se corrige y se re-habilita, pueden existir overrides manuales en `asistencia_diaria` que se hicieron entre la primera habilitacion y el rechazo.

Ejemplo:
1. Plan Junio se habilita el 28 de mayo
2. El 10 de junio, jefe crea override tipo "reemplazo" via GSO
3. El 15 de junio, RRHH rechaza el plan por error en semana 1
4. Jefe corrige semana 1 (quizas incorporando el cambio del dia 10 en la grilla oficial)
5. Plan se re-habilita

Problema: el override del dia 10 sigue en `asistencia_diaria`. Si el jefe ya incorporo ese cambio en la grilla corregida, el override aplica SOBRE la correccion, duplicando el efecto.

Solucion: al pasar un plan mensual a HABILITADO, el callable `habilitarPlanTurnoServicio`:
1. Busca overrides existentes en `asistencia_diaria` para ese grupo + periodo
2. Si encuentra overrides:
   - Genera advertencia a RRHH: "Existen N overrides manuales para este periodo que seran invalidados"
   - Lista cada override (dia, agente, motivo) para revision
   - RRHH confirma la habilitacion (con purgado de overrides) o cancela
3. Al confirmar, los overrides existentes se marcan como `invalidado_por_replanificacion: true` (no se borran, quedan como auditoria)
4. El jefe debe recrear manualmente cualquier override que siga siendo necesario

### Planes no enviados a tiempo

- El sistema genera una alerta para RRHH ("Servicio X no envio plan de junio")
- Los agentes de ese servicio quedan sin turno planificado para el mes
- El gate existente rechaza solicitudes con `TURNO_NO_PLANIFICADO`

---

## Cambios operativos durante el mes (proceso separado)

La plantilla aprobada es el punto de partida. Durante el mes, el jefe puede necesitar cambios:
- Cambio de turno entre companeros (Lopez pasa de M a T, Garcia de T a M)
- Cambio de franco (mover franco del martes al jueves)
- Doble guardia de urgencia (cubrir turno adicional en el mismo dia)

Estos cambios NO modifican el plan aprobado. Son **overrides puntuales** en `asistencia_diaria`.

### Override como array (soporta doble guardia)

El turno teorico (de resolverTurnoDia) nunca se sobrescribe. Los overrides son un array en `asistencia_diaria`:

```json
{
  "overrides_turno": [
    {
      "tipo_override": "reemplazo",
      "turno": { "ingreso": "14:00", "egreso": "22:00", "horas_efectivas": 8 },
      "motivo": "Cambio turno con Garcia",
      "creado_por": "per_jefe",
      "creado_en": "2026-05-18T..."
    }
  ]
}
```

Dos tipos de override:
- `"reemplazo"`: sustituye el turno teorico (cambio de turno con companero)
- `"adicional"`: se suma al turno teorico (doble guardia, cobertura de urgencia)

Ejemplo doble guardia: medico trabaja 08-14 (turno teorico), jefe le pide cubrir 20-08 de urgencia:
```json
{
  "overrides_turno": [
    {
      "tipo_override": "adicional",
      "turno": { "ingreso": "20:00", "egreso": "08:00", "horas_efectivas": 12, "es_nocturno": true },
      "motivo": "Cobertura urgente por ausencia Dr. Perez",
      "creado_por": "per_jefe",
      "creado_en": "2026-05-20T..."
    }
  ]
}
```

`resolverTurnoDia` retorna ambos: turno_teorico (6hs) + override adicional (12hs) = 18hs total.
El turno partido futuro (`turnos[]` en el catalogo) es para patrones regulares. Los overrides adicionales cubren las urgencias puntuales sin necesidad de esa extension.

---

## Divergencias plan vs realidad

El plan es la **intencion**. La realidad puede diferir. El sistema detecta las divergencias y genera alertas.

### Capas del dia (ejemplo: enfermero con turno extra)

```
DIA 20 de marzo — Enfermero Lopez

CAPA 1 — Plan (intencion, de resolverTurnoDia):
  Turno Manana: 06:00 - 14:00, 8hs

CAPA 2 — Override (jefe lo sabia):
  Adicional: 14:00 - 22:00, 8hs, "cobertura por ausencia Garcia"

CAPA 3 — Fichadas (lo que paso - FUTURO):
  Ingreso real: 05:55, Egreso real: 22:10

CAPA 4 — Divergencia (calculada por el sistema):
  Plan: 8hs + Override: 8hs = 16hs esperadas
  Fichada: 16h15m reales
  Diferencia: +15min → dentro de tolerancia → OK
```

### Resolucion de divergencias

Cuando las fichadas muestran que un agente trabajo mas (o menos) de lo planificado:
1. El **jefe del servicio** indica el motivo y tipo (horas extra, cobertura, cambio informal, etc.)
2. **RRHH** valida la justificacion del jefe
3. La divergencia resuelta se registra en `asistencia_diaria` con el motivo

La definicion detallada del flujo de resolucion se implementa con el modulo de fichadas (futuro). Por ahora, la arquitectura deja el espacio preparado:
- `resolverTurnoDia` retorna `turno_teorico` + `overrides` + `horas_efectivas_total`
- `asistencia_diaria` tiene espacio para `fichadas[]` y `divergencias[]`
- El override `"adicional"` ya cubre el caso de turno extra conocido de antemano (la "fichada silenciosa" no hace falta como concepto separado)

### Interaccion con fichadas (futuro)

Los campos del bloque de turno estan disenados para fichadas:

```
capa_teorica (que DEBERIA pasar — calculado por resolverTurnoDia)
  ingreso_teorico: "06:00"
  egreso_teorico: "14:00"
  tolerancia_ingreso_min: 5
  banda_ingreso: { desde: "05:50", hasta: "06:10" }

fichadas (que PASO realmente — futuro)
  ingreso_real: "06:12"
  egreso_real: "14:05"

comparacion:
  06:12 > 06:05 (ingreso + tolerancia) → atraso 7 min
  14:05 dentro de tolerancia egreso → OK
```

---

## Nocturnidad (cross-midnight)

Regla: el turno se imputa al dia de ingreso. Si un agente entra a las 22:00 del martes y sale a las 06:00 del miercoles, las 8hs se computan al martes.

## Feriados y calendario institucional

- Si `impacta_calendario_institucional=true`: `resolverTurnoDia` cruza con calendario institucional
- En un feriado, un dia laborable se trata como no_laborable
- Patrones rotativos tipicamente NO impactan (el hospital sigue abierto), pero el flag permite configurarlo

## Reglas de horas extra

- `horas_extra_max_semanal`: tope semanal (null = sin tope)
- `horas_extra_max_mensual`: tope mensual (null = sin tope)
- Se consultan desde el motor de asistencia, no desde el motor de solicitudes

---

## Convergencia: flujo completo

```
cfg_regimen_horario (catalogo de moldes — RRHH crea)
       │
       ▼
HLg.regimen_horario_id (asignacion persona + grupo)
       │
       ▼
planes_turno_servicio (gobernanza por grupo — jefe crea)
  ├─ perpetuo (fijo/rotativo): BORRADOR → ENVIADO → [SUPERIOR] → RRHH → HABILITADO
  └─ mensual (planificado):    BORRADOR → ENVIADO → [SUPERIOR] → RRHH → HABILITADO
       │
       ▼
resolverTurnoDia(persona, fecha)  ← calculo bajo demanda
  1. override en asistencia_diaria?  → usa override
  2. planificado? → lee plan mensual HABILITADO
  3. fijo/rotativo? → calcula desde regimen + fecha_ancla
  4. feriado? → cruza con calendario
       │
       ▼
Motor V2 / GSO / Gate → lee horas_efectivas del dia
```

---

## Fases de ejecucion

### Fase 1 — Schema + Callable catalogo
- Schema Zod discriminado por `tipo_patron` ("fijo" | "rotativo" | "planificado")
- Schema de turno embebido reutilizado por los tres tipos
- Schema de `turnos_disponibles[]` y `reglas_planificacion` (solo planificado)
- Callable `guardarRegimenHorario` con validacion por tipo
- Validaciones: 7 dias en fijo, ciclo_total === ciclo.length, turno_id unicos en planificado
- Seed con regimenes de ejemplo (Admin 7hs, Enfermeria 6x2, Guardia 24hs, Medico mixto, Enfermeria planificado M/T/N, Psicologo 12hs flexible)

### Fase 2 — UI de RRHH (catalogo de regimenes)
- Pantalla dedicada `/portal/configuracion/regimenes-horarios`
- Paso 1: elegir tipo (Fijo / Rotativo / Planificado por jefe)
- Paso 2 Fijo: grilla semanal L-D con turno por dia (tipo_dia + ingreso/egreso/horas + tolerancias)
- Paso 2 Rotativo: definir ciclo (N posiciones, turno, tipo_dia por posicion)
- Paso 2 Planificado: definir paleta de turnos (M/T/N u otros) + reglas de planificacion
- Preview visual: mini-calendario mostrando la proyeccion de 2 semanas (fijo/rotativo)
- Campos comunes: nombre, codigo, feriados, tolerancias, horas extra, descanso

### Fase 3 — Mover regimen_horario_id a HLg
- Agregar `regimen_horario_id` y `regimen_fecha_ancla` al payload de HLg
- Remover `regimen_horario_id` del payload de HLd
- Migrar datos existentes (si hay HLd con regimen, copiar al HLg correspondiente)
- Actualizar 8 archivos afectados (ver seccion "Impacto en codigo")
- UI: al seleccionar regimen rotativo en HLg, aparece date picker "Dia 1 del ciclo"
- Validacion: si tipo_patron=rotativo, fecha_ancla es obligatoria

### Fase 4 — Servicio resolverTurnoDia
- Funcion pura: `resolverTurnoDia(db, personaId, fecha, grupoId?)` → turno del dia
- Orden: override → plan mensual → calculo directo (fijo/rotativo)
- Cruce con calendario institucional
- Tests unitarios para los 3 tipos + overrides + feriados + nocturnidad
- Actualizar gate `grillaTurnoEntornoGate.js` para usar `resolverTurnoDia` en vez de leer `capa_teorica` directo

### Fase 5 — Planes turno servicio: schema + callables
- Schema Zod para `planes_turno_servicio` (perpetuo y mensual)
- Callable `guardarPlanTurnoServicio` (crear/editar como BORRADOR)
- Callable `enviarPlanTurnoServicio` (BORRADOR → ENVIADO)
- Callable `aprobarPlanTurnoServicio` (→ AUTORIZADO_SUPERIOR o → HABILITADO si huerfano)
- Callable `habilitarPlanTurnoServicio` (RRHH: → HABILITADO)
- Callable `rechazarPlanTurnoServicio` (→ BORRADOR con observaciones_rechazo)
- Callable `cerrarPlanPerpetuo` (cierra con vigencia_hasta + crea nuevo)
- Validacion contra `reglas_planificacion` del regimen al enviar
- Reglas Firestore para la coleccion

### Fase 6 — UI del jefe: planificacion + bandeja aprobacion
- **Plan perpetuo (fijo/rotativo):** formulario con lista de agentes + regimen asignado + vigencia
- **Plan mensual (planificado):** grilla mensual (filas=agentes, columnas=dias, celdas=turno M/T/N/Franco)
  - Paleta de turnos del regimen como opciones
  - Validacion en tiempo real contra reglas
  - Vista de cobertura (cuantos por turno cada dia)
- Botones: Guardar borrador / Enviar para aprobacion
- Bandeja de planes pendientes para superior y RRHH
- Alertas de deadline no cumplido
- Historial de planes anteriores (archivo)

### Fase 7 — Cambios operativos (overrides puntuales)
- Callable `registrarCambioTurno` para que el jefe modifique un dia especifico
- Escribe en `asistencia_diaria` con `es_override_manual: true` + `override_motivo`
- UI: desde la GSO, click en un dia → modal de cambio de turno
- Log de cambios para auditoria

### Fase 8 — Glosario y manual de uso (rol RRHH)
- Glosario de terminos con definiciones claras para usuario RRHH:
  - Regimen horario, tipo patron (fijo/rotativo/planificado), turno, franco, guardia
  - Plan de turnos, plan perpetuo, plan mensual, estados (borrador/enviado/habilitado)
  - Override, reemplazo vs adicional, fecha ancla, ciclo, paleta de turnos
  - Reglas de planificacion, capa teorica, divergencia, fichada
- Manual de configuracion paso a paso:
  - Como crear un regimen fijo (ej: administrativo 7hs L-V)
  - Como crear un regimen rotativo (ej: enfermeria 2x2)
  - Como crear un regimen planificado (paleta M/T/N + reglas)
  - Como asignar un regimen a un agente en HLg
  - Como cambiar el regimen de un agente (cierre + apertura de periodo HLg)
- Manual de planificacion mensual para jefes:
  - Como armar la grilla del mes (asignar turnos, ver licencias, ver cobertura)
  - Como enviar para aprobacion
  - Como hacer un cambio de turno durante el mes (override desde GSO)
- Manual de aprobacion para RRHH:
  - Bandeja de planes pendientes
  - Como habilitar o rechazar un plan
  - Como gestionar alertas de deadline no cumplido
  - Como gestionar overrides fantasma en re-habilitacion
- Implementacion: componente modal flotante (`HelpModal` o `GlossaryDrawer`) accesible desde las pantallas de configuracion y planificacion con icono de ayuda contextual

### Fase 9 — Conexion con Motor V2
- Motor usa `resolverTurnoDia` para obtener `horas_efectivas` del dia solicitado
- Si `es_jornada_completa=true`: `horas_a_descontar = turno_teorico.horas_efectivas`
- Si `es_jornada_completa=false`: `horas_a_descontar = horas_solicitadas` (input del agente)
- Nuevo campo en `motor_snapshot`: `horas_jornada_dia`, `justifica_dia_completo`, `es_nocturno`, `cruza_medianoche`
- Check bloqueante `SIN_REGIMEN_HORARIO` si el agente no tiene regimen asignado en HLg
- Check bloqueante `SIN_TURNO_DIA` si `resolverTurnoDia` no encuentra turno para la fecha
- Validacion horaria para ausencias parciales (`es_jornada_completa=false`):
  - La solicitud debe tener `hora_inicio` / `hora_fin` (nuevos campos)
  - Fase G compara rango solicitado contra ingreso/egreso del turno
  - Si rango esta dentro del turno: OK
  - Si rango esta fuera del turno: warning `HORARIO_FUERA_DE_TURNO`
  - Si rango excede parcialmente: warning `HORARIO_EXCEDE_TURNO`
- Validacion de superposicion intra-dia para Patron C:
  - Cuando `es_jornada_completa=false`, dos solicitudes parciales en el mismo dia
    se comparan por rango horario (hora_inicio/hora_fin), no solo por dia calendario
  - Elimina falsos positivos del validador actual (que compara dias completos)

---

## Preguntas resueltas

- **Nocturnidad:** se imputa al dia de ingreso
- **Cambios de turno:** override manual del jefe con flag `es_override_manual`
- **Agentes sin regimen:** motor falla con check bloqueante `SIN_REGIMEN_HORARIO` (obliga a asignar)
- **Medico mixto (2 servicios):** regimen en HLg permite distinto regimen por grupo (consultorio en Clinica + guardia en Emergencias)
- **Guardias rotativas:** se modelan como rotativo, no como fijo
- **Enfermeria con turnos variables:** patron planificado, jefe arma la grilla mensual con paleta M/T/N
- **Turno partido:** extension futura (`turnos[]` en vez de `turno`)
- **Nivel del plan:** por servicio/grupo (el jefe arma TODO su equipo en un solo plan)
- **Autorizacion RRHH:** siempre, para todos los tipos (fijos y planificados)
- **Servicios huerfanos:** sin superior, van directo a RRHH
- **Deadline de envio:** configurable por RRHH, no hardcodeado
- **Plan perpetuo:** se crea una vez, vigencia_hasta null = sin fin. Al modificar se cierra y crea nuevo.
- **Vigencia del regimen en HLg:** usa fecha_inicio/fecha_fin existentes de HLg. Cambio de regimen = cerrar HLg viejo + abrir HLg nuevo.
- **Rechazo de plan:** vuelve a BORRADOR con observaciones. El jefe corrige y reenvia.
- **Archivo historico:** planes habilitados son inmutables, se archivan despues de 3-6 meses
- **Proyeccion:** bajo demanda (sin batch). resolverTurnoDia calcula al vuelo.
- **carga_por_dia_semana en HLg:** se mantiene como "contrato" de horas, complementario al regimen
- **Fichadas:** campos de tolerancia y banda ya contemplados para integracion futura
- **Cantidad de moldes:** ilimitados. Coleccion Firestore sin tope. RRHH crea los que necesite.
- **No hardcoding:** tipo_patron (3 valores) y tipo_dia (4 valores) son estructurales. Todo lo demas es configurable.
- **Doble guardia urgente:** overrides como array con tipo "reemplazo" o "adicional". No sobrescribe turno teorico.
- **Licencias al armar turno:** UI muestra solicitudes desde estado inicial (aprobadas=bloqueadas, pendientes=warning, rechazadas=no visibles).
- **Turno parcial/incompleto:** el jefe puede dejar dias sin asignar. Dias sin turno rechazan solicitudes.
- **Reglas de planificacion:** son warnings, no bloqueos. Cubre incorporaciones a mitad de mes.
- **Horario fuera de turno:** Fase G valida hora_inicio/hora_fin contra turno cuando es_jornada_completa=false.
- **Superposicion intra-dia:** para ausencias parciales, se comparan rangos horarios, no dias completos.
- **Divergencias plan vs realidad:** jefe justifica, RRHH valida. Detalle del flujo se define con modulo de fichadas.
- **Fichada silenciosa:** no hace falta como concepto separado. El override "adicional" ya divide el dia en segmentos contables.
- **Enfermero que trabaja doble turno:** override adicional si era conocido. Si no, la fichada captura la realidad y genera alerta.
- **Override fantasma tras re-planificacion:** al re-habilitar un plan, se invalidan overrides existentes previa advertencia a RRHH. Quedan como auditoria.

## Capas de asistencia_diaria y prioridad de fusion

El RDA (`asi_<personaId>_<YYYYMMDD>`) tiene estas capas:

1. `capa_teorica` — que DEBERIA pasar (calculado por `resolverTurnoDia`, o override manual)
2. `aportes_normativos` — que CAMBIO por licencia/ausencia (viene de los motores de solicitud)
3. `fichadas` — que PASO realmente (futuro: reloj/biometrico)
4. `estado_consolidado` — resultado del MDC que fusiona todo con prioridad

Prioridades (peso):
- 100: Suspension/sancion
- 90: Licencia normativa (LAO Art 14-A, compensatorio Art 68-B, etc.)
- 80: Franco/descanso del regimen
- 70: Presente (fichada confirmada)
- 10: Ausencia injustificada (default)

## Evolución — turnos compuestos (2026-05-27)

- RFC: [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) — paleta dinámica del régimen (sin M/T/N fijos en contrato), combinaciones canónicas, cobertura parcial.
- Catálogos: [`DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md`](./DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md).
- Tag: `v2.0.0-rfc-turnos-compuestos`.

---

## Gaps documentales a resolver (al implementar)

1. Arquitectura Maestra: actualizar seccion de `horario_plantilla` para reflejar el catalogo de regimenes
2. ~~Schema Zod formal para `capa_teorica`~~ → **En curso:** `web/src/schemas/capaTeoricaSegmentos.schema.js` (ver epic turnos compuestos)
3. RFC formal para planificacion mensual (Epic P) unificado con este plan
4. Auditoria motor: retomar los 16 gaps identificados una vez definida jornada completa
5. Superposicion por horas: resolver falsos positivos en validador (compara dias, no franjas horarias)
