---
name: Capa teorica plan maestro
overview: "Plan maestro para construir la capa teorica completa: materializar turno teorico en la RDA, visualizar el cronograma del agente y del equipo, integrar con la capa de licencias existente, y mejorar la grilla del jefe (fix bug, paleta dinamica, selects, vigencia, warnings)."
todos:
  - id: fase0a-fix-resolver
    content: "Fix bug critico en resolverPlanificado: leer plan.agentes[i].dias[ymd] + agregar personaId"
    status: completed
  - id: fase0b-tolerancias
    content: Agregar tolerancia_ingreso/egreso al EditorPlanificado en RegimenHorarioForm.jsx
    status: completed
  - id: fase1a-worker-core
    content: "Crear rdaTurnoTeoricoWorker.js con materializarTurnoMesBatch optimizado — evolucionado a fusion multi-HLG"
    status: completed
  - id: fase1b-grupo
    content: "Crear materializarGrupoMes con dedup de regimenes compartidos y paralelismo controlado (chunks de 5 agentes)"
    status: completed
  - id: fase1c-triggers
    content: "Triggers bloqueantes (await) en: habilitarPlan, cerrarPlan, guardarHLG, deshabilitarHLG, registrarCambioTurno, eliminarCambioTurno"
    status: completed
  - id: fase1d-auto-fijo-rotativo
    content: "Materializacion automatica al guardar HLG fijo/rotativo: mes actual + siguiente. Desbloquea Gate 1 para depende_rda=true."
    status: completed
  - id: fase2a-callable-contexto
    content: Crear callable listarContextoPlanGrupo que retorne personas del grupo + regimenes
    status: completed
  - id: fase2b-paleta-dinamica
    content: Eliminar TURNOS_COLOR hardcodeado, derivar paleta desde regimen.turnos_disponibles
    status: completed
  - id: fase2c-selects
    content: Reemplazar text inputs por selects dinamicos (grupo, persona, regimen/hlg auto-resueltos)
    status: completed
  - id: fase2d-grilla-vacia
    content: Reemplazar crearGrillaVacia hardcodeada por inicializacion limpia o pre-populada desde regimen
    status: completed
  - id: fase3a-helpers
    content: Crear helpers esDiaEnVigenciaHlg y esDiaAsignadoAlGrupo
    status: completed
  - id: fase3b-corte-visual
    content: "Implementar hard block visual: celdas fuera vigencia disabled + hatching + turnos huerfanos"
    status: completed
  - id: fase3c-dias-asignados
    content: "Implementar soft warning visual: zona blanca/gris/naranja segun patron regimen"
    status: completed
  - id: fase3d-validacion-backend
    content: Validar vigencia HLG (error) + patron regimen (warning) + consecutivos (warning) al enviar plan
    status: completed
  - id: fase4a-calendario-agente
    content: "Mostrar rda_turno_id y es_franco en GrillaMesTitularCalendario — formato calendario Lun-Dom"
    status: completed
  - id: fase4b-vista-equipo
    content: "Mostrar turno teorico en GrillaMesEquipoTabla — encabezados dia semana + resaltado fines de semana"
    status: completed
  - id: fase4c-detalle-dia
    content: Agregar seccion turno teorico en DiaGrillaDetalleModal
    status: completed
  - id: fase5a-override-vis
    content: Que registrarCambioTurno y eliminarCambioTurno disparen materializacion del dia
    status: completed
  - id: fase5b-gate-rda
    content: Verificar que grillaTurnoEntornoGate funcione automaticamente con capa_teorica materializada
    status: completed
  - id: bugfix-fire-and-forget
    content: "BUG FIX: void (fire-and-forget) -> await. Cloud Functions Gen2 congela instancia post-return."
    status: completed
  - id: bugfix-set-vs-update
    content: "BUG FIX: batch.set() con dot-notation no interpreta paths anidados. Cambiar a visRef.update()."
    status: completed
  - id: bugfix-turno-id-missing
    content: "BUG FIX: buildTurnoResponse no incluia turno_id. Agregado para planificados."
    status: completed
  - id: bugfix-multi-hlg
    content: "BUG FIX: materializacion single-HLG sobrescribia vis_*. Refactorizado a fusion multi-HLG."
    status: completed
  - id: ui-calendario-formato
    content: "UI: Calendario titular como grid Lun-Dom con offset dia 1. Tabla equipo con encabezados dia semana."
    status: completed
isProject: false
---

> **Continuidad (28/05/2026):** snapshot histórico del plan aprobado en `planes_turno_servicio.grilla_aprobada` — ver [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md) y [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) (matriz control asi/vis vs VER plan antes de fichadas).


# Plan Maestro: Capa Teorica de Asistencia

## Estado actual

La arquitectura tiene dos capas en la RDA (`asistencia_diaria` + `vistas_grilla_mes_agente`):

- **Capa de solicitudes (MDC)**: Materializada y funcional. Los eventos de licencias/articulos se proyectan a `asi_*.aportes_normativos` y fan-out a `vis_*.dias[dd].eventos[]`. Pipeline event-driven completo.
- **Capa teorica (turno del dia)**: Motor de resolucion existe (`resolverTurnoDia`) pero NO materializa. Los campos `rda_turno_id` y `es_franco` en `vis_*` son slots vacios. El agente no puede ver su cronograma. El jefe no ve los turnos del equipo superpuestos con licencias.

