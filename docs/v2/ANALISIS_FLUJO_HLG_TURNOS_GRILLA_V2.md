# Análisis integral: HLG → turnos → materialización → grilla operativa

**Estado:** pausado — continuar análisis §20 (licencias largas + horizonte 45d)  
**Fecha:** 2026-05-29 (noche)  
**Plan Cursor (SSoT):** `.cursor/plans/análisis_flujo_hlg-grilla_55e1f7c3.plan.md` (§1–22)  
**Repo:** [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](MANUAL_CAPAS_ORQUESTACION_BORRADOR.md), [`PLAN_SECCIONES_17-22_ORQUESTACION.md`](PLAN_SECCIONES_17-22_ORQUESTACION.md), [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md)  
**Ya desplegado:** capa 1 `visSnapshotDegenerado` (functions)

---
# AnÃ¡lisis integral: HLG â†’ turnos â†’ materializaciÃ³n â†’ grilla operativa

## 1. Modelo de datos (ancla del sistema)

Cadena canÃ³nica documentada en [`docs/v2/MODULO_DATOS_LABORALES_V2.md`](docs/v2/MODULO_DATOS_LABORALES_V2.md) y [`docs/v2/PLAN_GRILLA_MULTI_HLG_V2.md`](docs/v2/PLAN_GRILLA_MULTI_HLG_V2.md):

```mermaid
flowchart TB
  per[personas per_*]
  hlc[historial_laboral_cargos hlc_*]
  hld[historial_laboral_datos hld_*]
  hlg[historial_laboral_grupos hlg_*]
  reg[cfg_regimen_horario]
  gdt[grupos_de_trabajo gdt_*]
  plt[planes_turno_servicio plt_*]
  asi[asistencia_diaria asi_*]
  vis[vistas_grilla_mes_agente vis_*]
  evt[eventos_ticket evt_*]

  per --> hlc --> hld --> hlg
  hlg --> reg
  hlg --> gdt
  plt --> gdt
  hlg --> asi
  hlg --> vis
  plt -.->|foto en agentes.dias y grilla_aprobada| vis
  asi --> vis
```

| ColecciÃ³n | ID | QuiÃ©n escribe | Para quÃ© sirve |
|-----------|-----|---------------|----------------|
| `historial_laboral_cargos` | `hlc_*` | `guardarRegistroLaboralTemporal` | Cargo, carga horaria, rol, efector |
| `historial_laboral_datos` | `hld_*` | mismo callable (UI casi siempre embebido) | Puente cargo â†’ detalle (funciÃ³n real, jerarquÃ­a) |
| `historial_laboral_grupos` | `hlg_*` | mismo callable | **Burbuja operativa**: persona + grupo + **`regimen_horario_id`** |
| `cfg_regimen_horario` | `CFG_REG_HOR_*` | `guardarRegimenHorario` | PatrÃ³n fijo / rotativo / planificado |
| `planes_turno_servicio` | `plt_*` | flujo planes jefe/RRHH | Gobernanza mensual; `grilla_aprobada` al aprobar |
| `asistencia_diaria` | `asi_{per}_{YYYYMMDD}` | worker + overrides + MDC | Capa teÃ³rica por dÃ­a, **mapa** `capa_teorica_por_grupo.{gdt}` |
| `vistas_grilla_mes_agente` | `vis_{YYYY}_{MM}_per_{ulid}_gdt_{ulid}` | worker + `mdcFanOutVis` | Read model UI (turno + `eventos[]` licencias) |
| `eventos_ticket` | `evt_*` | casi todo guardado laboral/plan | AuditorÃ­a / bandeja RRHH |

**No hay triggers Firestore** sobre HLG/HLD/HLc ni rÃ©gimen: todo es **callable onCall** ([`functions/index.js`](functions/index.js)).

---

## 2. Fase A â€” Alta y ediciÃ³n de datos laborales (HLG)

### 2.1 Secuencia tÃ­pica (UI)

[`web/src/pages/DatosLaborales.jsx`](web/src/pages/DatosLaborales.jsx) â†’ [`payloadBuilders.js`](web/src/pages/payloadBuilders.js) â†’ [`datosLaboralesService.js`](web/src/services/datosLaboralesService.js) â†’ callable **`guardarRegistroLaboralTemporal`** ([`functions/modules/catalogosLaborales.js`](functions/modules/catalogosLaborales.js)).

Orden habitual al **crear asignaciÃ³n a grupo**:

1. Guardar **HLD** (si no existe) con `cargo_id` del HLC vigente.
2. Guardar **HLG** con `dato_laboral_id`, `grupo_de_trabajo_id`, **`regimen_horario_id` obligatorio**, `fecha_inicio`/`fecha_fin`, `regimen_fecha_ancla` (rotativos).

### 2.2 QuÃ© registra en BD (por entidad)

| Paso | Escritura | Efectos colaterales |
|------|-----------|---------------------|
| HLC | merge en `historial_laboral_cargos` | `eventos_ticket` + `refreshClaimsLaboralPersona` |
| HLD | merge en `historial_laboral_datos` | idem |
| HLG activo con rÃ©gimen | merge en `historial_laboral_grupos` | idem + **`materializarTurnoMesBatch`** mes **actual y siguiente** (persona + `grupo_de_trabajo_id`) |

Fragmento materializaciÃ³n post-HLG ([`catalogosLaborales.js`](functions/modules/catalogosLaborales.js) ~L600):

- Solo si `regimen_horario_id` y `activo`.
- Errores en batch se loguean; **no bloquean** el guardado del HLG.

### 2.3 Validaciones backend (HLG)

| CÃ³digo | Regla |
|--------|--------|
| VAL-HLG-016 | `regimen_horario_id` obligatorio |
| VAL-HLG-017 | rÃ©gimen debe existir y estar activo en `cfg_regimen_horario` |
| VAL-HLG-018 | **en ediciÃ³n no se puede cambiar** `regimen_horario_id` (cerrar HLg y crear nueva) |
| VAL-HLG-014 | sin solape misma persona + mismo grupo |
| VAL-HLG-007/010/005/006 | integridad persona/HLD/cargo/fechas |
| VAL-HLG-W003 | warning si carga semanal del rÃ©gimen â‰  `hlc.carga_horaria_total` (no bloquea) |

