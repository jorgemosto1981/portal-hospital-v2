# Punto de Continuación — Próxima Sesión

**Última actualización:** Smoke ticketera HLg corte inclusivo + Patrón C — 2026-06-01 (tarde) · rama `feat/epic-multi-hlg-fase1-execution` · fix `solicitudHlgVigencia` **deploy prod** (9 callables)  
**RETOMAR AQUÍ (épica scoped):** [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md)  
**RETOMAR AQUÍ (reglas orquestación):** [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](./HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md)

| Campo | Valor |
|-------|--------|
| **Branch trabajo** | `feat/epic-multi-hlg-fase1-execution` @ `4bcdb60` (local ahead; push pendiente) |
| **master** | `25bc00c` — merge épica Multi-HLG + checkpoint grilla RRHH |
| **Tag pre-ejecución** | `pre-ejecucion-v2` (docs); código funcional posterior en `942adcf` |
| **Biblia** | [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) |
| **Handoff incidente Z** | [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) |
| **Producción** | https://portal-hospital-v2.web.app |
| **Plan piloto** | `plt_01KSSPY2H5EZA925FQP4S1G2XW` · Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| **Tag salvavidas** | `v2.2.0-pre-multi-hlg` |
| **SSoT orquestación** | [`PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md`](./PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md) §15–22 |
| **Manual borrador** | [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md) |
| **Coherencia doc ↔ código** | [`ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md`](./ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md) |
| **Roadmap sucesivo F0–F4** | [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md) |

---

## Resumen ejecutivo — repaso orquestación (Bloques 1–6)

**Objetivo del repaso:** fijar reglas de negocio y deuda técnica entre **HLg / régimen / materialización (capa 1) / licencias (capa 3) / plan mensual / cierre de período**, sin implementar código en esta vuelta.

**Modelo mental:** capas 0→4 + GSO solo lectura. **Materializar** = solo capa 1, informado al usuario. **Purge** ≠ materializar.

| Tema | Decisión cerrada |
|------|------------------|
| Ventana teórica fijo/rotativo | **Mes actual + mes siguiente**; día **5**: M+1 idempotente; días **1–4** altas HLg pueden adelantar M+1 |
| Licencias — `fecha_desde` | Fin del **mes siguiente** (alineado a M+M+1) |
| Licencias — `depende_rda` | Hábiles/corridos/calendario: OK. RDA: bloqueo si falta en **anclas** (`fecha_desde` / `fecha_hasta`) — **implementado** en gate (`942adcf`) |
| LAO + cambio HLg | **Rodante:** solo capa 1; LAO intacta; reintegro con `gdt` vigente |
| `vis` mínimo | MDC crea/merge; materialización añade `rda_*` en el **mismo** `vis_*` |
| Cierre período | **Manual RRHH** (botón + callable) fase 1; Scheduler día 5 liquidación **diferido** |
| Mes cerrado + licencias | **En trámite** en M-1: hasta aprobar/rechazar; **nuevas** en M-1: no |
| HLg | Régimen en vigente **bloqueado**; cerrar (purge desde fin+1) o eliminar (desde fecha_inicio); doble OK |
| Turnos mensuales | Usuario nuevo en plan existente → warning + plan **paralelo** solo para el/los nuevos |

**Dos procesos el día 5:** (1) materialización M+1 fijo/rotativo; (2) cierre liquidación M-1 — solo (2) diferido en auto.

---

## Checkpoint implementación (2026-06-01)

| Etapa | Estado | Notas |
|-------|--------|--------|
| **F-UX.1** | ✅ Código | Menú RRHH, `/portal/rrhh/grilla-operativa`, selector sector |
| **F0** (O-P0-4,1,7,5) | ✅ Código | Purge HLg, gate anclas, bulk sector, toasts |
| **F1.1** Multi-HLG → master | ✅ Merge | `25bc00c` en `origin/master` |
| **F1.3** cierre período | ✅ Código | `cerrarPeriodoLiquidacion` + botón GSO RRHH |
| **F1** núcleo prod | ✅ Smoke | Cierre período (3 `vis_*`) + purge HLg Sala; ver acta abajo |
| **F1** restante | ⏳ | Paso 4 QA formal en prod |
| **Ticketera / HLg vigencia** | ✅ Prod | Corte inclusivo deshabilitar HLg → selector grupo + Patrón C (acta § abajo); **commit pendiente** en rama |
| **Deploy producción** | ✅ Piloto | Hosting + callables grilla/cierre/purge + **resolverContextoLaboralSolicitud** y ticketera (2026-06-01 tarde) |
| **F2–F4** | ➡️ **En curso** | **F2** — iniciar **O-P1-2** `materializarRango` (plan §16.4) |

