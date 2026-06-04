# Criterios de aceptación — GSO conflictos Capa 1 vs Capa 3

**Módulo:** GSO (Grilla de Servicios Operativos) — Calendario licencias  
**Contexto:** Resolver opacidad visual en la superposición de capa teórica (1) y capa eventos/licencias (3). Evitar el síntoma de “celdas en blanco” y transparentar actos de recálculo ante el usuario.  
**Estado:** especificación + acta RRHH (§6) + piloto junio Sala **remediado** (§6.6) — junio 2026  
**Piloto de referencia:** MOSTO · Sala · plan vigente `plt_01KT9AZQGV0BRZVSEEMBT0141A` (histórico `plt_01KSXBAFCN14GSHXE7HMTZM3MK`)  
**Registro consolidado:** [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md) · **Brechas app:** [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md)

**Documentos relacionados:**

- [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md) — capas, materializar vs purge  
- [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md) — “efecto observador” al listar equipo  
- [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md) — histórico VER plan vs operativo  
- [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) — Plan > HLG

---

## 1. Reglas globales de aceptación (preámbulo)

Antes de la evaluación de casos específicos, la grilla debe cumplir los siguientes principios transversales:

- **Celda en blanco = error (P0):** Si una casilla del calendario GSO se renderiza **en blanco** (sin lectura visible), se trata como **defecto del sistema**, no como estado válido. **No se permite operar** sobre ese día (override, cobertura, gestión de turno, ni alta táctica desde esa celda) hasta corregir datos o rematerializar; el clic solo puede informar el error y derivar a soporte/plan/RRHH.
- **Visibilidad garantizada (anti-blanco):** Ningún estado persistido en `vis_*.dias[dd]` se renderizará como celda vacía si posee `eventos`, `tipo_dia` o licencia proyectada; si el motor detectaría “sin pintar”, debe forzar estado **ERROR_VISUAL** o **INCOMPLETO_PLAN** (escenarios I / C).
- **Capas superpuestas:** Si existe información tanto en capa 1 (turnos, francos, NL) como en capa 3 (licencias), **ambas** deben ser visibles. Los conflictos semánticos se exponen visualmente mediante alertas; no se resuelven ocultando datos.
- **Alcance de pantallas:** Estos criterios aplican estrictamente a la GSO operativa (vistas de equipo, sector y titular). La vista **VER plan histórico** queda excluida (solo lee foto de aprobación, sin capa 3).
- **Accesibilidad de UI:** Todos los badges, íconos y fondos rayados deben contar con su respectivo `title` o `tooltip` para accesibilidad y aclaración textual del conflicto.

### 1.1 Principio acordado — «Ningún día en blanco» + «No operar en error»

**Regla RRHH (acta):** *Si hay un día en blanco es un error. No se puede operar sobre un día en blanco.*

**Qué significa para el usuario:** en la GSO operativa (equipo, sector, titular), **cada casilla muestra siempre algo legible**. Un día **blanco** no es “libre” ni “sin turno”: es **fallo** (bug de UI o dato no materializado). **Prohibido** usar esa celda para coberturas, cambios de turno u otras mutaciones hasta que deje de ser blanco o pase a un estado explícito (rayado, ⏳, etc.).

**Qué puede mostrar la celda (siempre al menos uno):**

| Contenido | Ejemplo |
| :--- | :--- |
| Turno / franco / guardia / NL / feriado (capa 1) | M, T, F, NL |
| Código de licencia o trámite (capa 3) | 64-A, LAO |
| Estado explícito de **plan incompleto** (legado o error) | Fondo rayado + *«Laborable sin turno»* (escenario C) |
| Badges de reconciliación | ⚠️, 🔗, 📅, 🔒, ⏳ |

**Dos planos que no se mezclan:**