### 2.4 DeshabilitaciÃ³n

- **`rrhhDeshabilitarHlg`**: cierra fechas, `activo: false` â†’ rematerializa **solo mes actual** (recalcula sin esa asignaciÃ³n en ese `gdt`).
- **`rrhhDeshabilitarHlc`**: cascada HLC â†’ HLD â†’ HLG; **no** rematerializa explÃ­citamente en el flujo revisado.

### 2.5 QuÃ© NO hace el alta de HLG

- No crea `plt_*`.
- No toca otros meses salvo actual/siguiente en materializaciÃ³n post-alta.
- No actualiza agentes con rÃ©gimen distinto si solo se editÃ³ HLC/HLD.

---

## 3. Fase B â€” RÃ©gimen horario (catÃ¡logo RRHH)

### 3.1 Flujo

[`web/src/pages/rrhh/RegimenesHorariosPage.jsx`](web/src/pages/rrhh/RegimenesHorariosPage.jsx) â†’ **`guardarRegimenHorario`** ([`functions/modules/catalogosRegimenHorario.js`](functions/modules/catalogosRegimenHorario.js)) â†’ **`cfg_regimen_horario`**.

Campos clave: `tipo_patron` (`fijo` | `rotativo` | `planificado`), `dias[]` / `ciclo[]` / `turnos_disponibles[]`, `carga_horaria_semanal_teorica`, `impacta_calendario_institucional`.

### 3.2 Impacto al actualizar rÃ©gimen

| AcciÃ³n | Efecto en `asi_*` / `vis_*` |
|--------|------------------------------|
| Guardar/editar `cfg_regimen_horario` | **Ninguno automÃ¡tico** |
| Callable **`rematerializarPostRegimen`** | Busca HLGs activos con ese `regimen_horario_id` â†’ por cada `gdt` Ãºnico â†’ `materializarGrupoMes` (mes actual + siguiente) |
| Nuevo guardado de HLG (misma persona/grupo, rÃ©gimen nuevo vÃ­a **nuevo** HLg) | Batch persona mes actual/siguiente |

**Deuda producto:** `callRematerializarPostRegimen` existe en [`web/src/services/callables.js`](web/src/services/callables.js) pero **no se invoca** desde la pÃ¡gina de regÃ­menes. Tras editar un patrÃ³n fijo, agentes ya asignados quedan con `vis_*`/`asi_*` viejos hasta rematerializaciÃ³n manual, lazy load (si snapshot invÃ¡lido), o nuevo HLg / aprobaciÃ³n de plan.

---

## 4. Fase C â€” Turnos mensuales (planes)

### 4.1 MÃ¡quina de estados

[`functions/modules/asistencia/planesTurnoServicio.js`](functions/modules/asistencia/planesTurnoServicio.js):

```
BORRADOR â†’ ENVIADO â†’ HABILITADO â†’ (CERRADO perpetuo)
         â†˜ rechazar â†’ BORRADOR
         revertir â†’ EN_REVISION
```

### 4.2 QuÃ© escribe cada acciÃ³n (sin materializar salvo excepciones)

| Callable | ColecciÃ³n | Contenido principal |
|----------|-----------|---------------------|
| `guardarPlanTurnoServicio` | `plt_*` | `agentes[].dias` (mensual/planificado); enriquecimiento vÃ­a [`planEnriquecimientoDias.js`](functions/modules/asistencia/planEnriquecimientoDias.js) + **`resolverDiaConPreCarga`** (mismo motor que worker) |
| `enviarPlanTurnoServicio` | `plt_*` | `ENVIADO`, historial aprobaciÃ³n |
| `rechazarPlanTurnoServicio` | `plt_*` | vuelve a `BORRADOR`; **no** des-materializa |
| `revertirPlanTurnoServicio` | `plt_*` | `EN_REVISION`; capa operativa **permanece** |
| `aprobarPlanTurnoServicio` | `plt_*` + **batch** | Pre-aprobar: `materializarGrupoMes`; luego `grilla_aprobada`, `HABILITADO` |
| `eliminarPlanTurnoServicio` / `cerrarPlanPerpetuo` | `plt_*` + batch | Re-cÃ¡lculo grupo sin plan habilitado |

### 4.3 Tres fuentes de verdad para â€œcÃ³mo se ve el mesâ€

```mermaid
flowchart LR
  subgraph editor [Editor jefe - cliente]
    PGU[planGrillaRegimenUtils generarGrillaDesdeRegimen]
    GME[GrillaMensualEditor]
    PGU --> GME
  end
  subgraph planDoc [Documento plan]
    PLT[plt_*.agentes.dias borrador]
    GA[plt_*.grilla_aprobada]
  end
  subgraph operativo [Operativo]
    VIS[vis_* por per+gdt+mes]
    ASI[asi_* capa_teorica_por_grupo]
  end
  GME -->|guardar| PLT
  PLT -->|aprobar| GA
  PLT -->|aprobar batch| VIS
  PLT -->|aprobar batch| ASI
  LCP[listarContextoPlanGrupo] --> GME
```

| Pantalla | Fuente | Â¿Materializa? |
|----------|--------|---------------|
| Editor / â€œVer turnos del equipoâ€ | `listarContextoPlanGrupo` + cÃ¡lculo **cliente** [`planGrillaRegimenUtils.js`](web/src/pages/jefe/planes/planGrillaRegimenUtils.js) | **No** lee `vis_*` |
| VER plan aprobado | `plt_*.grilla_aprobada` | No |
| Calendario licencias GSO | `vis_*` vÃ­a callables grilla | Lazy si hace falta |

**Divergencia conocida (backend vs editor):** en [`resolverTurnoDia.js`](functions/modules/asistencia/resolverTurnoDia.js) `resolverFijo` sin match de `dia_semana` â†’ `no_laborable`; en cliente sin match â†’ **`franco`**. Puede generar meses â€œtodo NLâ€ en `vis_*` si el match falla (p. ej. `dia_semana` string vs number) â€” caso PorterÃ­a mayo MOSTO.

---

## 5. Fase D â€” Motor de materializaciÃ³n