```mermaid
flowchart TD
    subgraph existente [Existe y funciona]
        MDC["Pipeline MDC: solicitudes/licencias"]
        Resolver["resolverTurnoDia() bajo demanda"]
        Planes["planes_turno_servicio + maquina de estados"]
        Overrides["overrides_turno en asi_*"]
        GrillaLic["Calendario licencias (solo eventos)"]
    end
    subgraph construir [A construir]
        Materializacion["Materializar rda_turno_id + es_franco"]
        Triggers["Triggers reactivos: plan habilitado, HLG cambia, override, calendario"]
        VistaAgente["Vista agente: mi cronograma teorico"]
        VistaJefe["Vista jefe: turnos equipo + licencias"]
        GrillaJefeV2["Grilla jefe: paleta dinamica, selects, vigencia, warnings"]
        FixBug["Fix resolverPlanificado"]
        Tolerancias["Tolerancias en regimen planificado"]
    end
    Resolver --> Materializacion
    Materializacion --> Triggers
    Triggers --> VistaAgente
    Triggers --> VistaJefe
```

---

## Fase 0: Fixes criticos y deuda tecnica

### 0A. Fix bug `resolverPlanificado`

**Archivo**: [functions/modules/asistencia/resolverTurnoDia.js](functions/modules/asistencia/resolverTurnoDia.js) (L135-171)

Bug: lee `plan.asignaciones[fechaYmd]` que no existe. El plan almacena `plan.agentes[i].dias[ymd]`. Ademas falta `personaId` en la firma.

Fix:
1. Agregar `personaId` a firma y al caller (L312)
2. Buscar `plan.agentes[].find(a => a.persona_id === personaId).dias[fechaYmd]`

### 0B. Tolerancias en formulario planificado

**Archivo**: [web/src/pages/rrhh/regimenes/RegimenHorarioForm.jsx](web/src/pages/rrhh/regimenes/RegimenHorarioForm.jsx)

Agregar `tolerancia_ingreso_min` y `tolerancia_egreso_min` al `EditorPlanificado`. Schema y backend ya los soportan.

---

## Fase 1: Materializacion de la capa teorica

### Contexto critico: la materializacion NO es solo visual

El motor de licencias tiene dos gates secuenciales. El **Gate 1** (`evaluarGrillaTurnoEntorno`) bloquea solicitudes con `depende_rda=true` si no encuentra `capa_teorica` en `asi_*` ni plan HABILITADO. Para regimenes fijo y rotativo, `resolverTurnoDia` puede calcular on-demand, pero el Gate 1 lo bloquea antes de que el Gate 2 pueda resolverlo.

```mermaid
flowchart LR
    Solicitud["Solicitud licencia"] --> Gate1["Gate 1: Grilla RDA"]
    Gate1 -->|"depende_rda=false"| Bypass["Bypass"]
    Gate1 -->|"depende_rda=true"| Busca["Busca plan HABILITADO O capa_teorica en asi_*"]
    Busca -->|"NO encontrado"| Bloqueado["GRILLA_NO_AUTORIZADA"]
    Busca -->|"encontrado"| Gate2["Gate 2: Turno Regimen (solo Patron C)"]
    Gate2 -->|"resolverTurnoDia OK"| OK["Habilitada"]
```

**Sin materializacion: fijo/rotativo con `depende_rda=true` quedan bloqueados.**
**Con materializacion: los tres tipos funcionan con ambos gates.**

### 1A. Funcion core: `materializarTurnoMesBatch`

**Archivo nuevo**: `functions/modules/asistencia/rdaTurnoTeoricoWorker.js`

**Diseño optimizado** para minimizar lecturas Firestore. En vez de llamar `resolverTurnoDia` 30 veces (que repite reads de HLG/regimen/calendario cada vez), la funcion batch pre-carga los datos compartidos una sola vez:

```
materializarTurnoMesBatch({ personaId, grupoId, anio, mes })

1. PRE-CARGA (1 vez por agente/mes):
   - HLG vigente: 1 query
   - cfg_regimen_horario: 1 read
   - Calendario institucional: 0 reads (cache 5min existente)
   - Plan habilitado (si planificado): 1 query
   Total: ~3 reads

2. POR CADA DIA del mes (30 iteraciones):
   - Override (asi_*): 1 read  ← unico dato per-dia
   - Resolucion: computo puro (fijo=weekday, rotativo=modulo, planificado=lookup en plan pre-cargado)
   Total: 30 reads

3. ESCRITURAS en batch:
   - 30 writes a asi_*.capa_teorica (via db.batch())
   - 1 write a vis_*.dias (merge con 30 claves)
   Total: 31 writes

TOTAL POR AGENTE/MES: ~33 reads + 31 writes = 64 operaciones
```

**Comparacion sin optimizacion** (llamar `resolverTurnoDia` x30): ~180 reads + 31 writes = 211 operaciones. **Ahorro: 70%.**

**Estructura de `capa_teorica` en `asi_*`:**
```
capa_teorica: {
  tipo_dia, turno_id, ingreso, egreso, horas_efectivas,
  es_nocturno, es_feriado, origen, regimen_horario_id, plan_id
}
```

**Campos en `vis_*.dias[dd]`:**
- `rda_turno_id` = turno_id resuelto (o null si franco)
- `es_franco` = tipo_dia in ("franco", "no_laborable")

Reutiliza `buildVisDocumentId` y el patron `{...prev}` de `mdcFanOutVis.js` para preservar los `eventos[]` existentes.