1. **Pantalla (UX):** «No más días blancos» = **US-1 / escenario T / C** — la UI **no** usa `tieneDatos=false` para ocultar la celda cuando hay `tipo_dia` o `eventos` o ambos.
2. **Calidad del plan (negocio):** «Todo día del mes planificado tiene valor» = **US-9 (P1 RRHH)** — al **habilitar**, cada laborable/guardia tiene **turno o franco**. **Hacia adelante:** ningún plan nuevo habilitado con huecos; ningún día **blanco** en GSO (§1.1). **Remediación (acta jun 2026):** los planes **ya habilitados** que hoy tienen días en blanco o `laborable` sin turno deben **rehacerse** (revisión → corrección grilla → habilitar de nuevo) — **US-17**; no se opera turno sobre esas celdas hasta cerrar la remediación.

**Relación con Q9-1 = B (plan en revisión vs override):** corregir el plan **no** es “rellenar blancos en pantalla”; es alinear **capa 1** con la política. Mientras tanto, la celda **sigue mostrando** licencia + estado teórico vigente + rayado o ⚠️ según corresponda — nunca silencio visual.

**Estados de celda y operación permitida:**

| Estado en pantalla | ¿Es válido operar turno/cobertura? | Acciones permitidas |
| :--- | :--- | :--- |
| **Blanco** (sin lectura) | **No — error sistema** | Solo mensaje de error + derivación (US-16); registrar incidente QA |
| **INCOMPLETO_PLAN** (rayado, laborable sin turno) | **No — error planificación** (Q9-1 B) | Ver detalle; enlace a **plan en revisión** / RRHH; ver licencia si existe (solo lectura bandeja) |
| **Teoría + licencia con ⚠️** | **Sí con cautela** (US-14) | Bandeja, override si no 🔒, derivar plan |
| **Teoría coherente** | **Sí** | Flujo normal GSO |

**Lo que NO confunde este principio:** una celda **rayada** con *«Laborable sin turno»* **no** es blanco: se ve el error y **tampoco** se opera turno ahí hasta corregir el plan; sí puede verse la licencia encima (escenario B).

### Escenario T — Transversal (prioridad de licencia y anti-ocultamiento)

- **Dado** que `vis_*.dias[dd].eventos` contiene al menos un evento válido con `codigo_grilla`
- **Cuando** se procesa el renderizado de la celda en GSO
- **Entonces** la celda **debe** ser visible y mostrar prioritariamente el `codigo_grilla`
- **Y** la evaluación `tieneDatos=false` **no debe** ocultar la celda, independientemente de la ausencia de `rda_*` o turno en capa 1

---

## 2. Desglose de épicas e historias de usuario

### Épica 1 — GSO como tablero de diagnóstico (UX / Frontend)

| ID | Título / caso | Prioridad |
| :--- | :--- | :--- |
| **US-1** | Anti-blanco: celda siempre legible ante plan roto (C, T) | **P0** |
| **US-16** | Bloqueo: celda blanca o INCOMPLETO_PLAN — sin override/cobertura; solo derivación (acta §1.1) | **P0** |
| **US-2** | Renderizado: licencia sobre plan incompleto (caso B) | **P0** |
| **US-3** | Alerta: teoría modificada post-licencia (caso A) | **P1** |
| **US-4** | Identificador: imputación en otro sector / fan-out (caso E) | **P1** |
| **US-5** | Historial: post-purge HLg + licencias previas (caso F) | **P1** |
| **US-6** | Estado carga: teoría pendiente / lazy (caso G) | **P2** |
| **US-7** | Informativo: licencia solapada con franco (caso D) | **P2** |
| **US-8** | Bloqueo: mes cerrado con trámite visible (caso H) | **P1** |

### Épica 2 — Prevención de planificación rota (Backend / editor plan)

| ID | Título | Prioridad |
| :--- | :--- | :--- |
| **US-9** | Validación backend: error al habilitar plan si `tipo_dia` es laborable/guardia y `turno_id` es null | **P0** |
| **US-10** | Warning frontend: alerta en editor al guardar borrador con huecos de turno | **P1** |

### Épica 3 — Transparencia operativa (producto / opcional)

| ID | Título | Prioridad |
| :--- | :--- | :--- |
| **US-11** | Toast o aviso cuando `listarVistaGrillaMesPorGrupo` ejecuta materialización de grupo | **P2** |
| **US-12** | Spike / ADR: ¿desacoplar `materializarGrupoMes` del listado equipo? | Spike (RRHH acepta remat al abrir; US-11 priorizado) |