**NÃºcleo:** [`functions/modules/asistencia/rdaTurnoTeoricoWorker.js`](functions/modules/asistencia/rdaTurnoTeoricoWorker.js)

| FunciÃ³n | Alcance | Salida |
|---------|---------|--------|
| `materializarTurnoMesBatch` | 1 `per` Ã— 1 mes Ã— 1 `gdt` | ~31 writes `asi_*` + 1 merge `vis_*` |
| `materializarGrupoMes` | Todos HLg del `gdt` en el mes | Chunks de 5 Ã— batch |
| `materializarTurnoTeoricoDia` | 1 dÃ­a | Overrides / batch asistencia |

### 5.1 Lecturas por dÃ­a (batch)

- HLGs de la persona filtrados por `gdt` (vigencia: **solo** `hlg.fecha_inicio` / `hlg.fecha_fin`, sin fallback HLD).
- `cfg_regimen_horario` por `regimen_horario_id`.
- Plan `HABILITADO` si rÃ©gimen `planificado` o si viene `planCache` (aprobaciÃ³n).
- Calendario institucional (TTL 5 min).
- `asistencia_diaria` existente (overrides `reemplazo` por `gdt`).
- `grupos_de_trabajo` (etiqueta corta).

### 5.2 Prioridad de resoluciÃ³n (OpciÃ³n A â€” plan > HLG por `gdt`)