### 1B. Funcion grupo: `materializarGrupoMes`

Wrapper que materializa un grupo completo para un mes. Optimizaciones adicionales:

- **Regimenes deduplicados**: si 15 de 20 agentes comparten el mismo regimen, se lee 1 vez (Map cache)
- **Calendario**: ya cacheado por el servicio existente (TTL 5min)
- **Paralelismo controlado**: `Promise.all` en chunks de 5 agentes para no saturar Firestore

```
materializarGrupoMes({ grupoId, anio, mes })

1. Query HLGs activos del grupo: 1 query → N agentes
2. Dedup regimenes: M reads (M <= N, tipicamente M = 2-3)
3. Plan habilitado (si planificado): 1 query
4. Por agente: materializarTurnoMesBatch (30 reads + 31 writes)

TOTAL GRUPO 20 AGENTES, 3 REGIMENES:
  Reads: 1 query + 3 regimenes + 20×30 overrides = ~604 reads
  Writes: 20×31 = 620 writes
  Total: ~1,224 operaciones (vs ~4,220 sin optimizar)
```

### 1C. Triggers de materializacion

| Evento | Trigger | Scope | Operaciones estimadas |
|--------|---------|-------|----------------------|
| Plan pasa a HABILITADO | Post-`habilitarPlanTurnoServicio` | Agentes del plan × dias del mes | 20 agentes: ~1,224 ops |
| Plan pasa a CERRADO | Post-`cerrarPlanPerpetuo` | Dias post-cierre x agentes | Variable, max ~1,224 ops |
| HLG guardado (regimen cambia) | Post-`guardarRegistroLaboralTemporal` (rama HLG) | 1 agente × mes actual | ~64 ops |
| HLG deshabilitado | Post-`rrhhDeshabilitarHlg` | 1 agente × mes vigencia | ~64 ops |
| Override registrado | Post-`registrarCambioTurno` | 1 dia | ~2 ops (1 read + 1 write) |
| Override eliminado | Post-`eliminarCambioTurno` | 1 dia | ~2 ops |

Implementacion: llamadas fire-and-forget (async sin await) al final de cada callable, similar al patron `dispararMdcDesdeSolicitudAsync` existente.

**NO se triggerea por cambio de calendario institucional** (impacto masivo, se maneja con job batch manual/programado).

### 1D. Materializacion automatica para fijo/rotativo

Para regimenes fijo y rotativo, la materializacion se dispara al guardar/modificar el HLG. Como el patron es deterministico (no depende de un plan mensual), se puede materializar el mes actual y el proximo automaticamente:

- Al guardar HLG con regimen fijo/rotativo → materializar mes actual + mes siguiente (2 × 64 = ~128 ops por agente)
- Al inicio de cada mes (job programado o lazy al primer acceso) → materializar el mes nuevo

---

## Fase 2: Grilla del jefe — paleta dinamica y selects

### 2A. Callable de contexto: `listarContextoPlanGrupo`

**Archivo**: [functions/modules/asistencia/planesTurnoServicio.js](functions/modules/asistencia/planesTurnoServicio.js)

Nuevo callable que dado `{ grupo_id, periodo }` retorna:
- `personas_grupo[]`: HLGs activos del grupo con persona_id, persona_label, hlg_id, regimen_horario_id, fecha_inicio, fecha_fin, regimen_fecha_ancla
- `regimenes{}`: Map de documentos cfg_regimen_horario referenciados (con turnos_disponibles, dias, ciclo, etc.)

### 2B. Paleta dinamica de turnos

**Archivo**: [web/src/pages/jefe/planes/GrillaMensualEditor.jsx](web/src/pages/jefe/planes/GrillaMensualEditor.jsx)

Eliminar `TURNOS_COLOR` hardcodeado. Derivar paleta desde `regimen.turnos_disponibles[]` (union de todos los regimenes del plan). Colores por indice desde paleta base. Franco como opcion universal.

### 2C. Selects dinamicos

**Archivos**:
- [web/src/pages/jefe/PlanTurnoServicioPage.jsx](web/src/pages/jefe/PlanTurnoServicioPage.jsx) — `grupo_id` como select
- [web/src/pages/jefe/planes/GrillaMensualEditor.jsx](web/src/pages/jefe/planes/GrillaMensualEditor.jsx) — persona como select, regimen/hlg auto-resueltos
- [web/src/pages/jefe/planes/PlanPerpetualViewer.jsx](web/src/pages/jefe/planes/PlanPerpetualViewer.jsx) — idem

### 2D. Grilla vacia inteligente

Reemplazar `crearGrillaVacia` (que hardcodea "M" en dias de semana) por inicializacion limpia: todas las celdas como franco. Opcionalmente, pre-popular desde el patron del regimen para fijo/rotativo.

---

## Fase 3: Corte visual y warnings en grilla del jefe

### 3A. Helpers de estado de celda

Funciones puras:
- `esDiaEnVigenciaHlg(fechaYmd, fechaInicio, fechaFin)` — hard block
- `esDiaAsignadoAlGrupo(regimen, fechaYmd, fechaAncla)` — soft warning (fijo/rotativo)

### 3B. Corte visual por vigencia HLG (Hard Block)

Celdas fuera de vigencia: `disabled`, patron rayado (CSS hatching), tooltip con fechas. Turnos huerfanos visibles pero inertes.