### Épica 4 — Reconciliación y gobernanza de teoría (post-workshop RRHH)

| ID | Título | Prioridad |
| :--- | :--- | :--- |
| **US-13** | Matriz de actos que cambian capa 1 por celda / mes (override, plan, HLg, remat) + permisos rol | **P1** |
| **US-14** | Acciones ante ⚠️: (1) bandeja solicitud, (2) override si mes abierto, (3) derivar plan/RRHH — acta Q9-6 | **P1** |
| **US-15** | Fichada real en detalle de celda (v1: RRHH; jefe sin payload sensible) | **P2** |
| **US-17** | **Remediación:** inventariar y rehacer planes habilitados con días blanco / INCOMPLETO_PLAN; checklist por `gdt` + mes | **P0** |

---

## 3. Criterios de aceptación (escenarios BDD / Gherkin)

**Background común:**

- **Dado** un documento `vis_*` para la persona *P*, mes *M* y grupo *GDT*
- **Y** el usuario interactúa con la pantalla de “Calendario de licencias” (equipo, sector o titular)

### Escenario A — Teoría modificada post-licencia o fichada inconsistente (desenganche)

- **Dado** que el día posee un evento de licencia aprobado o en trámite
- **Y** se cumple al menos una condición: (a) la capa 1 (`rda_*` / `tipo_dia`) difiere del contexto teórico de referencia de la licencia tras un acto posterior (HLg, régimen, listar equipo, feriado, plan, materialización), o (b) la fichada real **contradice** la teoría vigente en celda (según reglas de cruce y rol — acta Q9-4)
- **Cuando** se renderiza la celda en GSO
- **Entonces** la celda **debe** mostrar la licencia sobre el estado teórico vigente
- **Y** **debe** mostrar un badge de advertencia (⚠️) con tooltip acorde (*“Teoría modificada post-licencia”* / *“Fichada no coincide con turno teórico”*; motivo en metadata si existe)
- **Y** **debe** ofrecer acciones US-14: enlace a solicitud, ajuste de turno (si no 🔒), derivación a plan/RRHH (acta Q9-6)

### Escenario B — Licencia solicitada sobre plan incompleto

- **Dado** que el día posee un `tipo_dia` laborable o guardia pero carece de `turno_id` o jornada horaria visible en capa 1
- **Y** el día posee un evento de licencia en trámite o aprobado
- **Cuando** se renderiza la celda
- **Entonces** la celda **debe** mostrar prioritariamente el código de la licencia
- **Y** **debe** incluir un indicador crítico (marco o borde) con tooltip *“Licencia sobre plan incompleto (falta turno)”*
- **Y** las acciones de turno (override, cobertura, gestión de turno) **permanecen deshabilitadas** hasta regularizar el plan (acta §1.1; Q9-1 B); permitido enlace a bandeja de la solicitud (solo lectura)

### Escenario C — El “hueco” de planificación (caso MOSTO)

- **Dado** que el día posee un `tipo_dia` laborable o guardia pero carece de `turno_id` o jornada horaria visible
- **Y** el día **no** posee eventos de licencia (`eventos` vacío)
- **Cuando** el motor materializa y renderiza la vista
- **Entonces** la celda **no debe** quedar en blanco (exclusión del filtro `tieneDatos` estricto)
- **Y** **debe** mostrar un fondo visual de alerta (rayado) con texto *“Laborable sin turno”* (estado **INCOMPLETO_PLAN**)
- **Y** **no debe** permitir operaciones de turno (override, cobertura, gestión de turno) desde esa celda (acta §1.1; Q9-1 B)
- **Y** el clic **debe** abrir detalle en solo lectura o panel que priorice *“Corregir plan del mes”* (US-14 acción 3), sin habilitar mutación táctica

### Escenario I — Celda blanca (defecto; prohibido operar)