Documentado en [`docs/v2/HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](docs/v2/HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md):

1. **`resolucionDesdeFotoPlan`** â€” si plan HABILITADO trae foto en `agentes[].dias[fecha]` â†’ gana directo.
2. Si no hay foto: iterar HLGs vigentes en el `gdt`; elegir resoluciÃ³n â€œmÃ¡s laboralâ€ entre HLGs del mismo grupo.
3. **`aplicarFotoPlanDia`** â€” si origen â‰  `plan_mensual`, la foto puede **forzar** NL/franco (Plan > HLG).
4. Overrides activos en `asi_*` pisan turno final.
5. Feriado institucional: lÃ³gica en `resolverDiaConPreCarga` (puede anular laborable) + reglas al escribir `vis_*` (`jornadaDesdePlanFoto` conserva turno si hay foto con horario).

### 5.3 QuÃ© queda escrito

**`asi_{per}_{YYYYMMDD}`:**

- `capa_teorica_por_grupo.{gdt}`: segmentos, `tipo_dia`, `origen`, `hlg_id`, `regimen_horario_id`, `plan_id`, feriado, `materializado_en`.
- `overrides_turno[]` (persisten al rechazar plan).

**`vis_{YYYY}_{MM}_per_*_gdt_*`:**

- `dias["01"â€¦"31"]`: `tipo_dia`, `rda_*`, `es_franco`, `es_feriado`, `grupo_de_trabajo_id`, `etiqueta_grupo_corta`.
- `dias[].eventos[]` â€” **no** del worker teÃ³rico; lo alimenta **MDC** ([`mdcFanOutVis.js`](functions/modules/shared/mdcFanOutVis.js)).

### 5.4 CuÃ¡ndo se dispara materializaciÃ³n

| Disparador | Tipo | Alcance temporal tÃ­pico |
|------------|------|-------------------------|
| Aprobar plan mensual | Batch pre-transacciÃ³n | Mes del plan, todo el `gdt` |
| Alta/ediciÃ³n HLG activo | Batch | Mes actual + siguiente |
| Deshabilitar HLG | Batch | Mes actual |
| `rematerializarPostRegimen` / `PostCalendario` | Batch RRHH | Mes actual + siguiente (todos o por rÃ©gimen) |
| `obtenerVistaGrillaMesAgente` / `listarVistaGrillaMesPorGrupo` | **Lazy** | 1 persona Ã— mes Ã— `gdt` |
| Override turno | DÃ­a | `materializarTurnoTeoricoDia` |
| Licencias MDC | Fan-out | Solo `eventos[]` en `vis_*` (+ worker asistencia licencias) |

**Lazy gate:** [`grillaMesAgenteCore.js`](functions/modules/shared/grillaMesAgenteCore.js) â€” `visRequiereMaterializacion` (vacÃ­o, sin seÃ±al de turno, o snapshot **degenerado** â‰¥20 dÃ­as sin horario/franco o todo `no_laborable`). **Desplegado** en functions.

**No materializa:** guardar/enviar/rechazar/revertir plan; lectura pura de contexto plan.

---

## 6. Fase E â€” Grilla operativa (GSO)

### 6.1 UI

[`web/src/pages/GrillaOperativa.jsx`](web/src/pages/GrillaOperativa.jsx) â€” pestaÃ±a **Calendario licencias** â†’ [`useGrillaMesVista.js`](web/src/features/grilla/useGrillaMesVista.js).

| Modo | Callable | Backend |
|------|----------|---------|
| Titular | N Ã— `obtenerVistaGrillaMesAgente` | `ensureMaterializacionVisMes` por persona |
| Equipo / sector | `listarVistaGrillaMesPorGrupo` | HLg vigentes al **Ãºltimo dÃ­a del mes** (mÃ¡x. 60) + lazy por fila |

PresentaciÃ³n: [`GrillaMesEquipoTabla.jsx`](web/src/features/grilla/GrillaMesEquipoTabla.jsx), [`grillaMesEquipoDisplay.js`](web/src/features/grilla/grillaMesEquipoDisplay.js), estilos [`grillaTurnosVisual.js`](web/src/features/grilla/grillaTurnosVisual.js).

**El cliente no lee Firestore** de `vis_*`; solo interpreta payload del callable.

### 6.2 PestaÃ±a â€œVista laboralâ€

`listarReadModelLaboralOperativoTemporal` â€” read-model HLc/HLd/HLg; **independiente** de `vis_*` (no es grilla de turnos teÃ³ricos).

---

## 7. Matriz de desactualizaciÃ³n (Ã­ndice rÃ¡pido)

| # | Punto | SÃ­ntoma | Causa tÃ©cnica |
|---|--------|---------|----------------|
| D1 | Editar rÃ©gimen sin rematerializar | Turno mensual â‰  calendario | `cfg_*` nuevo; `vis_*`/`asi_*` viejos |
| D2 | `resolverFijo` vs editor cliente | Mes entero NL en `vis_*` | Sin match `dia_semana` â†’ NL backend vs F cliente |
| D3 | Snapshot `vis_*` degenerado | Todo NL con `tipo_dia` set | MaterializaciÃ³n histÃ³rica fallida; capa 1 mitiga lazy |
| D4 | Vigencia HLg inconsistente | En tabla equipo pero celda vacÃ­a | Listado usa fechas HLD; worker no |
| D5 | Plan rechazado / revertido | VER plan â‰  operativo | Rechazar no des-materializa |
| D6 | Overrides post-aprobaciÃ³n | HistÃ³rico plan â‰  operativo | Overrides solo en `asi_*`/`vis_*` |
| D7 | Feriado + turno nocturno | FER tapa turno o solo NL | Feriado anula laborable; UI no prioriza horario |
| D8 | Multi-HLG multicargo | â€œÂ¿CuÃ¡l es mi turno?â€ | Un `vis_*` por `gdt`, no por persona |
| D9 | Calendario institucional | Feriado nuevo no aparece | Falta `rematerializarPostCalendario` |
| D10 | `materializado_lazy` invisible | Usuario no sabe si hubo sync | Flag backend sin UI |

**Detalle con escenarios hospitalarios:** secciÃ³n 13.

---

## 13. Problemas y soluciones concretas (escenarios hospitalarios)

Cada caso sigue el mismo esquema: **situaciÃ³n real** â†’ **quÃ© ve cada rol** â†’ **estado en BD** â†’ **impacto clÃ­nico/administrativo** â†’ **soluciÃ³n concreta** â†’ **criterio de cierre**.

Actores del piloto (referencia):

| Agente | `persona_id` | Grupos tÃ­picos |
|--------|----------------|-----------------|
| MOSTO | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` | PorterÃ­a, Oficina, Sala |
| CHAPARRO | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` | Sala InternaciÃ³n |
| LOKITO | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` | Sala (planificado) |

Grupos: Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`, PorterÃ­a `gdt_01KQA9FVEW53JSNTPGX32NWQ5B`, Oficina `gdt_01KR3H81ENQK84ZK21EQWEQQXG`.

---

### D1 â€” RRHH corrige un rÃ©gimen fijo y nadie rematerializa

**SituaciÃ³n hospitalaria**

RRHH detecta que el rÃ©gimen â€œAdministrativo PorterÃ­a 08â€“14â€ tenÃ­a mal cargados los jueves (deberÃ­an ser NL, no laborables). Edita `cfg_regimen_horario` en **RegÃ­menes horarios** y guarda. EnfermerÃ­a jefe ya habÃ­a armado el plan de junio; los agentes de PorterÃ­a siguen viendo el patrÃ³n viejo en **Calendario licencias**.

**QuÃ© ve cada rol**

| Rol | Pantalla | Resultado |
|-----|----------|-----------|
| Jefe PorterÃ­a | Turnos mensuales / editor | PatrÃ³n **nuevo** (calculado en cliente desde rÃ©gimen actualizado) |
| Agente / jefe | Calendario licencias GSO | PatrÃ³n **viejo** (lee `vis_*` materializado antes del cambio) |
| RRHH | Bandeja licencias | Puede validar LAO contra turno teÃ³rico **incorrecto** |

**Estado en BD**

- `cfg_regimen_horario`: dÃ­as actualizados âœ…
- `hlg_*`: sin cambio (mismo `regimen_horario_id`) âœ…
- `vis_*` / `asi_*`: timestamps de materializaciÃ³n **anteriores** al cambio de rÃ©gimen âŒ
- `plt_*` junio: si existe borrador, foto puede mezclar rÃ©gimen nuevo (cliente) con operativo viejo

**Impacto**

- Solicitud de licencia en dÃ­a que el sistema marca laborable pero RRHH considera NL â†’ rechazo o consumo de bolsa errÃ³neo.
- Jefe planifica dotaciÃ³n con una grilla; GSO muestra otra â†’ desconfianza en el portal.

**SoluciÃ³n concreta**

1. **Producto (P0):** tras guardar rÃ©gimen en [`RegimenesHorariosPage.jsx`](web/src/pages/rrhh/RegimenesHorariosPage.jsx), modal: *â€œEste cambio afecta N agentes en M grupos. Â¿Rematerializar mes actual y siguiente?â€* â†’ `callRematerializarPostRegimen({ regimen_horario_id })`.
2. **Operativa (hoy, sin cÃ³digo):** RRHH ejecuta callable o script `materializar-grupo-mes.mjs --gdt=... --periodo=2026-06` por grupo afectado.
3. **Proceso:** instructivo RRHH: *â€œEditar rÃ©gimen â‰  actualizar calendarios automÃ¡ticamenteâ€* hasta deploy P0.

**Criterio de cierre**

Para un agente PorterÃ­a con ese rÃ©gimen: `listarContextoPlanGrupo` (cliente) = `vis_*` = `asi_*` en al menos 5 dÃ­as laborables, NL y francos del mes en curso.

---

### D2 â€” Mes entero â€œNLâ€ en calendario pero turno mensual correcto (PorterÃ­a mayo MOSTO)

**SituaciÃ³n hospitalaria**

MOSTO tiene HLg en PorterÃ­a con rÃ©gimen fijo Lâ€“Mâ€“X 08:00â€“14:00, Jâ€“V NL, Sâ€“D franco. El jefe abre **Ver turnos del equipo** (mayo): ve el patrÃ³n correcto. Abre **Calendario licencias** (mayo, filtro PorterÃ­a): las 31 celdas muestran **NL**.

**QuÃ© ve cada rol**

| Fuente | Mayo 2026 MOSTO + PorterÃ­a |
|--------|----------------------------|
| Turno mensual | Lâ€“Mâ€“X verde 08â€“14, Jâ€“V NL, Sâ€“D F |
| `vis_*` mes 5 | 31Ã— `tipo_dia: no_laborable`, sin `rda_ingreso` |
| `vis_*` mes 4 | PatrÃ³n correcto (materializaciÃ³n posterior OK) |

**Estado en BD**

- Snapshot **degenerado**: tiene `tipo_dia` en todas las celdas â†’ antes el lazy load **no** rematerializaba.
- Causa probable de generaciÃ³n: `resolverFijo` sin match de `dia_semana` (tipo string vs number) â†’ 31Ã— NL al materializar el 30/05.

**Impacto**

- Jefe no puede cruzar licencia con turno teÃ³rico en mayo.
- Si MDC usa `vis_*` para preview de dÃ­as hÃ¡biles, subestima jornadas laborables.

**SoluciÃ³n concreta**

| Capa | AcciÃ³n | Archivo |
|------|--------|---------|
| **1 (desplegada)** | Lazy detecta degenerado y rematerializa al cargar calendario | [`grillaMesAgenteCore.js`](functions/modules/shared/grillaMesAgenteCore.js) |
| **2 (pendiente)** | Sin match dÃ­a â†’ `franco`; `Number(dia_semana)` | [`resolverTurnoDia.js`](functions/modules/asistencia/resolverTurnoDia.js) |
| **Inmediata** | Script rematerializar PorterÃ­a mayo MOSTO | `materializar-grupo-mes.mjs` o reabrir calendario post-deploy |

**Criterio de cierre**

Mayo MOSTO PorterÃ­a = mismo patrÃ³n que abril (`laborable` + horarios en Lâ€“Mâ€“X, `franco` en Sâ€“D).

---

### D3 â€” Snapshot â€œcompletoâ€ pero invÃ¡lido (falso positivo de materializaciÃ³n)

**SituaciÃ³n hospitalaria**

Un mes se materializÃ³ en un deploy intermedio o con rÃ©gimen mal referenciado. Firestore tiene 31 dÃ­as con datos, asÃ­ que el sistema asumÃ­a â€œya estÃ¡ listoâ€. RRHH confÃ­a en que el calendario estÃ¡ sincronizado porque **no estÃ¡ vacÃ­o**.

**SÃ­ntoma tÃ©cnico**

- `vis_*.dias` tiene 31 keys.
- 0 celdas con `rda_ingreso`, 0 con `es_franco`, 100% `no_laborable`.
- `metadata.ultima_sync_teorica` existe â†’ parece â€œsanoâ€.

**SoluciÃ³n concreta (capa 1)**

FunciÃ³n `visSnapshotDegenerado`: si â‰¥20 dÃ­as y (sin horario y sin franco) OR (todos NL) â†’ tratar como no materializado.

**Escenario de regresiÃ³n a evitar**

Enfermera de guardia 24h en rÃ©gimen rotativo: muchos dÃ­as NL explÃ­citos en plan **pero** con horarios en foto del plan â†’ no debe marcarse degenerado si hay `rda_ingreso` en al menos un dÃ­a.

**Criterio de cierre**

Test [`grillaMesAgenteCore.test.js`](functions/test/grillaMesAgenteCore.test.js): degenerado = true para 31Ã— NL; false para patrÃ³n fijo vÃ¡lido.

---

### D4 â€” Agente aparece en grilla del equipo pero sin turno materializado

**SituaciÃ³n hospitalaria**

RRHH da de alta a un auxiliar de limpieza en **Sala InternaciÃ³n** el dÃ­a 15. Las fechas de vigencia estÃ¡n en **HLD** (`fecha_inicio: 2026-06-15`) pero el **HLG** quedÃ³ con `fecha_inicio` vacÃ­o o distinto por carga manual incompleta.

**QuÃ© pasa**

| Componente | Comportamiento |
|------------|----------------|
| `listarVistaGrillaMesPorGrupo` | Usa fallback HLD â†’ agente **aparece** en filas de junio |
| `materializarTurnoMesBatch` | Solo mira `hlg.fecha_inicio` â†’ dÃ­as 1â€“14 **no** materializa; puede omitir todo el mes |
| Titular (vista propia) | Puede no listar el grupo si el resolver de contexto usa otra regla |

**Impacto**

- Jefe ve nombre en grilla con celdas grises/vacÃ­as â†’ no sabe si falta turno o falta dato.
- DotaciÃ³n de junio incompleta en reportes.

**SoluciÃ³n concreta**

1. **P0:** funciÃ³n Ãºnica `vigenteEnCorte(hlg, hld, fechaCorte)` en [`grillaMesAgenteCore.js`](functions/modules/shared/grillaMesAgenteCore.js) y [`rdaTurnoTeoricoWorker.js`](functions/modules/asistencia/rdaTurnoTeoricoWorker.js).
2. **ValidaciÃ³n alta:** al guardar HLG, si `fecha_inicio` vacÃ­a, copiar desde HLD (o error VAL-HLG-010 explÃ­cito).
3. **UI Datos laborales:** mostrar warning si HLG.fecha_inicio â‰  HLD.fecha_inicio.

**Criterio de cierre**

Agente alta 15/jun: aparece en grilla **desde dÃ­a 15** con turno teÃ³rico; dÃ­as 1â€“14 sin fila o sin materializaciÃ³n (segÃºn regla producto acordada).

---

### D5 â€” Plan revertido por RRHH; operativo sigue con versiÃ³n anterior

**SituaciÃ³n hospitalaria**

Jefe de Sala envÃ­a plan de junio con francos extra en feriado. RRHH **revierte** el plan (`EN_REVISION`) para corregir. El jefe abre **VER plan**: ve borrador nuevo. Los agentes en **Calendario licencias** siguen viendo la versiÃ³n **aprobada anteriormente** (o la materializada en la Ãºltima aprobaciÃ³n).

**Estado en BD**

- `plt_*`: `EN_REVISION`; `grilla_aprobada` puede seguir existiendo del ciclo anterior segÃºn implementaciÃ³n de revertir.
- `vis_*` / `asi_*`: **no se tocan** en revertir/rechazar.

**Impacto**

- ComunicaciÃ³n interna: â€œel plan fue revertidoâ€ pero enfermerÃ­a ve turnos viejos en GSO.
- Riesgo bajo si revertir es previo a nueva aprobaciÃ³n; riesgo alto si se confunde con â€œplan vigenteâ€.

**SoluciÃ³n concreta**

| OpciÃ³n | DescripciÃ³n | Esfuerzo |
|--------|-------------|----------|
| **A â€” Banner (P3)** | En GSO, si existe plan `EN_REVISION` para ese `gdt`/mes: banner amarillo *â€œPlan en revisiÃ³n; calendario operativo puede no coincidir con borrador del jefeâ€* | Bajo |
| **B â€” Rematerializar al revertir** | `revertirPlanTurnoServicio` llama `materializarGrupoMes` sin foto de plan | Medio; puede borrar intenciÃ³n operativa |
| **C â€” PolÃ­tica explÃ­cita** | Documentar: operativo = Ãºltima materializaciÃ³n exitosa; plan aprobado = histÃ³rico legal | Bajo |

**RecomendaciÃ³n:** A + C (no rematerializar automÃ¡tico en revertir salvo pedido RRHH).

---

### D6 â€” Cambio de turno por guardia (override) no figura en plan aprobado

**SituaciÃ³n hospitalaria**

Plan de junio aprobado: LOKITO noche 22:00â€“06:00 el 10/06. El 08/06 hay baja imprevista; jefe registra **override** vÃ­a `registrarCambioTurno` â†’ LOKITO cubre guardia diurna 07:00â€“14:00 el 10/06.

**QuÃ© ve cada rol**

| Pantalla | 10/06 LOKITO |
|----------|--------------|
| VER plan aprobado | 22:00â€“06:00 (snapshot `grilla_aprobada`) |
| Calendario licencias | 07:00â€“14:00 (override en `asi_*` â†’ `vis_*`) |
| Fichada futura (cuando exista) | Debe usar operativo |

**Impacto**

- **Correcto por diseÃ±o** para operaciÃ³n diaria.
- Problema si auditorÃ­a legal exige que â€œplan aprobadoâ€ refleje realidad â†’ hoy no lo hace.

**SoluciÃ³n concreta**

1. **Producto:** definir que `grilla_aprobada` = intenciÃ³n del jefe al aprobar; operativo = fuente para licencias y asistencia.
2. **UI:** en modal celda GSO, badge *â€œCambio operativoâ€* si hay override activo en `asi_*`.
3. **No hacer (salvo requisito legal):** regenerar `grilla_aprobada` en cada override.

---

### D7 â€” Feriado 25 de Mayo con guardia nocturna (LOKITO)

**SituaciÃ³n hospitalaria**

25/05 es feriado. El plan de Sala asigna a LOKITO guardia nocturna 22:00â€“06:00 (servicio esencial). En **Calendario licencias**: columna Ã¡mbar (feriado) pero celda mostraba **FER** tapando el horario, o solo **NL** con modal contradictorio (`tipo_dia: no_laborable` + horario 22â€“06).

**Causa en cadena**

1. `resolverDiaConPreCarga`: feriado institucional anula `laborable` â†’ `no_laborable` sin turno.
2. Worker al escribir `vis_*`: regla `jornadaDesdePlanFoto` **restaura** turno si hay foto del plan con horario.
3. UI antigua: priorizaba texto FER / `tipo_dia` sobre `rda_ingreso`.

**SoluciÃ³n concreta**

| Capa | AcciÃ³n |
|------|--------|
| Backend (parcial) | Mantener `jornadaDesdePlanFoto` en worker |
| **Capa 3 UI** | `celdaTieneJornadaVis`: si hay `rda_ingreso`/`rda_egreso`, mostrar chip horario aunque `tipo_dia` sea NL; feriado solo en **fondo de columna**, sin texto FER en celda |
| Deploy | Hosting web (functions ya desplegadas) |

**Criterio de cierre**

25/05 LOKITO: columna feriado Ã¡mbar + chip **22:00â€“06:00** visible; modal coherente.

---

### D8 â€” Agente multicargo: MOSTO en PorterÃ­a y Oficina

**SituaciÃ³n hospitalaria**

MOSTO tiene dos HLg vigentes: PorterÃ­a (rÃ©gimen fijo 08â€“14 Lâ€“Mâ€“X) y Oficina (similar). RRHH abre **Calendario licencias** sin filtrar grupo y espera â€œun solo calendario del agenteâ€.

**Realidad del modelo**

- Un documento `vis_*` **por par** (persona + mes + **`gdt`**).
- Titular en GSO: N calendarios (uno por grupo laboral).
- No hay fusiÃ³n global de turnos en un solo renglÃ³n.

**Impacto**

- Agente puede solicitar licencia en contexto de un grupo; preview LAO debe usar el `gdt` correcto.
- ConfusiÃ³n: â€œÂ¿Por quÃ© tengo dos grillas?â€ â†’ respuesta de producto: multicargo = mÃºltiples burbujas operativas.

**SoluciÃ³n concreta**

1. **UX:** etiqueta clara por calendario: *â€œPorterÃ­aâ€* / *â€œOficinaâ€* (`etiqueta_grupo_corta` ya en `vis_*`).
2. **Wizard solicitud:** obligar selecciÃ³n de contexto laboral (`resolverContextoLaboralSolicitud`) antes de preview.
3. **No recomendado:** volver a fusiÃ³n global multi-HLG (eliminada 29/05; rompe OpciÃ³n A).

**Ejemplo junio**

- `vis_2026_06_per_..._gdt_porteria`: Lâ€“Mâ€“X 08â€“14.
- `vis_2026_06_per_..._gdt_oficina`: patrÃ³n Oficina.
- Independientes; licencia en PorterÃ­a no borra turno Oficina.

---

### D9 â€” Nuevo feriado provincial cargado en calendario institucional

**SituaciÃ³n hospitalaria**

Gobierno declara asueto el 17/06. RRHH carga evento en **Calendario institucional**. Agentes de rÃ©gimen fijo que tenÃ­an laborable ese dÃ­a siguen viendo 08â€“14 en GSO hasta rematerializar.

**SoluciÃ³n concreta**

1. Tras guardar evento institucional: botÃ³n **â€œActualizar grillas afectadasâ€** â†’ `rematerializarPostCalendario` (callable existente).
2. Lazy: al abrir junio post-cambio, si snapshot previo no tiene `es_feriado` en 17/06 pero calendario sÃ­ â†’ considerar â€œdesactualizado por calendarioâ€ (mejora futura P2: versiÃ³n `calendario_version` en metadata `vis_*`).

**Criterio de cierre**

17/06: columna feriado + tipo_dia coherente con rÃ©gimen (NL si no hay guardia en plan).

---

### D10 â€” Usuario no sabe si el calendario se actualizÃ³ al abrir

**SituaciÃ³n hospitalaria**

Jefe de servicio abre Calendario licencias despuÃ©s del deploy de capa 1. El backend rematerializa 40 agentes (lazy). No hay feedback; jefe cree que sigue roto y recarga 5 veces.

**SoluciÃ³n concreta**

- Consumir `materializado_lazy: true` del callable en [`useGrillaMesVista.js`](web/src/features/grilla/useGrillaMesVista.js).
- Toast: *â€œCalendario actualizado con turnos teÃ³ricos recientesâ€* (una vez por carga).
- Opcional: indicador en header del mes si `metadata.ultima_sync_teorica` &lt; 24h.

---

### D11 â€” CHAPARRO: plan dice NL pero operativo dice laborable (junio Sala)

**SituaciÃ³n hospitalaria (incidente documentado en handoff 29/05)**

CHAPARRO, rÃ©gimen **fijo**, plan junio Sala: jefe marcÃ³ lunâ€“miÃ© como **NL** en la foto del plan (excepciÃ³n administrativa). Tras aprobar, **VER plan** muestra NL. **Calendario licencias** muestra **laborable 08â€“14** esos dÃ­as.

**Causa**

Antes de OpciÃ³n A, worker **fusionaba** HLGs y el rÃ©gimen fijo â€œganabaâ€ sobre foto del plan en algunos dÃ­as. Post-fix: `resolucionDesdeFotoPlan` + `aplicarFotoPlanDia` (Plan > HLG).

**SoluciÃ³n concreta**

1. Verificar deploy motor OpciÃ³n A en producciÃ³n.
2. Re-aprobar plan o `materializarGrupoMes` junio Sala.
3. Audit script: 13 dÃ­as discrepantes â†’ 0.

**Criterio de cierre**

Para cada dÃ­a del mes: `plt.agentes[CHAPARRO].dias[fecha].tipo_dia` = `vis_*`.dias[dd].tipo_dia` = `asi_*`.capa_teorica_por_grupo[Sala].tipo_dia`.

---

### D12 â€” Alta HLG solo materializa mes actual y siguiente

**SituaciÃ³n hospitalaria**

RRHH asigna enfermera a Sala el 20/05 con rÃ©gimen rotativo. MaterializaciÃ³n post-alta corre para **mayo y junio** solamente. Jefe abre **Calendario licencias marzo** (histÃ³rico): vacÃ­o o degenerado â†’ lazy rematerializa si capa 1 activa; si no, queda inconsistente.

**SoluciÃ³n concreta**

| Corto plazo | Lazy + capa 1 al abrir cualquier mes |
| Mediano | Al alta HLG, materializar tambiÃ©n mes de `fecha_inicio` si â‰  actual |
| Largo | Job batch nocturno mes+1 para todos los HLg activos |

---

### D13 â€” Plan planificado sin HABILITADO (LOKITO fuera de ventana de aprobaciÃ³n)

**SituaciÃ³n hospitalaria**

LOKITO tiene rÃ©gimen **planificado**. Jefe armÃ³ borrador de julio pero RRHH aÃºn no aprobÃ³. Calendario julio: worker no encuentra plan HABILITADO â†’ dÃ­as NL o vacÃ­os segÃºn fallback.

**Comportamiento esperado**

- Sin plan HABILITADO: no hay foto; rÃ©gimen planificado sin plan â†’ **no laborable** (o franco segÃºn capa 2).
- Tras aprobar: `materializarGrupoMes` llena `vis_*`.

**SoluciÃ³n producto**

- En GSO julio pre-aprobaciÃ³n: banner *â€œPlan julio pendiente de aprobaciÃ³n RRHHâ€*.
- Turno mensual borrador â‰  operativo hasta aprobaciÃ³n (comunicar en capacitaciÃ³n).

---

## 14. Tabla resumen: problema â†’ soluciÃ³n â†’ responsable

| ID | Problema (1 lÃ­nea) | SoluciÃ³n concreta | QuiÃ©n dispara | Prioridad |
|----|-------------------|-------------------|---------------|-----------|
| D1 | RÃ©gimen editado, calendario viejo | Wire `rematerializarPostRegimen` en UI RRHH | RRHH al guardar rÃ©gimen | P0 |
| D2 | Mes todo NL (PorterÃ­a mayo) | Capa 2 + lazy capa 1 + script mayo | Deploy + usuario abre calendario | P0 |
| D3 | Snapshot falso completo | `visSnapshotDegenerado` | AutomÃ¡tico lazy | Hecho |
| D4 | Fechas HLG vs HLD | `vigenteEnCorte` unificado | Dev backend | P0 |
| D5 | Plan revertido â‰  GSO | Banner EN_REVISION | Dev frontend | P3 |
| D6 | Override â‰  plan aprobado | Badge â€œcambio operativoâ€; polÃ­tica documentada | Producto + UI | P2 |
| D7 | Feriado tapa turno | Capa 3 UI + worker foto plan | Deploy hosting | P1 |
| D8 | Multicargo confuso | Etiquetas por `gdt`; contexto en solicitud | UX | P1 |
| D9 | Feriado nuevo | `rematerializarPostCalendario` post-guardar | RRHH | P0 |
| D10 | Sin feedback lazy | Toast `materializado_lazy` | Dev frontend | P1 |
| D11 | Plan NL â‰  operativo laborable | Motor OpciÃ³n A + re-materializar | Dev + jefe re-aprobar | P0 |
| D12 | HistÃ³rico sin materializar | Lazy al abrir mes; opcional batch fecha_inicio | AutomÃ¡tico / RRHH | P2 |
| D13 | Planificado sin aprobar | Banner pendiente aprobaciÃ³n | Dev frontend | P2 |

---

## 8. Validaciones transversales (resumen)

| Dominio | DÃ³nde | QuÃ© valida |
|---------|-------|------------|
| HLG | `catalogosLaborales.js`, `hlgValidacionesCore.js` | Solape, rÃ©gimen, fechas, no cambiar rÃ©gimen en ediciÃ³n |
| RÃ©gimen | `catalogosRegimenHorario.js` | PatrÃ³n, turnos, carga |
| Plan | `planesTurnoServicio.js` | Estados, tokens, permisos jefe/RRHH, agentes en grupo |
| Grilla callable | `grillaMesAgenteCore.js` | Params `per_*`, `gdt_*`, mes 1â€“12 |
| MaterializaciÃ³n | worker | HLg con rÃ©gimen; plan planificado sin HABILITADO â†’ NL |
| GSO listado equipo | `listarVistaGrillaMesPorGrupo` | SesiÃ³n + `persona_id`; **no** valida jefe del `gdt` (deuda Â§PLAN_GRILLA_MULTI_HLG) |

---

## 9. CÃ³digo obsoleto, duplicado o residual

| Item | UbicaciÃ³n | Estado propuesto |
|------|-----------|------------------|
| `GrillaMesGrupoPanel.jsx` | deprecated, sin imports | **Eliminar** o mantener solo si docs lo referencian |
| `titularDias` export | `useGrillaMesVista.js` | **Eliminar** export muerto |
| Alias `obtenerVistaGrillaEquipo` | docs OLEADA_C2 | **Implementar** o borrar de docs |
| Schema `visDocumentId` sin `_gdt_` | `web/src/schemas/articulo.tripleLayer.schema.js` | **Actualizar** a `buildVisDocumentId` 3 args |
| `obtenerPlanHabilitado` duplicado | `grillaMesAgenteCore` vs `rdaTurnoTeoricoWorker` | **Unificar** mÃ³dulo shared |
| 5+ `normalizarTipoDia*` | web + functions | **Un solo mÃ³dulo shared** (sync script ya existe para parte) |
| `callRematerializarPostRegimen` sin UI | `callables.js` | **Wire** post-guardar rÃ©gimen o job RRHH |
| Campo legacy `capa_teorica` raÃ­z en `asi_*` | limpiado 29/05 segÃºn handoff | Verificar con `audit-vis-junio-2026.mjs`; no reintroducir lecturas |
| FusiÃ³n global multi-HLG | eliminada en worker | Docs viejos que hablen de â€œun turno por personaâ€ â†’ **archivar** |
| `resolverDiaConPreCarga` feriado anula laborable | worker L501â€“512 vs escritura `vis_*` L689+ | **Unificar** regla feriado en un solo lugar |

---

## 10. Propuestas (roadmap â€” enlazado a secciÃ³n 13)

Cada Ã­tem referencia el ID de problema (D1â€“D13) de la secciÃ³n 13.

### P0 â€” Coherencia operativa (datos correctos)

1. **D2 â€” Capa 2:** alinear `resolverFijo`/`resolverRotativo` con cliente (`franco` sin match + `Number(dia_semana)`).
2. **D1/D9 â€” Post-guardar catÃ¡logo:** invocar `rematerializarPostRegimen` / `rematerializarPostCalendario` desde UI RRHH (confirmaciÃ³n + progreso).
3. **D4 â€” Vigencia HLg:** funciÃ³n `vigenteEnCorte(hlg, hld?, ymd)` en listado equipo, titular, worker.
4. **D11 â€” QA automatizado:** extender audit script â€” `plt foto` = `vis_*` = `asi_*` (CHAPARRO junio, MOSTO multicargo).

### P1 â€” Contrato y observabilidad

5. **D10 â€”** consumir `materializado_lazy` en UI (toast).
6. **D7 â€”** deploy hosting capa 3 (feriado + horario en celda).
7. **D8 â€”** etiquetas claras por `gdt` en titular multicargo.
8. Schema Zod `vis_*` con `_gdt_` en ID.

### P2 â€” Deuda estructural

9. Una sola fuente de resoluciÃ³n de dÃ­a (eliminar divergencia D2 a largo plazo).
10. Permisos jefe en `listarVistaGrillaMesPorGrupo`.
11. **D12 â€”** materializar mes de `fecha_inicio` al alta HLG.
12. **D6 â€”** badge override en modal GSO.

### P3 â€” Producto / arquitectura

13. **D5 â€”** banner plan `EN_REVISION` en GSO.
14. **D13 â€”** banner plan pendiente aprobaciÃ³n (rÃ©gimen planificado).
15. PolÃ­tica escrita: `grilla_aprobada` vs operativo vs overrides (D6).

---

## 11. Diagrama de sincronizaciÃ³n recomendado (estado objetivo)

```mermaid
sequenceDiagram
  participant RRHH
  participant Jefe
  participant BD
  participant Worker
  participant GSO

  RRHH->>BD: cfg_regimen_horario
  RRHH->>Worker: rematerializarPostRegimen
  RRHH->>BD: hlg_* alta
  Worker->>BD: asi_* vis_* mes actual/siguiente

  Jefe->>BD: plt_* borrador
  Jefe->>BD: plt_* HABILITADO
  Worker->>BD: materializarGrupoMes
  Worker->>BD: grilla_aprobada

  GSO->>BD: leer vis_*
  alt vis degenerado o vacio
    GSO->>Worker: materializarTurnoMesBatch lazy
    Worker->>BD: asi_* vis_*
  end
  GSO->>GSO: render celdaTieneJornadaVis
```

---

## 12. VerificaciÃ³n manual post-deploy (PorterÃ­a mayo)

1. Calendario licencias Â· `gdt_01KQA9FVEW53JSNTPGX32NWQ5B` Â· 2026-05 Â· MOSTO.
2. Comparar con turno mensual y con `vis_*` abril (mismo patrÃ³n Lâ€“Mâ€“X laborable, Jâ€“V NL, Sâ€“D franco).
3. Si persiste NL: ejecutar rematerializaciÃ³n explÃ­cita (`rematerializarPostRegimen` o script grupo-mes) y evaluar capa 2.

**Referencias:** [`docs/v2/PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](docs/v2/PLAN_CAPA_TEORICA_ASISTENCIA_V2.md), [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](docs/v2/RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md), tests [`functions/test/grillaMesAgenteCore.test.js`](functions/test/grillaMesAgenteCore.test.js).