---

## Acta smoke producción (2026-06-01)

**Entorno:** https://portal-hospital-v2.web.app · RRHH → Grilla operativa.

| Prueba | Resultado | Evidencia |
|--------|-----------|-----------|
| Cierre período (sector piloto Sala) | ✅ | UI: «Período cerrado (3 vista(s) actualizadas)» · `estado_periodo_liquidacion_id` cerrado en `vis_*` |
| Deshabilitar HLg (CHAPARRO · DNI 27667499) | ✅ | Corte **01/06/2026** · `hlg_01KS50551PFWPXTCZ90KGJ07B6` · Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Purge capa teórica post-corte (Sala) | ✅ BD | Jun–jul 2026: **0** `rda_*` en burbuja Sala (`purge_ok`) |
| Multicargo (no regresión) | ✅ BD | Oficina `gdt_01KR3H81ENQK84ZK21EQWEQQXG` · HLg `hlg_01KR3HZ1XN…` **activa** · jun 2026: 21 días con turno (esperado, otra burbuja) |

**Agente piloto purge:** `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` · mayo Sala: 9 días con turno antes del corte; junio Sala: 0 turnos.

**Scripts reproducibles (Admin SDK, `.env.v2.local`):**

- `node scripts/audit-purge-hlg-post-corte.mjs --dni=27667499 --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --desde=2026-06-01`
- `node scripts/audit-hlg-persona-gdts.mjs --dni=27667499 --periodo=2026-06`
- `node scripts/verificar-vis-mes-agente.mjs --dni=27667499 --gdt=… --periodo=YYYY-MM`

**Incidentes deploy resueltos en sesión:**

1. Healthcheck: path `runtimeFlags.json` en `onCall/grilla/*` → `../../modules/shared/runtimeFlags.json` (`4bcdb60`).
2. CORS/403 OPTIONS: `invoker: "public"` en callables + IAM `allUsers` → `roles/run.invoker` (`npm run firebase:grant-callables-invoker:firebase-login`).

**Índice Firestore:** compuesto `vistas_grilla_mes_agente` desplegado en prod (`firebase-v2/firestore.indexes.json` en `4bcdb60`).

### Acta ticketera — HLg corte inclusivo (2026-06-01, tarde)

**Contexto:** deshabilitar HLg Portería para piloto **DNI 28914247** (`per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`) con corte **01/06/2026**. Modal RRHH: *«inactiva y cerrada en la fecha de corte (vigencia inclusiva)»*.

| Prueba | Resultado | Evidencia |
|--------|-----------|-----------|
| Selector grupo `fecha_desde` **01/06/2026** | ✅ | UI: Oficina PERSONAL, **Portería**, Sala Internación 1 |
| Selector grupo `fecha_desde` **02/06/2026** | ✅ | UI: sin Portería (post-corte) |
| Fix motor | ✅ Código | `solicitudHlgVigencia.js`: `activo:false` + `fecha_fin` → vigencia por rango inclusivo |
| Deploy callables ticketera | ✅ Prod | 9 functions (`resolverContextoLaboralSolicitud`, validar/preview B·C, triggers, `simularLaoPreview`, `listarArticulosIngresoAgente`) |
| Patrón C compensatorio (Art 68 Inc B) | ✅ | `sol_01KT1QEX2A6NP624ZC8TBMH24A` · 6 hs · huérfana · checks 9/9 (warning preaviso `[W] PREAVISO_FUERA_NORMA`) |

**BD referencia (Portería):** `hlg_01KSXC395J2ACV5W4HWW7YTCTM` · `gdt_01KQA9FVEW53JSNTPGX32NWQ5B` · `activo:false` · `fecha_fin:2026-06-01`.

**Script:** `node scripts/audit-persona-grupos-fecha.mjs --dni=28914247 --fecha=YYYY-MM-DD`

**Git:** `a44b83f` fix vigencia · `6a4db61` materializarRango — push rama `feat/epic-multi-hlg-fase1-execution`.

---

## Prioridad producto — Grilla operativa → menú RRHH

