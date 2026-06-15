# Handoff — Pausa QA fichadas + motor colisión grilla (Fase 1)

> **Fecha pausa:** 2026-06-12  
> **Rama activa:** `feature/grilla-fase1-colision` (remoto sincronizado)  
> **Producción:** https://portal-hospital-v2.web.app  
> **Gate obligatorio antes de seguir el plan Decreto 1919 / nuevas features:** completar **checklist §3** (QA ingreso fichadas + cruce teoría ↔ real).

---

## 1. Objetivo alcanzado en esta rama (no mergear a `master` sin QA)

| Bloque | Commits referencia | Estado |
|--------|-------------------|--------|
| Motor analítico colisión (disciplina + débito) | `4f2324b` | ✅ Código + tests `npm run test:grilla-cumplimiento` |
| Outbox post-import → `materializarTurnoTeoricoDia` | `36fd0b6` | ✅ Trigger `onColaRematerializacionAsistencia` desplegado |
| F-UX badges + modal auditoría por rol | `f5f184c` | ✅ Hosting desplegado |
| Fixes operativos fichadas (sesión 12/06, commit pendiente de hash al cierre) | — | ✅ En rama; ver §2 |

**Regla de producto:** el módulo fichadas en `master` sigue en **mantenimiento estricto** salvo fixes; la **colisión analítica** vive en esta rama hasta cerrar QA y merge.

---

## 2. Cambios técnicos recientes (sesión 12/06 — post F-UX)

| Tema | Detalle |
|------|---------|
| Modal grilla RRHH «Agregar marcas» | Tras guardar, se refresca `celdaVis` del modal (`obtenerVistaGrillaMesAgente`) — `GrillaMesLicenciasPanel` |
| Enrolamientos consulta | Callable `listarEnrolamientoRelojPorPersona` desplegada; búsqueda por **DNI** o `per_*` ULID |
| Carga manual — catálogo relojes | Callable `listarCfgRelojBiometrico`; hook con reintento; enlace a alta si lista vacía |
| Carga manual — habilitación | Formulario habilitado con reloj universal/sectorial **o** `?gdt_id=` desde grilla sin reloj |
| Roster universal multi-cargo | `listarRosterFichadasCore` incluye `multi_cargo_universal` + GDT vigente por fecha |
| Roster sectorial sin fecha | `useCargaManualRoster` usa `listarRosterParaFichadas` si aún no hay fecha sticky |

### Callables desplegadas en prod (además del bloque outbox)

`listarEnrolamientoRelojPorPersona`, `listarRosterParaFichadas`, `listarCfgRelojBiometrico`, `guardarCapaFichadaDia`, `aplicarImportFichadasReloj`, `guardarEnrolamientoRelojPersona`, `onColaRematerializacionAsistencia`, `previsualizarImportFichadasReloj`.

### Tests npm (local)

| Comando | Qué cubre |
|---------|-----------|
| `npm run test:fichadas-modulo` | Fichadas A–D + multi-cargo + GSO sanitize + cfg reloj |
| `npm run test:grilla-cumplimiento` | Motor `calcularDeltasCumplimiento` + sanitize analítica jefe |
| `npm run test:grilla-outbox` | Cola rematerialización (lógica pura) |
| `npm run test --prefix web -- --run src/features/grilla/grillaAnaliticaCumplimientoUi.test.js` | Copy UI badges |

---

## 3. CHECKLIST QA — Próxima sesión (OBLIGATORIO)

Validar en **https://portal-hospital-v2.web.app** con usuario RRHH y, donde aplique, Jefe. Agente piloto habitual: **MOSTO** DNI `28914247` · Sala Internación 1 · turno M 06:00–14:00.

### Acta parcial 2026-06-12 (sesión retomo)

| Bloque | Estado | Notas |
|--------|--------|-------|
| 3.1 Catálogo y enrolamiento | ✅ OK | Validado por usuario |
| 3.2 Import TXT | 🔧 fix local | Input nativo Windows confundía con “sin función”; botón explícito + hint flujo Previsualizar |
| 3.2 Carga manual menú | 🔧 fix local | Enter en Egreso fallaba en reloj universal: `getVisCelda` sin `gdt` del agente → error silencioso |
| 3.2 Carga manual desde grilla | 🔧 fix local | Guardaba pero grilla no refrescaba (caché T-07); invalidación post-guardado |
| 3.2 ABM modal «Agregar horas» | 🔧 fix local | Modal OK; tabla grilla sin refresh/invalidación caché |
| 3.3 Render post-carga | 🔧 revalidar | Sin F:n; horario **real celeste** en celda RRHH; teórico solo en modal; analítica async ~1–2 min |
| 3.4 Cruce teoría ↔ real | ⏳ matriz | [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md) — escenarios B/P/C |