### 3C. Identificacion de dias asignados (Soft Warning)

4 estados visuales:
- Bloqueada (fuera vigencia): hatching gris, disabled
- Zona blanca (asignado): editable normal
- Zona gris claro (no asignado/franco contractual): editable con warning
- Excepcion (turno en zona gris): color turno + borde naranja

Planificado: toda la vigencia es blanca.

### 3D. Validacion backend al enviar plan

Extender `validarReglasContraRegimen` en [planesTurnoServicio.js](functions/modules/asistencia/planesTurnoServicio.js):
- `PLT-VIG-E001`: turno fuera de vigencia HLG — **error** (bloquea envio)
- `PLT-REG-W010`: turno en dia no asignado segun regimen — **warning**
- `PLT-REG-W003`: `max_consecutivos_trabajo` excedido — **warning**
- `PLT-REG-W004`: `min_consecutivos_franco` insuficiente — **warning**

---

## Fase 4: Visualizacion del turno teorico

### 4A. Enriquecer calendario del agente (modo TITULAR)

**Archivo**: [web/src/features/grilla/GrillaMesTitularCalendario.jsx](web/src/features/grilla/GrillaMesTitularCalendario.jsx)

Cada celda del calendario muestra actualmente solo los eventos de licencia. Agregar la capa teorica:
- Si `rda_turno_id` existe: mostrar etiqueta del turno (M/T/N) en una esquina de la celda
- Si `es_franco`: celda con fondo gris claro
- Si hay evento de licencia superpuesto: el turno teorico aparece tachado o en segundo plano
- Tooltip enriquecido: "Turno: Manana 07:00-14:00 | Licencia: Art. 64-A aprobada"

### 4B. Enriquecer vista de equipo (modo EQUIPO)

**Archivo**: [web/src/features/grilla/GrillaMesEquipoTabla.jsx](web/src/features/grilla/GrillaMesEquipoTabla.jsx)

Celdas de la tabla persona x dia:
- Fondo base = color del turno teorico (amarillo=M, azul=T, etc.)
- Si hay licencia superpuesta: icono/badge del codigo de licencia sobre el color del turno
- Si es franco: fondo gris
- Jefe ve de un vistazo: quien trabaja, en que turno, quien tiene licencia

### 4C. Detalle del dia

**Archivo**: [web/src/features/grilla/DiaGrillaDetalleModal.jsx](web/src/features/grilla/DiaGrillaDetalleModal.jsx)

Agregar seccion "Turno teorico" al modal de detalle del dia:
- Tipo de dia (laborable/guardia/franco)
- Turno: ID + etiqueta + horario (ingreso/egreso)
- Horas efectivas
- Origen (regimen fijo / plan mensual / override)
- Si hay override: mostrar turno original + override

---

## Fase 5: Integracion y consistencia

### 5A. Override actualiza vista materializada

Modificar `registrarCambioTurno` y `eliminarCambioTurno` en [cambiosTurno.js](functions/modules/asistencia/cambiosTurno.js) para que, post-escritura en `asi_*`, disparen `materializarTurnoTeoricoDia` para el dia afectado. Esto actualiza `rda_turno_id` en `vis_*`.

### 5B. `grillaTurnoEntornoGate` funciona automaticamente

Una vez materializada la capa teorica en `asi_*.capa_teorica`, el gate que valida entorno operativo para solicitudes (`depende_rda: true`) funcionara sin cambios adicionales.

---

## Orden de ejecucion sugerido

```mermaid
flowchart LR
    F0["Fase 0: Fixes criticos"] --> F1["Fase 1: Materializacion"]
    F0 --> F2["Fase 2: Grilla jefe (paralelo)"]
    F1 --> F4["Fase 4: Visualizacion"]
    F2 --> F3["Fase 3: Corte y warnings"]
    F1 --> F5["Fase 5: Integracion"]
    F4 --> F5
```

Fase 0 es prerequisito de todo. Fases 1 y 2 pueden avanzar en paralelo. Fase 3 depende de 2. Fase 4 depende de 1. Fase 5 integra ambos tracks.

## Archivos impactados (resumen)

**Backend**:
- `functions/modules/asistencia/resolverTurnoDia.js` — fix resolverPlanificado
- `functions/modules/asistencia/planesTurnoServicio.js` — callable contexto + validaciones + trigger materializacion
- `functions/modules/asistencia/cambiosTurno.js` — trigger materializacion post-override
- `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` — **nuevo**: core de materializacion
- `functions/modules/catalogosLaborales.js` — trigger materializacion post-guardar HLG
- `functions/modules/catalogosRegimenHorario.js` — (futuro: trigger si regimen cambia)

**Frontend**:
- `web/src/pages/rrhh/regimenes/RegimenHorarioForm.jsx` — tolerancias planificado
- `web/src/pages/jefe/PlanTurnoServicioPage.jsx` — selects, carga contexto
- `web/src/pages/jefe/planes/GrillaMensualEditor.jsx` — paleta dinamica, selects, vigencia, warnings
- `web/src/pages/jefe/planes/PlanPerpetualViewer.jsx` — selects dinamicos
- `web/src/features/grilla/GrillaMesTitularCalendario.jsx` — turno teorico en calendario agente
- `web/src/features/grilla/GrillaMesEquipoTabla.jsx` — turno teorico en vista equipo
- `web/src/features/grilla/DiaGrillaDetalleModal.jsx` — detalle turno teorico

