# Análisis coherencia — Orquestación (repaso) vs planes vs código

**Fecha:** 2026-05-29 (post-repaso Bloques 1–6)  
**Fuentes decisión:** [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](MANUAL_CAPAS_ORQUESTACION_BORRADOR.md), [`PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md`](PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md) §15–22, [`PENDIENTES_PROXIMA_SESION.md`](PENDIENTES_PROXIMA_SESION.md)  
**Fuentes técnicas:** [`PLAN_GRILLA_MULTI_HLG_V2.md`](PLAN_GRILLA_MULTI_HLG_V2.md), [`PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](PLAN_CAPA_TEORICA_ASISTENCIA_V2.md), [`RFC_CIERRE_PERIODO_LIQUIDACION_V2.md`](RFC_CIERRE_PERIODO_LIQUIDACION_V2.md)

---

## 1. Mapa documental (qué dice cada plan)

| Documento | Rol respecto al repaso |
|-----------|-------------------------|
| **Manual borrador §1–6** | Reglas de negocio cerradas en repaso (M+M+1, purge, cierre manual, licencias, tabla evento) |
| **PLAN_CURSOR §15–22** | SSoT análisis + deuda técnica (piloto D2/D11, `materializarRango`, gates) |
| **PLAN_GRILLA_MULTI_HLG_V2** | Épica implementada: `vis_*` scoped por `gdt`, `capa_teorica_por_grupo`, gates E11 |
| **PLAN_CAPA_TEORICA** | Worker, plan vs HLG, `materializacion_fallida` en **aprobación de plan** |
| **RFC cierre período** | Estados EPL; callables cerrar/reabrir (fase 1 manual acordada) |
| **PENDIENTES** | Backlog O-P0…O-P2 orquestación + PR Multi-HLG |

**Coherencia global:** el repaso **no contradice** Multi-HLG scoped; **extiende** gobernanza temporal (día 5 mat, cierre período, purge HLg) que la biblia Multi-HLG no detalla.

---

## 2. Confrontación por dominio

### 2.1 Capa teórica / materializar

| Regla repaso | Código | Estado |
|--------------|--------|--------|
| Alta HLg → M+M+1 | `catalogosLaborales.js` post-alta `materializarTurnoMesBatch` mes actual + siguiente | **Alineado** |
| Informar cada materialización | Parcial logs; planes RRHH sin toast unificado | **Brecha UX** (O-P0-5) |
| Día 5 M+1 idempotente | No hay job Scheduler | **No implementado** |
| `materializarRango` por evento | Batch sigue siendo mes entero en worker | **Brecha** (plan §16.4) |
| Plan > HLG en motor | `rdaTurnoTeoricoWorker` `aplicarFotoPlanDia` / foto plan | **Alineado** (incidente Z documentado) |

### 2.2 HLg / purge / régimen

| Regla repaso | Código | Estado |
|--------------|--------|--------|
| No editar régimen en HLg vigente | VAL-HLG-018 patrón cerrar + nueva HLg | **Alineado** |
| Cerrar HLg → purge desde fin+1 | `rrhhDeshabilitarHlg` solo mat **mes en curso** | **Brecha grave** (fantasmas) |
| Eliminar → purge desde fecha_inicio | Sin purge | **No implementado** |
| Doble confirmación purge | No en UI | **No implementado** |

### 2.3 Grilla operativa (GSO) — lectura asi vs vis

| Expectativa documental | Comportamiento código | Estado |
|------------------------|----------------------|--------|
| GSO lee proyección mensual coherente con capa 1+3 | Calendario MDC: **solo `vis_*`** en carga (`grillaMesAgenteCore.leerVistaGrillaMesAgente`) | **Alineado** para UI |
| Lazy repara capa 1 si vacío/degenerado | `ensureMaterializacionVisMes` → `materializarTurnoMesBatch` → re-lee `vis_*` | **Alineado** |
| Validar asi vs vis en listado | **No** — no hay reconciliación en listado mensual | **Brecha** (solo en `obtenerCapaTeoricaDia`) |
| Acotar lazy si día 5 cubre ventana | Lazy sigue activo para fijo/rotativo | **Pendiente** O-P2-3 |

**Lecturas/escrituras mejorables (sector 60 personas):**

- `listarVistaGrillaMesPorGrupo`: 1× query HLg grupo + getAll HLD + **hasta 60×** (`leer vis` + posible **31× get asi/día + batch write** por lazy).
- Modo titular multi-cargo: **N callables** (uno por `gdt` vigente) en `useGrillaMesVista.js`.
- `grillaTurnoEntornoGate`: bucle **cada día** del tramo si `depende_rda` → hasta 365× get `asi_*` por solicitud (repaso: cambiar a anclas).

### 2.4 Turno mensual (planes `plt_*`)

| Regla repaso | Código | Estado |
|--------------|--------|--------|
| `grilla_aprobada` histórica | `aprobarPlanTurnoServicio` + materializar grupo | **Alineado** |
| Fallo mat → aviso RRHH | `materializacion_fallida` en `planesTurnoServicio` | **Solo flujo plan** (Explorador RRHH), **no** GSO calendario |
| Usuario nuevo → plan paralelo | No implementado | **Brecha** §19.6 |
| Anotación cambio base sin reescribir foto | Parcial eventos laborales | **Parcial** |

### 2.5 Licencias / RDA / gate

| Regla repaso | Código | Estado |
|--------------|--------|--------|
| `fecha_desde` fin mes siguiente | `validarHorizonteTemporalAgente` / `ymdFinHorizonteAgenteBase` | **Alineado** |
| `depende_rda` anclas desde/hasta | Itera **todo** el tramo en `grillaTurnoEntornoGate.js` | **Brecha** (lógica distinta a repaso) |
| Calendario/hábiles/corridos sin gate RDA día a día | `depende_rda !== true` → ok sin leer asi | **Alineado** |
| MDC crea `vis` mínimo | `mdcFanOutVis` merge | **Alineado** |
| Mes cerrado: en trámite OK, nuevas no | `assertPeriodoNoCerrado` en overrides; MDC **no** distingue pre-cierre | **Brecha** O-P0-3 |

### 2.6 Cierre período

| Regla repaso | Código | Estado |
|--------------|--------|--------|
| Cierre manual RRHH fase 1 | RFC callables; **no** exportados en índice funciones según análisis previo | **Pendiente** |
| Día 1 solo lectura M-1 | No contrato `solo_lectura` en callables grilla | **Pendiente** O-P1-3 |
| Auto día 5 liquidación | Diferido | **OK por decisión** |

---

## 3. ¿Se informa a RRHH si hay problema en asi/vis?

| Canal | Qué detecta | ¿RRHH/usuario? |
|-------|-------------|----------------|
| **GSO calendario** (`GrillaMesLicenciasPanel`) | Error callable, `error_carga`, `!existe` → “Sin materialización aún” | Mensaje **genérico**; no distingue degenerado, fallo batch, sin HLg |
| **`materializado_lazy`** | Backend flag | **No** se muestra en UI (deuda D10) |
| **`truncado` (>60)** | Backend | **No** en UI |
| **Fallo `materializarTurnoMesBatch`** | `ok: false`, sin HLg | **No** propagado al cliente tras lazy |
| **Planes turno** | `materializacion_fallida` | **Sí** en flujo aprobar plan / explorador RRHH |
| **Piloto scripts / audit** | `audit-vis-junio`, materializar-grupo-mes | Operación manual, no producto |
| **Repaso O-P0-5** | Informar materializar/purge | **Por implementar** |

**Conclusión:** problemas estructurales **asi/vis** en grilla operativa mensual **no** tienen alerta dedicada para RRHH; a lo sumo celdas vacías/NL o textos ambiguos. Coherente con decisión repaso de **trazabilidad** explícita pendiente.

---

## 4. Validaciones y errores destacados

| ID | Tipo | Descripción |
|----|------|-------------|
| E1 | Coherencia | Documento pide purge HLg; código solo rematerializa mes curso al deshabilitar |
| E2 | Performance | Listado sector: hasta 60 lazy materializations secuenciales |
| E3 | Performance | Gate `depende_rda` O(n días) vs anclas acordadas |
| E4 | UX | Lazy falla silencioso → `existe: false` sin código de causa |
| E5 | Seguridad producto | `listarVistaGrillaMesPorGrupo` sin validar jefe del `gdt` (deuda plan v2) |
| E6 | Datos | GSO no detecta desalineación `asi` capa teórica vs `vis` `rda_*` |
| E7 | Reglas | Cierre período vs MDC en trámite no implementado según repaso |

---

## 5. Plan de contención inmediato — 3 riesgos críticos P0 (validación equipo)

Evaluación acordada: si estos tres puntos llegan a producción sin mitigar, hay riesgo de **corrupción de datos**, **saturación Firestore / timeouts** y **errores operativos de nómina** (interpretación errónea de grillas vacías).

### P0-A — Fuga de datos en el futuro (E1 / O-P0-4 — purge ausente)

| | |
|--|--|
| **Problema** | `rrhhDeshabilitarHlg` solo rematerializa mes en curso; no elimina teórico **desde `fecha_fin + 1`** (ni purge por eliminación HLg desde `fecha_inicio`). |
| **Impacto** | **Empleados fantasma**: turnos teóricos y exigencia de fichada en meses/grupos donde ya no hay HLg vigente. |
| **Contención** | Contrato **purge explícito** (delete forward): vaciar `capa_teorica_por_grupo[gdt]` en `asi_*` y señales teóricas en `vis_*`; **no** licencias/overrides. UX doble confirmación (`purge_desde`). |

### P0-B — Colapso por N+1 (E2 + E3)

| | |
|--|--|
| **Problema** | `grillaTurnoEntornoGate`: hasta **365 lecturas** `asi_*` por solicitud larga con `depende_rda`. `listarVistaGrillaMesPorGrupo`: hasta **60×** `ensureMaterializacionVisMes` **secuencial** (lazy fila a fila). |
| **Impacto** | Timeouts en Cloud Functions, lecturas Firestore masivas, UI congelada. |
| **Contención** | Gate: validación por **anclas** (`fecha_desde`, `fecha_hasta`) — sin exigir capa teórica en cada día intermedio (repaso §20.3). Listado equipo: materialización **bulk/batch** por `gdt`+mes (p. ej. `materializarGrupoMes` o cola), no lazy **por persona** en serie. |

### P0-C — Ceguera operativa en UI (E4, E6, D10)

| | |
|--|--|
| **Problema** | Fallo de lazy o snapshot degenerado → `existe: false` o celdas vacías **sin causa**; flags `materializado_lazy` / error de batch no llegan al usuario. |
| **Impacto** | RRHH interpreta “sin turno” cuando falló el motor de materialización → decisiones de nómina incorrectas. |
| **Contención** | Propagar `materializado_lazy`, código/motivo de fallo de batch, hint “rematerializar” en **toasts/badges** GSO; opcional badge por fila en sector RRHH. |

---

## 6. Priorización cruzada (documentación → código)

Ver backlog **O-P0…O-P2** en [`PENDIENTES_PROXIMA_SESION.md`](PENDIENTES_PROXIMA_SESION.md). **Orden de contención sugerido:** P0-A (purge) → P0-B (gate + listado bulk) → P0-C (observabilidad), en paralelo con O-P0-2 cierre período si RRHH lo exige antes.

---

## 6. Respuesta directa: ¿lee bien asi y vis la grilla operativa?

- **Para pintar el calendario mensual:** lee **`vis_*`** correctamente por `(persona, mes, gdt)`; licencias vienen de `dias[].eventos[]` en el mismo doc.
- **`asi_*`:** no se lee en la carga del listado; entra al **lazy** (materialización) y en modales día/cobertura/override.
- **Problemas:** si lazy falla o queda degenerado, la UI **no** explica causa ni apunta a RRHH a rematerializar/purge; no valida contra `asi_*` en el listado.