| Paso | Qué | Estado |
|------|-----|--------|
| 1 | Menú RRHH + ruta grilla-operativa | ✅ |
| 2 | Validación operativa RRHH (acta UX-4) | ✅ Smoke prod 2026-06-01 (cierre + purge); formalizar acta RRHH si hace falta |
| 3 | Vista jefe acotada (F-UX.2) | ⏳ Tras F3 parcial |

Detalle: [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md) § F-UX.

---

## Backlog implementación — orquestación (post-repaso)

### P0 — contención (ver [`ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md`](./ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md) §5)

| ID | Riesgo | Estado | Notas |
|----|--------|--------|--------|
| **O-P0-4** | Fuga post-HLg | ✅ Prod + UX | Purge validado; modal HLg paso 2 (confirmar + confirmar_purge) |
| **O-P0-1** | Gate LAO | ✅ Código | Anclas desde/hasta |
| **O-P0-7** | Listado sector | ✅ Código | `materializarGrupoMes` previo |
| **O-P0-5** | UI ciega | ✅ Código | Toasts en `useGrillaMesVista` |
| O-P0-2 | Cierre período | ✅ Prod | Callable + 3 vis actualizadas en smoke |
| O-P0-3 | MDC en trámite vs M-1 cerrado | ✅ Código | `assertNuevaSolicitudNoEnPeriodoCerrado` en validar entorno + MDC; excepción trámite/consolidar |
| O-P0-6 | Piloto `resolverFijo` / rematerializar UI (D2/D11) | plan § pilotos |

### P1 — orquestación temporal

| ID | Entrega | Notas |
|----|---------|--------|
| O-P1-1 | Job día 5 **materialización** M+1 (fijo/rotativo), idempotente §17.2.1 | Cloud Scheduler + callable |
| O-P1-2 | `materializarRango(desde, hasta, motivo)` unificado | plan §16.4 — `materializarRango` + wire HLg + **`visMaterializacionMetadata.js`** (`ultimo_motivo`, `ultimo_rango_materializado`, `ultimo_origen_evento_id`; purge: `ultimo_rango_purged`) — **deploy pendiente** |
| O-P1-3 | GSO: M-1 **solo lectura** usuario/jefe desde día 1 | callables grilla |
| O-P1-4 | Turnos mensuales: warning + flujo plan paralelo usuario nuevo §19.6 | `planesTurnoServicio` + UI |

### P2 — diferido / excepciones

| ID | Entrega | Notas |
|----|---------|--------|
| O-P2-1 | Auto-cierre período día 5 (Scheduler) | Tras asimilar P0-2/P0-3 |
| O-P2-2 | Caso excepcional LAO + cola sin RDA §20.4 | Solo con precedente RRHH |
| O-P2-3 | Acotar lazy GSO si día 5 + alta HLg cubren | `grillaMesAgenteCore.js` |
| O-P2-4 | Manual RRHH normativo desde `MANUAL_CAPAS_*` | validación RRHH |

### Documentación (hecho en repaso)

- Plan §15–22, manual borrador, handoff análisis §7 decisiones cerradas.
- **No** mergear automáticamente con épica PR3 turno mensual sin decisión explícita.

---

## Estado al cerrar sesión 29/05

| Hito | Estado |
|------|--------|
| Opción A scoped (`vis_*` + `capa_teorica_por_grupo`) | ✅ Código + BD |
| Purga `vis_*` legacy | ✅ 8 docs (sesión previa) |
| Paso 2 — Gates + overrides E2 | ✅ Deploy `fc54e8b` |
| Paso 3 — Materialización mayo Sala | ✅ 93 agentes |
| Paso C — Strip `capa_teorica` raíz | ✅ 244 docs → **0** legacy |
| Documentación biblia/handoff | ✅ `c07cea3` |
| **PR → `master`** | ✅ Merge `25bc00c` (2026-06-01) |
| **Smoke prod F0/F1** | ✅ 2026-06-01 (acta arriba) |
| **Paso 4 QA** | ⏳ Matriz §4.2 biblia Multi-HLG |

---

## Cómo seguimos — próxima sesión

### 1. Cerrar git (esta semana)

- **Commit + push** en `feat/epic-multi-hlg-fase1-execution`: `invoker: "public"`, scripts `audit-*`, `grant-run-invoker-firebase-token.mjs`, `PENDIENTES` actualizado.
- **Merge a `master`** (o PR) si el equipo ya validó `25bc00c` + fixes post-smoke.
- Opcional: `npm run firebase:deploy:functions` completo para alinear todas las revisiones Cloud Run.

### 2. Cerrar F1 (deuda acotada, sin F2)