- **Dado** que el evaluador de celda determinaría `tieneDatos=false` o equivalente sin estado de error explícito
- **Cuando** se intenta renderizar o interactuar con esa casilla en GSO
- **Entonces** la implementación **no debe** dejar la casilla en blanco: debe forzar lectura mínima *“Error de visualización — contacte RRHH”* o materializar **INCOMPLETO_PLAN** si hay `tipo_dia` en persistencia
- **Y** **no debe** ejecutarse ninguna operación de negocio de turno desde esa celda hasta resolución (US-16)
- **Y** el incidente es candidato a regresión **P0** en QA

### Escenario D — Licencia sobre franco

- **Dado** que el día posee un `tipo_dia` equivalente a franco (sin jornada visible)
- **Y** el día posee un evento de licencia
- **Cuando** se renderiza la celda
- **Entonces** **debe** mostrar “F” (franco) junto al código de la licencia
- **Y** opcionalmente un hint (ℹ️) *“Licencia solapada en franco”*

### Escenario E — Imputación externa (fan-out / ancla en otro GDT)

- **Dado** que el evento de licencia posee un `grupo_trabajo_id_ancla` distinto al `grupo_de_trabajo_id` del `vis_*` actual
- **Cuando** se renderiza la celda en la grilla del grupo actual
- **Entonces** el código de la licencia **debe** ser visible
- **Y** **debe** convivir con un ícono (🔗) cuyo tooltip indique *“Licencia gestionada en otro sector ({nombre grupo ancla})”*

### Escenario F — Preservación visual post-purge (cierre de HLg)

- **Dado** que la capa 1 de un rango de días refleja cierre o purge de HLg (ej. `tipo_dia: no_laborable` o sin `rda_*` por purge)
- **Y** existen eventos de licencia en ese mismo rango
- **Cuando** se visualiza la grilla del mes en curso o histórico operativo
- **Entonces** cada celda afectada **debe** mostrar el estado teórico vigente junto al código de licencia intacto
- **Y** **debe** incluir un hint (📅) *“HLg inactiva — historial de licencia preservado”* (fecha de corte si se conoce)

### Escenario G — Teoría pendiente (lazy load)

- **Dado** que existen eventos de licencia proyectados en el `vis_*`
- **Y** la capa 1 para esos días está ausente o degenerada (aún no materializada de forma útil)
- **Cuando** se renderiza la celda
- **Entonces** la licencia **debe** ser visible
- **Y** el fondo **debe** adoptar estilo neutro/gris (⏳) con tooltip *“Teoría pendiente de cálculo”*

### Escenario H — Edición en mes cerrado

- **Dado** que el período de liquidación del mes visualizado está administrativamente cerrado
- **Y** existe un evento de trámite o licencia visible en ese mes (según gates de negocio)
- **Cuando** el usuario interactúa con la grilla
- **Entonces** la licencia es visible y la celda está bloqueada para mutaciones que alteren el mes cerrado
- **Y** **debe** mostrar un badge (🔒) *“Mes cerrado / solo lectura”* en acciones de edición de turno

---

## 4. Contrato de evaluación de celda (orden lógico para Frontend)

La UI **no** debe depender de un único booleano opaco. Orden sugerido de evaluación:

0. ¿Resultaría celda **blanca**? → forzar **ERROR_VISUAL** o estado explícito; **bloquear operación** (I, US-16).
1. ¿`eventos` con `codigo_grilla`? → mostrar licencia (siempre; escenario T).
2. ¿Laborable/guardia sin jornada? → **INCOMPLETO_PLAN** (C; B si hay licencia); **sin** acciones de turno.
3. ¿Jornada / franco / NL / feriado? → mostrar teoría.
4. ¿Conflicto teoría post-sync vs MDC? → badge ⚠️ (A).
5. ¿`grupo_trabajo_id_ancla` ≠ GDT del `vis_*`? → 🔗 (E).
6. ¿Contexto post-purge HLg? → hint 📅 (F).
7. ¿Período cerrado? → 🔒 en acciones de edición (H).

---

## 5. Trazabilidad caso ↔ historia