## Analisis de impacto en lecturas Firestore

### Costos actuales (baseline)

| Operacion | Reads hoy |
|-----------|-----------|
| `listarVistaGrillaMesPorGrupo` (20 agentes) | ~80 reads |
| `validarEntornoOperativoSolicitud` (1 solicitud) | ~8-12 reads |
| `resolverTurnoDia` (1 dia) | ~5 reads (sin cache) |
| `habilitarPlanTurnoServicio` (20 agentes × 30 dias, overrides fantasma) | ~600 reads (secuenciales!) |
| `DatosLaborales.jsx` al montar (19 colecciones) | ~19 queries |

### Costos nuevos (con materializacion)

| Operacion | Reads | Writes | Cuando ocurre |
|-----------|-------|--------|---------------|
| Materializar 1 agente × 1 mes | ~33 | 31 | Al guardar HLG / habilitar plan |
| Materializar grupo 20 × 1 mes | ~604 | 620 | Al habilitar plan |
| Re-materializar 1 agente (cambio HLG) | ~33 | 31 | Al editar HLG |
| Override puntual (1 dia) | ~1 | 2 | Al registrar/eliminar override |
| `listarContextoPlanGrupo` (20 agentes) | ~43 | 0 | Al abrir editor grilla |

### Estrategias de optimizacion aplicadas

**1. Pre-carga con deduplicacion** (Fase 1A): HLG, regimen y calendario se leen 1 vez por agente/mes en vez de 30. **Ahorro 70%** en reads de materializacion.

**2. `db.batch()` para escrituras**: Los 30 writes de `asi_*` se ejecutan en 1 batch atomico en vez de 30 transacciones individuales.

**3. Regimenes compartidos**: Si 15 agentes comparten el mismo regimen, se lee 1 doc en vez de 15. Cache Map within request.

**4. Materializacion lazy para fijo/rotativo**: Solo se materializa el mes actual + siguiente. Los meses futuros se calculan on-demand si son necesarios (el Gate 2 resuelve sin materializacion).

**5. Visualizacion sin reads adicionales**: El calendario del agente (`GrillaMesTitularCalendario`) ya lee `vis_*` — los campos `rda_turno_id` y `es_franco` llegan gratis, sin lecturas extra.

**6. `listarContextoPlanGrupo` unico**: El callable carga personas + regimenes en 1 invocacion (~43 reads). El frontend no necesita llamadas adicionales para la paleta dinamica, vigencia HLG ni selects.

### Operaciones que NO agregan reads al frontend

- Visualizacion del turno teorico en calendario agente: **0 reads extra** (ya lee vis_*)
- Visualizacion del turno teorico en vista equipo: **0 reads extra** (ya lee vis_*)
- Corte visual por vigencia: **0 reads extra** (datos vienen en `listarContextoPlanGrupo`)
- Dias asignados por regimen: **0 reads extra** (computo puro en frontend con datos pre-cargados)

## Checklist tecnico para codificacion (Fase 1)

### Gestion de fechas y zonas horarias

El worker `materializarTurnoMesBatch` itera dias del mes. Riesgos: transiciones de horario de verano, offsets UTC, saltos/duplicaciones de dias al usar `Date` nativo.

**Regla**: trabajar estrictamente con strings `YYYY-MM-DD` para el bucle. El sistema ya usa `fechaInstitucionalBa.js` con zona fija `America/Argentina/Buenos_Aires` (UTC-3). Generar el array de dias del mes con aritmetica de strings, no instanciando `new Date()` para cada iteracion. Patron existente a reutilizar: `diasDelMes()` en `GrillaMensualEditor.jsx` (L12-22).

### Idempotencia de los batches

Si el worker corre dos veces para el mismo agente/mes (retry, timeout, duplicacion de trigger), no debe sobreescribir destructivamente los `eventos[]` del MDC que ya existan en `vis_*`.

**Regla**: la escritura a `vis_*.dias[dd]` debe usar `{ merge: true }` y solo escribir `rda_turno_id` y `es_franco`, preservando `eventos[]` y `tiene_conflicto` intactos. El patron `{...prev}` de `mdcFanOutVis.js` ya hace esto — reutilizar la misma tecnica de transaccion+merge.

Para `asi_*.capa_teorica`: usar `update` con dot-notation (`"capa_teorica.tipo_dia": valor`) en vez de `set` sobre el documento completo, para no destruir `aportes_normativos` ni `overrides_turno`.

### Manejo de fallos en chunks

`materializarGrupoMes` procesa agentes en chunks de 5 via `Promise.all`. Si un chunk falla (error de red, timeout), los demas chunks deben continuar.

**Regla**: envolver cada chunk en `Promise.allSettled` en vez de `Promise.all`. Recolectar errores en un array `fallos[]` y retornarlos en el resultado. Los agentes fallidos se pueden reintentar individualmente sin re-procesar todo el grupo.

```javascript
for (const chunk of chunks) {
  const resultados = await Promise.allSettled(
    chunk.map(ag => materializarTurnoMesBatch({ ...ag, anio, mes }))
  );
  for (const r of resultados) {
    if (r.status === "rejected") fallos.push({ agente: ag, error: r.reason });
  }
}
```

### Limite de 500 escrituras por batch Firestore

Cada agente genera 31 writes (30 `asi_*` + 1 `vis_*`). Un chunk de 5 agentes = 155 writes, holgadamente bajo el limite de 500. No agrupar mas de 15 agentes por batch (15 × 31 = 465).