**Fixes sesión 12/06:** persistencia fichadas, bloqueo cola, motor fuera de turno, visual real/teórico — ver [`HANDOFF_SESION_2026-06-12_CIERRE_PAUSA_MATRIZ_QA.md`](./HANDOFF_SESION_2026-06-12_CIERRE_PAUSA_MATRIZ_QA.md).

**Deploy hosting:** realizado (F-UX visual). Cambios backend adicionales pueden requerir `npm run firebase:deploy:functions` tras commit.

### 3.1 Catálogo y enrolamiento

- [ ] **RRHH → Relojes biométricos:** listado carga; alta/edición reloj sectorial y universal.
- [ ] **RRHH → Enrolamiento:** alta tarjeta ↔ persona (multi-cargo universal si aplica).
- [ ] **RRHH → Enrolamientos cargados:** buscar por DNI `28914247` y por `per_*`; sin toast `internal`.

### 3.2 Ingreso de fichadas — todos los caminos

| Camino | Ruta / acción | Verificar |
|--------|---------------|-----------|
| **Import TXT** | `/portal/rrhh/fichadas-import` | Preview → aplicar → marcas en `vis_*` por GDT correcto |
| **Carga manual menú** | `/portal/rrhh/fichadas-carga-manual` | Elegir reloj → roster > 0 → Enter flujo → cola sesión → persistencia |
| **Carga manual desde grilla** | Modal día → enlace manual con `gdt_id` + `persona_id` + `fecha_ymd` | Formulario habilitado; mismo guardado |
| **ABM modal grilla RRHH** | Grilla equipo → día → «Agregar horas» `06:05 14:00` | Lista y auditoría técnica muestran filas tras guardar |
| **Enrolamiento → huérfanas** | Tras enrolar, reconciliación | Marcas pasan a `vis_*`; outbox dispara analítica (async) |

### 3.3 Render y visualización post-carga

- [ ] Celda grilla: presencia / semáforo jefe (sin horas crudas para jefe).
- [ ] Celda grilla: badges **▲ Xm** / **-Zm** si hay analítica (`analitica_cumplimiento`).
- [ ] Modal día **RRHH:** marcas crudas + bloque «Auditoría de cumplimiento horario» (numérico).
- [ ] Modal día **Jefe:** sin marcas crudas; tarjetas disciplina / débito en lenguaje administrativo.
- [ ] Tras import: esperar ~1–2 min o rematerializar; revisar `analitica_cumplimiento` en celda (outbox).

### 3.4 Cruce teoría ↔ real (objetivo de control)

- [ ] Teoría visible: `rda_ingreso` / `rda_egreso`, `fichadas_esperadas`, tipo día.
- [ ] Real: `fichadas_reales` (solo RRHH) alineadas a teoría (ingreso/egreso por fila).
- [ ] Analítica: tardanza desde nominal si pasa gracia; déficit horario vs `tolerancia_debitohorario_minutos` del régimen.
- [ ] Caso sin fichadas + día laborable pasado ventana: `ausencia_automatica` en analítica (backfill).

### 3.5 Regresión y errores conocidos a revalidar

- [ ] Período liquidación **abierto** en el mes de prueba.
- [ ] Reloj universal: agente con varios GDT vigentes aparece en roster (una fila por GDT si corresponde).
- [ ] `write_skipped`: toast informativo si marcas idénticas (no confundir con fallo).

**Criterio de salida del gate:** todos los ítems críticos (3.2 + 3.3 + al menos un caso 3.4) en verde documentado en este archivo o acta breve.

---

## 4. Qué NO hacer hasta cerrar §3

- No avanzar **Decreto 1919 / motor solicitudes** como épica principal.
- No nuevas features de grilla F3+ más allá de fixes de bugs del checklist.
- Merge `feature/grilla-fase1-colision` → `master` solo tras QA + deploy functions completo de la rama.

---

## 5. Retomo en otra PC

```bash
git fetch origin
git checkout feature/grilla-fase1-colision
git pull origin feature/grilla-fase1-colision
npm install
npm install --prefix web
```

Deploy si hubo cambios solo locales: `npm run build:web` + `npm run firebase:deploy:functions` (o subset documentado en §2).

---

## 6. Referencias cruzadas

- RFC fichadas: [`MODULO_FICHADAS_RELOJ_V2.md`](./MODULO_FICHADAS_RELOJ_V2.md) §14 (colisión + mantenimiento).
- **Matriz QA escenarios:** [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md).
- Cierre sesión: [`HANDOFF_SESION_2026-06-12_CIERRE_PAUSA_MATRIZ_QA.md`](./HANDOFF_SESION_2026-06-12_CIERRE_PAUSA_MATRIZ_QA.md).
- Índice continuidad: [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) (bloque 2026-06-12).
- Motor colisión (código): `shared/utils/calcularDeltasCumplimiento.js`, `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` (`persistirAnaliticaCumplimientoDia`), `cola_rematerializacion_asistencia`.

---

**Última actualización:** 2026-06-12 — cierre sesión; matriz QA + handoff cierre; próxima sesión validar escenarios B/P/C.