| Caso | Historias | QA mínimo |
| :--- | :--- | :--- |
| T | US-1 | Celda con solo `eventos`, sin `rda_*` |
| A | US-3 | Cambiar HLg o abrir equipo tras licencia |
| B | US-2, US-9 | Día 11 tipo MOSTO + 64-A |
| C | US-1, US-9, US-16 | Días 18/19/26 sin eventos; sin override |
| I | US-16 | Regresión: ninguna celda blanca en mes piloto |
| D | US-7 | LAO en franco plan |
| E | US-4 | Licencia ancla otro `gdt` |
| F | US-5 | Deshabilitar HLg con licencias previas |
| G | US-6 | Mes sin materializar, con solicitud |
| H | US-8 | Mes cerrado + trámite |

---

## 6. Workshop RRHH — acta y segunda ronda (punto 9)

**Fecha de registro:** 4 de junio de 2026.  
**Principio rector acordado:** la GSO operativa es un **tablero de reconciliación**: la teoría (capa 1) puede variar por plan, HLg, régimen, feriados y materialización; las licencias (capa 3) son relativamente estables. La UI debe **mostrar ambas** y señalar desalineación, no ocultar licencias ni “arreglar” en silencio.

### 6.1 Respuestas cerradas (primera ronda)

| # | Tema | Decisión RRHH | Impacto en backlog |
| :--- | :--- | :--- | :--- |
| **P1** | Plan habilitado con huecos | **A — No:** toda celda laborable/guardia debe tener turno o franco explícito antes de habilitar | **US-9 P0**, **US-10**; caso B (64-A sobre hueco) queda como **dato histórico** a corregir en plan, no como patrón deseado |
| **P2** | ¿Validar licencia al pedir vs teoría posterior? | Foco en **teoría que cambia después** de la solicitud; motor de licencias sigue validando al solicitar | Refuerza escenario **A**; acciones manuales (**US-14**) |
| **P3** | Badge ⚠️ en titular | **A — Sí**, mismas reglas que equipo/sector | **US-3** sube de prioridad efectiva |
| **P4** | Mismas reglas titular | **A — Sí** | Coherente con §1 alcance |
| **P5** | Tras deshabilitar HLg | Licencias **preservadas**; nueva HLg en el período debe **mostrar** licencias del tramo HLg anterior | **US-5**; definir copy del hint 📅 |
| **P6** | Materializar al abrir equipo | **A — Aceptan** rematerialización; exigen **toast/aviso** | **US-11**; **US-12** queda spike, no bloqueante |
| **P7** | Fichada real en reconciliación | Incluir en análisis de celda (junto a teoría vigente y licencia) | **US-15**; ver §6.2.2 |
| **P8** | Mes cerrado | Licencia visible + 🔒 en edición de turno | **US-8** |

**Nota P1 / piloto MOSTO:** los días 18, 19 y 26 (laborable sin `turno_id`) son **incumplimiento** de la política acordada; el síntoma “celda blanca” es UX sobre dato inválido, no pérdida de licencias.

### 6.2 Segunda ronda corta — Punto 9 (análisis, sin implementar)

Tres preguntas abiertas para cerrar diseño de **US-13 / US-14 / US-3**.

#### 6.2.1 ¿Quién y cómo puede “cambiar la capa teórica” de una celda?

En el **as-built** no existe un único botón “editar teoría de celda”. La capa 1 se actualiza por **canales** distintos; conviene nombrarlos en capacitación y en US-13.

| Canal | Actor típico | Alcance | Efecto en operativo (`vis_*` / `asi_*`) | ¿Re-materializa? |
| :--- | :--- | :--- | :--- | :--- |
| **Editor plan mensual** (`guardar` / `enviar` / `habilitar`) | Jefe (borrador); RRHH **habilita** | Mes × agentes del `gdt` | Al **habilitar**: snapshot `grilla_aprobada` + materialización de grupo; teoría alineada al plan | Sí (habilitar) |
| **Revertir plan** (`EN_REVISION`) | RRHH | Estado del `plt_*` | **No** toca `vis_*` hasta nueva habilitación; GSO sigue teoría del último ciclo habilitado | No (solo revertir) |
| **Override puntual** (`registrarCambioTurno` desde GSO) | Jefe / quien tenga `puedeGestionarTurno` | Un día, un agente | Override en `asi_*`; resolución **override > plan > régimen** | Sí (día / rango según callable) |
| **Cambio HLg / régimen / calendario** | RRHH (datos laborales / config) | Desde fecha de vigencia | Purge forward o recálculo según política HLg; licencias en `eventos[]` **no** se borran | Sí (purge + mat o remat admin) |
| **Abrir calendario de equipo** (`listarVistaGrillaMesPorGrupo`) | Cualquier rol con acceso GSO equipo | Mes del grupo | Puede ejecutar `materializarGrupoMes` (efecto observador) | Sí (si worker corre) |
| **Rematerializar explícito** (admin / post-calendario) | RRHH / proceso batch | Rango o grupo | Actualiza `rda_*` / `tipo_dia` en `vis_*` sin tocar `eventos[]` | Sí |

