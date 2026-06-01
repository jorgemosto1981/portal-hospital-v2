# Punto de Continuación — Próxima Sesión

**Última actualización:** Checkpoint F-UX.1 + F0 + núcleo F1 — commit `942adcf`, merge `master` @ `25bc00c` (2026-06-01)  
**RETOMAR AQUÍ (épica scoped):** [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md)  
**RETOMAR AQUÍ (reglas orquestación):** [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](./HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md)

| Campo | Valor |
|-------|--------|
| **Branch trabajo** | `feat/epic-multi-hlg-fase1-execution` @ `942adcf` (origin) |
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
| **F1** restante | ⏳ | O-P0-3 MDC trámite; Paso 4 QA; deploy functions/hosting |
| **F2–F4** | ⏳ | No iniciar hasta validar smoke en dev/staging |

**Smoke manual post-deploy:**

1. RRHH → **Grilla operativa** → modo Sector → grupo piloto `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` (o prueba).
2. Cargar mes → **Cerrar período de liquidación** → en Firestore `vis_*` del mes: `estado_periodo_liquidacion_id` = `cfg_epl_01KSN4ZJPVJE8C6X1VS2HQSR20` (`CFG_EPL_LIQUIDADO_CERRADO`).
3. Deshabilitar HLg de prueba → verificar purge forward (sin `rda_*` fantasmas en días posteriores en ese `gdt`).

**Índice Firestore:** si el cierre falla en consola, crear compuesto en `vistas_grilla_mes_agente`: `grupo_de_trabajo_id` + `anio` + `mes`.

---

## Prioridad producto — Grilla operativa → menú RRHH

| Paso | Qué | Estado |
|------|-----|--------|
| 1 | Menú RRHH + ruta grilla-operativa | ✅ |
| 2 | Validación operativa RRHH en dev (acta UX-4) | ⏳ Tras deploy |
| 3 | Vista jefe acotada (F-UX.2) | ⏳ Tras F3 parcial |

Detalle: [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md) § F-UX.

---

## Backlog implementación — orquestación (post-repaso)

### P0 — contención (ver [`ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md`](./ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md) §5)

| ID | Riesgo | Estado | Notas |
|----|--------|--------|--------|
| **O-P0-4** | Fuga post-HLg | ✅ Código | `purgeCapaTeoricaGdtRango` + `rrhhDeshabilitarHlg`; UX doble OK UI pendiente |
| **O-P0-1** | Gate LAO | ✅ Código | Anclas desde/hasta |
| **O-P0-7** | Listado sector | ✅ Código | `materializarGrupoMes` previo |
| **O-P0-5** | UI ciega | ✅ Código | Toasts en `useGrillaMesVista` |
| O-P0-2 | Cierre período | ✅ Código | Callables + botón GSO; validar en dev |
| O-P0-3 | MDC en trámite vs M-1 cerrado | MDC + gates |
| O-P0-6 | Piloto `resolverFijo` / rematerializar UI (D2/D11) | plan § pilotos |

### P1 — orquestación temporal

| ID | Entrega | Notas |
|----|---------|--------|
| O-P1-1 | Job día 5 **materialización** M+1 (fijo/rotativo), idempotente §17.2.1 | Cloud Scheduler + callable |
| O-P1-2 | `materializarRango(desde, hasta, motivo)` unificado | plan §16.4 |
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
| **Deploy functions + hosting** | ⏳ Validar smoke en dev antes de prod |
| **Paso 4 QA** | ⏳ Matriz §4.2 biblia Multi-HLG |

---

## Objetivo principal — próxima sesión

1. **Abrir Pull Request** `master` ← `feat/epic-multi-hlg-fase1-execution` (equipo valida biblia vs código).
2. Tras review: **merge a `master`**.
3. **Paso 4** — completar matriz QA §4.2 en [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) (ítems 2–3, 6, 8–9).
4. Validación visual UI: MOSTO/CHAPARRO — mayo y junio (Sala completo; Oficina vacío si multicargo).

### Abrir PR (recordatorio)

- **Web:** https://github.com/jorgemosto1981/portal-hospital-v2/compare/master...feat/epic-multi-hlg-fase1-execution?expand=1
- **CLI:** `gh auth login` → `gh pr create --base master --head feat/epic-multi-hlg-fase1-execution`

**Título sugerido:** `feat(asistencia): épica Multi-HLG Opción A + limpieza quirúrgica asi_*`

**No re-ejecutar** `strip-capa-teorica-legacy.mjs --apply` (ya aplicado en pre-prod).

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

1. Crear y compartir **PR** con el equipo.
2. QA visual mayo/junio en app (piloto MOSTO/CHAPARRO).
3. `audit-vis-junio-2026.mjs` — confirmación formal plan vs `vis_*` vs `asi_*`.

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
| Gate E11 | `functions/modules/ticketera/grillaTurnoEntornoGate.js` |
| Lectura capa | `functions/modules/shared/capaTeoricaPorGrupoCore.js` |
| Strip (ops) | `scripts/strip-capa-teorica-legacy.mjs` |
| Materializar mes | `scripts/materializar-grupo-mes.mjs` |

---

## Historial sesiones recientes (turnos / grilla)

| Fecha | Documento |
|-------|-----------|
| 29/05 | [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](./HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md) — **repaso orquestación §15–22** |
| 29/05 | [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md) — **cierre hito** |
| 29/05 | [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) — incidente Z |
| 28/05 | [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) |