## Bugs descubiertos y corregidos durante implementacion

### BUG-1: Fire-and-forget en Cloud Functions Gen2 (critico)

**Descubierto**: 2026-05-26. La materializacion usaba `void Promise.allSettled(...)` (fire-and-forget) antes del `return` del callable. En Cloud Functions Gen2 (Cloud Run), la instancia se congela inmediatamente despues de enviar la respuesta HTTP. Las promesas pendientes nunca completaban.

**Sintoma**: El callable retornaba `{ ok: true }` pero los documentos `vis_*` y `asi_*` nunca se actualizaban.

**Fix**: Cambiar `void` a `await` en 6 puntos de 3 archivos:
- `catalogosLaborales.js`: guardarRegistroLaboralTemporal (HLG save) + rrhhDeshabilitarHlg
- `planesTurnoServicio.js`: habilitarPlanTurnoServicio + cerrarPlanPerpetuo
- `cambiosTurno.js`: registrarCambioTurno + eliminarCambioTurno

**Impacto en UX**: El guardado tarda ~2-5s mas (incluye materializacion), pero garantiza que los datos estan escritos.

### BUG-2: `batch.set()` no interpreta dot-notation como paths (critico)

**Descubierto**: 2026-05-26. El worker usaba `batch.set(visRef, { "dias.01.rda_turno_id": val }, { merge: true })`. En Firestore Admin SDK, `set()` trata las keys con dots como nombres de campo **literales**, no como paths anidados. Solo `update()` interpreta dot-notation.

**Sintoma**: Los logs mostraban materializacion exitosa (`["fulfilled","fulfilled"]`) pero el calendario no mostraba datos. Los campos se guardaron como `"dias.01.rda_turno_id"` (string plano) en vez de `dias -> 01 -> rda_turno_id` (anidado).

**Fix**: Separar la escritura vis_* del batch asi_*. Usar `visRef.update(visDias)` que SI interpreta dot-notation. Fallback a `visRef.set()` con objeto anidado si el documento no existe.

**Regla para futuro**: NUNCA usar `set({ merge: true })` con keys que contengan dots para paths anidados. Usar `update()` o construir el objeto anidado manualmente.

### BUG-3: `buildTurnoResponse` no incluia `turno_id` (menor)

**Descubierto**: 2026-05-26. La funcion que normaliza la respuesta del turno omitia `turno_id`, impidiendo que regimenes planificados propagaran la etiqueta (M, T, N).

**Fix**: Agregar `turno_id: turno.turno_id || null` a `buildTurnoResponse()` en `resolverTurnoDia.js`.

### BUG-4: Materializacion single-HLG sobrescribia todos los dias (arquitectural)

**Descubierto**: 2026-05-26. `materializarTurnoMesBatch` resolvia un solo HLG (por grupo) y escribia TODOS los dias del mes desde esa perspectiva. Para una persona con 2 HLG (Oficina Personal Lun-Mie + Porteria Jue-Vie), el ultimo guardado pisaba los datos del otro, marcando sus dias como franco.

**Sintoma**: El calendario solo mostraba turnos del ultimo HLG guardado. Los dias del primer grupo aparecian como "F".

**Fix**: Refactorizar `materializarTurnoMesBatch` a nivel **persona** (no grupo):
1. `obtenerHlgVigenteParaMes` -> `obtenerHlgsVigentesParaMes` (retorna TODOS los HLG activos)
2. Pre-carga de regimenes y planes para TODOS los HLG
3. Para cada dia, iterar todos los HLG: el primer HLG cuyo regimen marque el dia como **laborable/guardia** "gana"
4. Dias sin asignacion de ningun grupo quedan como franco

**Estructura `capa_teorica` enriquecida**: Se agrego `grupo_de_trabajo_id` para saber de que grupo proviene la asignacion de cada dia.

---

## Mejoras de UI implementadas (sesion 2026-05-26)

### Calendario Titular: formato Lun-Dom

**Archivo**: `web/src/features/grilla/GrillaMesTitularCalendario.jsx`

Antes: grid plano de celdas 1-31, sin estructura semanal.
Ahora: calendario real con:
- Grid 7 columnas fijas: Lun - Mar - Mie - Jue - Vie - Sab - Dom
- Celdas vacias (offset) al inicio para alinear dia 1 con su dia de semana real
- Encabezados de columna con nombres de dia
- Sabados y domingos con numeros en rosa y fondo rose-50

### Tabla Equipo: encabezados dia semana + resaltado fines de semana

**Archivo**: `web/src/features/grilla/GrillaMesEquipoTabla.jsx`

Se mantiene layout horizontal (persona x 31 dias). Mejoras:
- Fila de encabezado adicional con letra del dia de semana (L, M, X, J, V, S, D)
- Columnas de sabado/domingo con fondo rosa suave en encabezado y celdas de datos
- Numeros de dia resaltados en rosa para fines de semana

---

## Sesion de debugging: 2026-05-26

### Cronologia