**Recomendación producto (para cerrar con RRHH):**

1. **Ajuste táctico del día** (cobertura, cambio de franco puntual): **override GSO** — jefe (y RRHH siempre).
2. **Corrección estructural del mes** (huecos, francos mal puestos): **plan en `EN_REVISION`** → editar grilla → volver a **habilitar** (RRHH); no “parchar” huecos solo con override salvo excepción documentada.
3. **Teoría por dotación/reglas** (HLg, régimen): solo **RRHH** (o rol equivalente en HLC), con mensajes 📅 / purge ya acordados.
4. **US-14:** ante ⚠️, acciones explícitas en UI: *“Anular / revisar artículo en bandeja”* (todos los roles que ya gestionan ticket) y *“Ajustar turno del día”* (override o derivación a plan si mes no cerrado 🔒).

**Acta Q9-1 = B:** cambio de jornada oficial del mes → **reapertura de plan**; override solo excepciones operativas urgentes (no sustituye corrección de huecos de planificación).

#### 6.2.2 ¿Fichada real en la misma celda para v1 de US-3?

**Estado técnico:** la capa de fichadas en `vis_*` existe en modelo; para **jefe**, los callables de listado GSO **sanitizan** `fichadas_reales` / `capa_realidad` (`grillaVisSanitizeGso.js`, pendiente UX-6 en titularidad completa).

**Recomendación v1 (alineada a P7):**

| Rol | En grilla mes (celda) | En modal detalle día |
| :--- | :--- | :--- |
| **RRHH** | Opcional v1: solo badge “hay fichada” si hay cruce; detalle horario en modal | **Sí:** bloque “Fichada real” + teoría + licencia + ⚠️ si teoría ≠ contexto al aprobar |
| **Jefe** | Sin horarios de fichada en API (UX-6) | Teoría + licencia + overrides; enlace a gestión turno si aplica |
| **Titular** | Igual política que jefe para datos sensibles | Teoría + sus licencias; sin fichada de terceros |

**Acta Q9-4 = B:** el badge ⚠️ de escenario **A** en v1 dispara por **teoría ≠ referencia de la licencia** **o** por **fichada que contradice** la teoría vigente (ver Q9-3 para exposición por rol).

#### 6.2.3 ¿Mostrar ⚠️ si solo “abrir equipo” cambia la teoría (sin HLg ni plan)?

**Hecho:** si `listarVistaGrillaMesPorGrupo` dispara `materializarGrupoMes`, la teoría persistida puede **actualizarse** aunque el usuario no haya tocado plan ni HLg (p. ej. corrección de bug de materialización, feriado recién cargado, régimen ya vigente pero `vis_*` desactualizado).

**Recomendación (causa-agnóstica, coherente con P6):**

- **Sí** mostrar ⚠️ cuando, para el día *D*, la **teoría vigente en celda** (capa 1 renderizada) **difiera** del **contexto teórico de referencia** asociado a la licencia (p. ej. proyección al solicitar, o snapshot en aprobación / última sync MDC relevante), comparando campos estables: `tipo_dia`, `rda_turno_id`, franco, guardia.
- El tooltip incluye, si existe, `ultimo_motivo` / timestamp de metadata del `vis_*` (materialización, plan habilitado, HLg, etc.), **sin exigir** que el usuario haya ejecutado HLg o plan en esa sesión.
- **No** tratar “solo abrir equipo” como excepción silenciosa: si la teoría cambió, el tablero debe reflejarlo (RRHH aceptó remat + **US-11** informa el acto técnico).
- **Matiz v2 (opcional):** no disparar ⚠️ si la materialización no alteró ningún campo teórico del día (comparación idempotente); evita ruido si solo se refresca `ultima_sync` sin cambio semántico.