| Ítem | Acción |
|------|--------|
| **O-P0-3** | ✅ Código en rama — **deploy** + prueba: solicitud en revisión en mes cerrado puede aprobarse; alta nueva en mes cerrado bloqueada (`ASI-PER-001`) |
| **O-P0-4 UX** | ✅ Modal HLg 2 pasos — **deploy** hosting |
| **Paso 4 QA** | Matriz §4.2 [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md): ítems **2–3** overrides E2, **6** materialización, **8–9** vis scoped (evidencia scripts + smoke Chaparro) |
| **MOSTO** | Opcional: repetir smoke Sala |

### 3. Abrir **F2 — Orquestación HLg** ([`ROADMAP`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md) § F2)

Orden sugerido:

1. **O-P1-2** `materializarRango(desde, hasta, motivo)` unificado (plan §16.4).
2. **O-P1-1** Job día 5 materialización M+1 (Scheduler + callable idempotente).
3. **O-P1-3** GSO M-1 solo lectura desde día 1.
4. Wire `rematerializarPostRegimen` / calendario según manual §15–22.

**No mezclar** rama `feat/epic-turno-mensual-fase2-pr3` sin decisión explícita.

### 4. Producto posterior

- **F-UX.2** vista jefe acotada (tras avance F3 parcial si aplica).
- Revisar HLg larga Oficina CHAPARRO (`hlg_01KR3HZ1XN…`) solo si RRHH pide limpieza de cargos — **no bloquea F2**.

---

## Hecho en sesión 29/05 (resumen)

1. Dry-run strip: 244 candidatos → validación orden A→B→C.
2. Deploy functions con gates E11 estrictos y overrides por `gdt`.
3. Materialización mayo 2026 grupo Sala (93 personas).
4. Strip apply: 0 documentos con `capa_teorica` raíz post-verificación.
5. Tests gate: `node --test functions/test/validarEntornoOperativo.test.js` (10/10).
6. Push remoto + docs biblia/handoff/cierre sesión.

---

## Pendientes priorizados

### Alta (próxima sesión)

1. Push/merge fixes post-smoke (`4bcdb60` + invoker/IAM/scripts).
2. **F2** — `materializarRango` + diseño job día 5.
3. O-P0-3 + Paso 4 QA formal.

### Media

4. Materializar otros `gdt` con plan HABILITADO (fuera piloto Sala) cuando RRHH lo requiera.
5. Actualizar scripts `audit-fase4-6`, `rematerializar-vis-turno-teorico` a `buildVisDocumentId` 3 args.
6. Hook KI-1 `proyectarAportesNormativosVisGrupo` (épica futura).

### Baja

7. Fichadas reales (reloj).
8. Code splitting bundle > 500KB.

---

## Archivos clave

| Área | Archivo |
|------|---------|
| Biblia | `docs/v2/PLAN_GRILLA_MULTI_HLG_V2.md` |
| Worker | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Materializar rango (F2) | `functions/modules/asistencia/materializarRango.js` |
| Metadata `vis_*` materialización | `functions/modules/asistencia/visMaterializacionMetadata.js` |
| Gate E11 | `functions/modules/ticketera/grillaTurnoEntornoGate.js` |
| Lectura capa | `functions/modules/shared/capaTeoricaPorGrupoCore.js` |
| Strip (ops) | `scripts/strip-capa-teorica-legacy.mjs` |
| Materializar mes | `scripts/materializar-grupo-mes.mjs` |
| Smoke purge HLg | `scripts/audit-purge-hlg-post-corte.mjs` |
| HLg por persona/gdt | `scripts/audit-hlg-persona-gdts.mjs` |
| Grupos vigentes solicitud (fecha) | `scripts/audit-persona-grupos-fecha.mjs` |
| Vigencia HLg solicitud | `functions/modules/shared/solicitudHlgVigencia.js` |
| IAM callables nuevas | `scripts/grant-run-invoker-firebase-token.mjs` → `npm run firebase:grant-callables-invoker:firebase-login` |

---

## Historial sesiones recientes (turnos / grilla)

| Fecha | Documento |
|-------|-----------|
| 29/05 | [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](./HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md) — **repaso orquestación §15–22** |
| 01/06 | **Smoke prod** — acta § «Acta smoke producción» + § «Acta ticketera HLg corte inclusivo» |
| 29/05 | [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md) — **cierre hito** |
| 29/05 | [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) — incidente Z |
| 28/05 | [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) |