| Hora | Accion | Resultado |
|------|--------|-----------|
| 10:54 | Usuario guarda 2 HLG. Calendario vacio. | Materializacion fire-and-forget no completa (BUG-1) |
| 11:05 | Deploy fix void->await. Usuario re-guarda. | Logs OK pero calendario sigue vacio (BUG-2) |
| 11:10 | Deploy fix set->update para vis_*. Usuario re-guarda. | Calendario muestra turnos! Solo de 1 grupo (BUG-4) |
| 11:17 | Formato calendario solicitado | UI: grid Lun-Dom implementado |
| 11:20 | Encabezados equipo solicitado | UI: tabla equipo con dia semana + finde resaltado |
| 11:21 | Usuario reporta: solo Porteria visible | Diagnosticado BUG-4: multi-HLG fusion |
| 11:28 | Deploy fix multi-HLG fusion | Pendiente re-test con re-guardado de HLG |

### Estado de deploy

Todas las Cloud Functions desplegadas en `southamerica-east1` con los 4 fixes aplicados.
Frontend local actualizado con mejoras de UI.

---

## Auditoria y correcciones — 2026-05-26

### Ola 1: Seguridad (RBAC) + Integridad (Transacciones) — COMPLETADA

**Commit**: `9979829` | **Tag**: `v2-ola1-rbac-transacciones`

- **assertPlanAuth(request, grupoId, accion)**: Helper RBAC en `helpers.js`. RRHH pasa siempre; aprobar/rechazar requiere `tiene_subordinados`; leer/guardar/enviar requiere HLG vigente en el grupo.
- **assertOverrideAuth(request, targetPersonaId)**: RRHH pasa; actor sobre si mismo pasa; o actor es superior jerarquico en grupo comun.
- **RBAC aplicado**: 8 callables de `planesTurnoServicio.js` + 3 de `cambiosTurno.js` (11 total).
- **db.runTransaction()**: 5 transiciones de estado (enviar, aprobar, rechazar, revertir, cerrar). Estado se valida dentro de la transaccion. Operaciones pesadas (materializacion, overrides) fuera de la tx.
- **Flag `runtimeFlags.OPEN_ACCESS_TEMP`** (false): bypass temporal para desarrollo.

### Ola 2: Integridad de datos — COMPLETADA

**Commit**: `a26fa35` | **Tag**: `v2-olas2-3-4-auditoria`

- **C3 — Materializacion fallida post-aprobacion**: Si `materializarGrupoMes` falla, el plan se marca `materializacion_fallida: true` + warning al cliente. No falla silenciosamente.
- **C4 — Race condition vis_* set**: Fallback usa `set({ merge: true })` para evitar sobreescritura entre workers paralelos.
- **C5 — Unicidad grupo+periodo**: Dentro de la transaccion de aprobar, se valida que no exista otro plan HABILITADO para el mismo grupo+periodo. Error `PLT-APR-DUP`.
- **I3 — cerrarPlanPerpetuo**: Re-materializa mes actual + siguiente (antes solo actual).
- **I4 — observaciones_revision**: Se limpian al re-enviar (dentro de transaccion enviar).
- **I5 — listarPlanesPendientesRrhh**: Queries con `.limit(200)` en Firestore.

### Ola 3: Re-materializacion post-cambio de configuracion — COMPLETADA

- **C6 — rematerializarPostCalendario** (nueva callable): RRHH invoca tras cambio de calendario institucional. Invalida cache + re-materializa todos los grupos activos (mes actual + siguiente). Timeout 540s.
- **C7 — rematerializarPostRegimen** (nueva callable): RRHH invoca tras editar un regimen horario. Re-materializa solo los grupos que usan ese regimen (mes actual + siguiente).
- Callables registradas en frontend (`callables.js`).

### Ola 4: UX y limpieza tecnica — COMPLETADA

- **M1 — Fix formato ingreso-egreso**: Nuevo campo `rda_ingreso` en vis_*. Calendarios muestran "08:00–14:00" (antes "M–14:00").
- **M2 — Prop turnoTeorico conectada al modal**: `GrillaMesLicenciasPanel` pasa datos de turno teorico al `DiaGrillaDetalleModal`.
- **M5 — BadgeEstadoPlan extraido**: Componente compartido en `components/ui/BadgeEstadoPlan.jsx`. Eliminada duplicacion.
- **M6 — Modal revertir**: `window.prompt` reemplazado por modal propio con textarea y validacion.
- **I8 — AUTORIZADO_SUPERIOR eliminado**: Schema Zod actualizado a `EN_REVISION`, helpContent corregido, acciones de aprobacion actualizadas.

### Hallazgos de auditoria NO implementados (a futuro)

- **I1**: `materializarTurnoTeoricoDia` es alias de `materializarTurnoMesBatch` — podria optimizarse para un solo dia.
- **I2**: `rrhhDeshabilitarHlg` solo re-materializa mes actual (falta mes siguiente).
- **I7**: Gates `grillaTurnoEntornoGate` y `turnoRegimenGate` con criterio divergente para EN_REVISION.
- **M3**: Touch targets por debajo de 44px en GrillaMensualEditor y GrillaMesEquipoTabla.
- **M4**: Boton "quitar agente" invisible en mobile (opacity-0 group-hover).

---

## PUNTO DE PAUSA — 2026-05-26 21:18 ART

### Estado actual

- **Backend**: Fases 0-5 completas + auditoria 4 olas completas. 74 Cloud Functions desplegadas (2 nuevas: rematerializarPostCalendario, rematerializarPostRegimen).
- **Frontend**: Todo deployado a hosting. Calendario con ingreso-egreso, modal con turno teorico, BadgeEstado compartido, modal de revertir.
- **Maquina de estados**: BORRADOR -> ENVIADO -> HABILITADO, EN_REVISION (RRHH revierte). Sin AUTORIZADO_SUPERIOR.
- **RBAC**: 11 callables protegidas (assertPlanAuth + assertOverrideAuth).
- **Transacciones**: 5 transiciones de estado atomicas.
- **Re-materializacion**: Callables disponibles para RRHH post-cambio calendario/regimen.