**Relación con escenario A (Gherkin §3):** el paso *“evidenciado en metadata de sincronización teórica respecto de la licencia”* se interpreta como **cualquier** actualización de capa 1 posterior al instante de referencia de la solicitud, **incluida** materialización al listar equipo.

### 6.3 Tercera mini-ronda RRHH — respuestas (4 jun 2026)

| ID | Pregunta (resumen) | Respuesta | Implicación producto |
| :--- | :--- | :--- | :--- |
| **Q9-1** | Jefe corrige jornada en mes habilitado | **B** | Cambio de jornada **oficial** del mes → **plan en revisión** (RRHH revierte → jefe edita → RRHH habilita). Override reservado a **urgencias excepcionales** (definir en capacitación / US-13; no sustituye corrección de huecos tipo MOSTO 18/19/26). |
| **Q9-2** | Motivo del override | **A** | Mantener **texto libre obligatorio** en override (auditoría actual); sin catálogo `cfg_*` en v1. |
| **Q9-3** | Fichada en GSO v1 | **C** | **RRHH:** fichada en grilla (indicador) + detalle con horarios. **Jefe:** solo **presente/ausente** sin horario. **Titular:** sin fichada. |
| **Q9-4** | ⚠️ y fichada en v1 | **B** | Badge ⚠️ si cambió **teoría** post-referencia de la licencia **o** si la **fichada contradice** la teoría vigente (US-3 ampliado; requiere reglas de cruce y datos para RRHH/jefe según Q9-3). |
| **Q9-5** | ⚠️ al solo abrir equipo / materializar | **A** | **Causa-agnóstica:** ⚠️ si teoría visible ≠ contexto de referencia de la licencia, incluida sync al listar equipo; complementar con **US-11** (toast). Matiz idempotente queda **v2** opcional. |
| **Q9-6** | Acciones ante ⚠️ (US-14) | **1 + 2 + 3** | Enlaces/botones: (1) ir a solicitud/bandeja, (2) ajustar turno del día (override si mes no 🔒), (3) derivar a corrección de plan / RRHH. **No** “solo tooltip”. |
| **Q3-1** | ⚠️ sin licencia, solo hueco → franco | **B** | ⚠️ **solo** si en ese día o tramo hubo **licencia/trámite** relevante y la corrección de teoría genera desalineación con ese contexto; **sin** licencia → escenario **C** (rayado / texto), no ⚠️. |
| **Q3-2** | Copy 📅 post-deshabilitar HLg | **A** | Texto oficial: *«Sin dotación en este grupo desde el {fecha}. Licencias del período anterior conservadas.»* — `{fecha}` = fecha efectiva de baja/inactivación HLg acordada en operaciones. |
| **Q3-3** | Piloto junio / 64-A sobre hueco | **C** *(revocado)* | Ver **§6.5** — decisión posterior: **sí** rehacer planes afectados. |
| **—** | Celda blanca | **Acta explícita** | Blanco = **error**; **prohibido operar** (US-16 P0). Rayado incompleto = visible pero **sin** override/cobertura hasta plan (§1.1). |
| **—** | Remediación + adelante | **Acta jun 2026** | **Rehacer** planes actuales con blanco/hueco; **en adelante** US-9 + anti-blanco obligatorios (**§6.5**, US-17). |

### 6.5 Remediación de planes y política «en adelante» (acta RRHH)

**Decisión:** hay que **rehacer los planes que hoy tengan días en blanco** (o equivalente en BD: laborable/guardia sin `turno_id` tras habilitación). **En adelante** no más días blancos ni habilitación con huecos.

**Qué cuenta como plan a remediar**