### Commits de esta sesion

| Commit | Tag | Descripcion |
|--------|-----|-------------|
| `5c3cbc2` | `v2-capa-teorica-pre-ola1` | Bandeja RRHH + rediseno maquina de estados |
| `9979829` | `v2-ola1-rbac-transacciones` | Ola 1: RBAC + transacciones (9 callables) |
| `a26fa35` | `v2-olas2-3-4-auditoria` | Olas 2-4: integridad, re-materializacion, UX |

### Verificaciones pendientes

1. **Test regimen planificado**: Crear plan mensual -> aprobar -> confirmar materializacion + unicidad.
2. **Limpieza datos residuales**: vis_* con campos literales planos de BUG-2.
3. **Test RBAC**: Verificar que un usuario sin permisos no pueda aprobar/rechazar planes de otro grupo.
4. **Test re-materializacion**: Invocar `rematerializarPostCalendario` y confirmar propagacion.

### Usuario de test

- **DNI**: 28914247
- **persona_id**: per_01KQN9WXFXF69Z9DCT5YNJ3TFZ
- **HLG Oficina Personal**: hlg_01KQPW6YH9T31JBQHYKGXWH5RW (fijo Lun-Mie)
- **HLG Porteria**: hlg_01KQYMY313QPZQ957WQZZYRX4K (fijo Jue-Vie)

---

## Evolución — turnos compuestos (2026-05-27)

Contrato aprobado en [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) (tag git `v2.0.0-rfc-turnos-compuestos`). Reemplaza el modelo de turno único en `capa_teorica` por `segmentos[]` + resumen derivado, cobertura parcial, clasificación día calendario y freeze de período en `vis_*`. Implementación en rama `feat/epic-turnos-compuestos-v2`.

---

## Actualización UI/UX — Editor mensual Jefe (2026-05-28)

Cambios implementados sobre `GrillaMensualEditor.jsx` y utilidades asociadas, manteniendo coherencia con la capa teórica y sin lecturas adicionales al abrir/pintar:

### 1) Carga inicial y datos de contexto en una sola lectura

- `listarContextoPlanGrupo` retorna:
  - personas vigentes del grupo/período,
  - catálogo completo de regímenes usados,
  - `licencias_por_persona_ymd`,
  - `calendario_institucional_mes`.
- La grilla usa este contexto para pintar estados (sin roundtrips extra por celda).

### 2) Reglas de celda (estado operativo + estado calendario)

- Licencia/proyección:
  - color fucsia,
  - no editable,
  - muestra código/artículo en celda.
- Institucional (feriado/asueto):
  - fondo de columna completo (encabezado + celdas),
  - tooltip con tipo/motivo.
- Fines de semana:
  - fondo de columna completo, análogo al institucional.
- Diferenciación contractual:
  - `franco` y `no_laborable` se preservan como estados distintos.
  - `No lab` se contabiliza en columna separada.

### 3) Normalización robusta de `tipo_dia`

- Se normalizan variantes de origen (`no laborable`, `no-laborable`, `nolaborable`, etc.) a `no_laborable`.
- Impacto:
  - evita que `no_laborable` caiga en `franco` por diferencias de formato,
  - mantiene contadores y colorimetría correctos.

### 4) Pintado (planificado) y bloqueo (fijo/rotativo)

- Pintado individual y por arrastre:
  - `mousedown` inicia, `mouseenter` continúa, `mouseup` finaliza.
- Aplica solo en filas editables (régimen planificado).
- Filas fijo/rotativo:
  - no editables,
  - warning simple al intentar modificar.

### 5) Contenido de celda por tipo de régimen

- Planificado:
  - línea 1: turno (`M`, `T`, `N`, `M+T`, etc.),
  - línea 2: `ingreso-egreso`.
- Fijo/rotativo:
  - solo `ingreso-egreso` en celda.
- Compactación horaria:
  - `08:00-14:00` se muestra como `08-14` cuando ambos minutos son `00`.

### 6) Orden y navegación de agentes

- Orden de filas:
  1. planificado,
  2. rotativo,
  3. fijo,
  - y dentro de cada tramo, apellido/nombre ascendente.
- Mobile:
  - modo “una fila por vez” con navegación entre agentes (anterior/siguiente).

### 7) Contraste, bordes y legibilidad

- Ajuste de paleta para mayor contraste.
- Bordes de celdas uniformes en contorno completo.
- Texto autoajustable por longitud.
- Variante opcional “Alto contraste” con toggle.

### 8) Contrato visual final (consensuado)

- Columna institucional siempre visible en amarillo.
- Columna sábado/domingo siempre visible en fondo diferenciado.
- `Franco` y `No laborable` diferenciados visual y funcionalmente.
- Contadores separados: `Trab`, `Franc`, `No lab`.

---

## Fuera de alcance

- Acumulacion de horas semanales/mensuales en grilla
- Campos `banda_ingreso` / `banda_egreso` en UI
- Fichadas reales (capa de control vs capa teorica)
- Touch targets M3/M4 (mejora mobile pendiente)