| Señal | Ejemplo piloto |
| :--- | :--- |
| Celda **blanca** en GSO equipo/titular del mes habilitado | Cualquier día sin lectura en grilla |
| Celda **INCOMPLETO_PLAN** (rayado) con plan **HABILITADO** | MOSTO jun 2026 días 18, 19, 26 en `plt_01KSXBAFCN14GSHXE7HMTZM3MK` |
| Licencia sobre hueco (64-A día 11) | Tras rehacer plan: turno o franco explícito; licencia se **muestra** encima (B), sin operar turno hasta plan válido |

**Procedimiento operativo (por cada `plt_*` afectado)**

1. RRHH **revierte** plan a `EN_REVISION` (teoría operativa del mes sigue la última habilitación hasta el paso 4).
2. Jefe completa **toda** la grilla: cada laborable/guardia con turno o franco (sin celdas vacías en editor).
3. RRHH **habilita** de nuevo → materialización grupo; validación **US-9** debe pasar.
4. Verificar GSO: **ningún blanco**; huecos pasan a turno/franco o desaparecen; licencias en `eventos[]` intactas.
5. Celdas con ⚠️ residual (teoría cambió vs licencia) se resuelven por **US-14**, no ignorando el replan.

**Alcance piloto:** incluye **junio 2026 Sala** y demás planes detectados en inventario US-17 (consulta planes `HABILITADO` + auditoría grilla o script de huecos).

**En adelante (obligatorio)**

- **US-9 P0:** rechazar habilitar si falta turno/franco en laborable/guardia.
- **US-10:** aviso en editor al guardar borrador con huecos.
- **US-1 / US-16 / escenario I:** si aun así aparece blanco en GSO → defecto P0; sin operación.
- **Q9-1 B:** no sustituir remediación masiva por overrides del jefe.

**Licencias ya tramitadas (ej. 64-A día 11):** el replan **no anula** solicitudes; regulariza capa 1. Si la licencia queda incoherente con la nueva teoría → ⚠️ y bandeja (Q9-4/6).

**Notas de coherencia (para implementación futura):**

- **Q9-1 + Q9-6:** el botón (2) override sigue existiendo pero la política RRHH prioriza (3) para correcciones estructurales; conviene mensaje en UI si el mes está habilitado y el día era hueco de plan.
- **Q9-3 + Q9-4:** el jefe necesita señal **presente/ausente** agregada en API (distinto de `fichadas_reales` completas); RRHH consume fichada completa para regla **B** del ⚠️.
- **Remediación (§6.5):** MOSTO 11/18/19/26 y planes equivalentes entran en **US-17**; tras replan, sirven de regresión “sin blanco / sin INCOMPLETO_PLAN”.

### 6.6 Validación piloto — junio 2026 Sala (post replan)

| Evidencia | Resultado |
| :--- | :--- |
| Plan vigente `plt_01KT9AZQGV0BRZVSEEMBT0141A` | `HABILITADO`, `eliminado: false`, **0** huecos en plan |
| MOSTO `vis_*` días 11, 18, 19, 26 | Alineado a plan; 11 = franco + **64-A** |
| LOKITO plan ↔ `vis_*` | **0** desalineaciones mes |
| UI Calendario licencias equipo | 2 filas; días 1–27 con lectura; **sin blancos** (captura 2026-06-04) |
| CHAPARRO | Fuera del plan vigente; `vis_*` = `no_laborable` (HLg baja) — no confundir con hueco |

Detalle: [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md).

---

## 7. Definition of Done (épica 1 + remediación)

- [ ] Escenarios T, C, B, I pasan en equipo y titular (regresión anti-blanco).
- [ ] No regresión: licencias LAO/64-A visibles tras abrir grilla de equipo.
- [ ] Tooltips/badges accesibles (`title` o componente equivalente).
- [ ] Doc operaciones comunicado a RRHH/jefes (épica 3 o capacitación).
- [x] **US-17 (piloto):** junio 2026 Sala replanificado (`plt_01KT9…`) — BD + UI sin blancos (§6.6).
- [ ] **US-17 (global):** inventario resto `gdt`/meses con hueco/blanco.
- [ ] **US-9** activo: ningún plan nuevo habilitado con laborable/guardia sin turno o franco.

---

**Fin del documento**
