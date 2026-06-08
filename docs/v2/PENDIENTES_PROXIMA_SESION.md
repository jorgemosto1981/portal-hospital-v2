# Punto de Continuación — Próxima Sesión

> **RETOMAR AQUÍ:** **US-13** (matriz permisos teoría, P1) · **T-05/T-06** F3 turnos compuestos · RFC HLG ⏸ espera RRHH  
> **Hosting prod:** https://portal-hospital-v2.web.app · último deploy **2026-06-08** (`ccc1040` · tag **`v2.6.3-gso-us6`**)  
> **Qué falta implementar (SSoT backlog):** [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md)  
> **US-17:** ✅ código + remediación ops · audit **0 huecos** · [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md)

---

## CIERRE SESIÓN — US-6 + US-7 + US-11 (2026-06-08)

| Bloque | Estado | Commits / release |
|--------|--------|-------------------|
| **US-6** | ✅ QA + hosting | `ccc1040` |
| **US-7** | ✅ QA + hosting | `ccc1040` |
| **US-11** | ✅ QA + hosting | `ccc1040` |
| **Checkpoint pre-implementación** | Tag | `v2.6.2-pre-us6` @ `ca71f0e` |
| **Release** | Tag | **`v2.6.3-gso-us6`** @ `ccc1040` |

**Entregables sesión**

- **US-6 (G):** `evaluarTeoriaPendienteLazyCelda`, variante chip `teoriaPendiente` (gris), badge **⏳**, modal y leyenda; señales `materializado_lazy` (titular) y `materializacion_grupo.procesados` (equipo).
- **US-7 (D):** badge **ℹ️** *«Licencia solapada en franco»* en celda, modal y leyenda.
- **US-11:** toast sector alineado con titular — `mensajeToastMaterializacionGrupo` (*«Turno teórico recalculado al vuelo…»*).
- Tests vitest: `grillaMesGsoHints.test.js` (US-6/US-7), `grillaMesEquipoDisplay.test.js` (variante).

**QA piloto validado (prod / localhost)**

- Toast US-11 al listar grilla equipo jun-26 Sala — *17 agente-mes*.
- US-7: día **5** LAO `sol_01KT402…` — modal ℹ️ franco (MOSTO, Sala Internación 1).
- US-6 ⏳: **no** en día 5 LAO/franco (teoría ya materializada → escenario D, no G); bundle prod confirma strings US-6/7/11 en `index-DyHDRF_6.js`.

**Deploy**

- `npm run build:web` + `firebase deploy --project portal-hospital-v2 --only hosting` — **2026-06-08** (solo hosting; functions sin cambios).

**Última actualización índice:** 2026-06-08 — US-6/7/11 cerrados y publicados en `origin/master`.

---

## CIERRE US-6 — teoría pendiente lazy (escenario G) (2026-06-08)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Escenario G** | Licencia visible + fondo neutro/gris + **⏳** tooltip *«Teoría pendiente de cálculo»* |
| **Util** | `grillaMesGsoHints.js` — `evaluarTeoriaPendienteLazyCelda`, `COPY_TEORIA_PENDIENTE` |
| **Chip** | `grillaTurnosVisual.js` — variante `teoriaPendiente`; `varianteCeldaOperativa` prioriza sobre `licencia` |
| **UI grilla** | `GrillaMesEquipoTabla.jsx`, `GrillaMesTitularCalendario.jsx`, leyenda `GrillaMesLicenciasPanel.jsx` |
| **Modal** | `DiaGrillaDetalleModal.jsx` — bloque gris ⏳ |
| **Tests** | `grillaMesGsoHints.test.js` (US-6) — vitest ✅ |
| **Commit** | `ccc1040` — `feat(gso): US-6 US-7 US-11 teoria pendiente lazy hints y toasts sector` |
| **Tag / deploy** | `v2.6.3-gso-us6` · https://portal-hospital-v2.web.app — 2026-06-08 |

---

## CIERRE US-7 — licencia en franco (escenario D) (2026-06-08)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Hint ℹ️** | *«Licencia solapada en franco»* con F + código licencia |
| **Util** | `evaluarLicenciaEnFrancoCelda` en `grillaMesGsoHints.js` |
| **UI** | Badges celda equipo/titular + bloque modal |
| **QA manual** | ✅ Día 5 jun-26 MOSTO — LAO sobre franco |
| **Commit / tag** | `ccc1040` · `v2.6.3-gso-us6` |

---

## CIERRE US-11 — toasts materialización sector (2026-06-08)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Antes** | *«Sector sincronizado (N agente-mes).»* |
| **Ahora** | *«Turno teórico recalculado al vuelo (N agente-mes en el sector).»* — alineado a copy titular lazy |
| **Util** | `grillaMaterializacionToast.js` — `mensajeToastMaterializacionGrupo` |
| **Hook** | `useGrillaMesVista.js` — listado equipo/sector |
| **QA manual** | ✅ Toast tras materializar grupo jun-26 Sala |
| **Commit / tag** | `ccc1040` · `v2.6.3-gso-us6` |

---

## CIERRE SESIÓN — GSO UX/copy + US-8 (2026-06-06)

| Bloque | Estado | Commits / deploy |
|--------|--------|------------------|
| **US-4 + US-5** | ✅ QA + hosting | `dbc9fc5` · `6119285` |
| **US-8** | ✅ QA + hosting | `4dcd9b9` · `5755b42` |
| **Smoke US-3 68-B** | ✅ (sesión previa, revertido) | `4394055` · `2669503` |

**Entregables sesión**

- Hints **🔗** fan-out (US-4) y **📅** post-purge HLg (US-5) en celda, modal, avisos y leyenda.
- Badge **🔒** mes cerrado / solo lectura (US-8) + gates modales turno A/B/C/shell.
- Copy tarjeta RRHH período cerrado: *«consulta y gestión RRHH»* (no “solo lectura” para MOSTO/RRHH).
- Tests vitest: `grillaMesGsoHints.test.js`, `grillaGsoSoloLectura.test.js`.

**Pausa — no iniciado en código**

- **US-6:** escenario G — celda ⏳ *«Teoría pendiente de cálculo»* con licencia visible (explicado en chat; ver §escenario G en [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md)).
- **US-7, US-11:** backlog P2 sin cambios.

**QA piloto validado**

- `sol_01KT3ZG…` día 11 jun-26 — Sala 🔗 Oficina PERSONAL · Oficina 📅 post-purge.
- Tarjeta mayo Sala Internación — RRHH período cerrado con copy correcto.

**Última actualización índice:** 2026-06-06 — sesión cerrada y publicada en `origin/master`.

---

## CIERRE US-8 — mes cerrado / solo lectura (2026-06-06)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Escenario H / P8** | Licencia visible + 🔒 en acciones de edición de turno |
| **Util** | `grillaGsoSoloLectura.js` — `evaluarSoloLecturaCeldaGso`, `COPY_BADGE_SOLO_LECTURA_GSO`, `soloLecturaDesdeGsoEscrituraApi` |
| **Celda** | Badge 🔒 en `GrillaMesEquipoTabla` y `GrillaMesTitularCalendario` cuando `!gsoPermiteEscritura` |
| **Modal día** | `DiaGrillaDetalleModal` — bloque 🔒 + sin botón gestionar turno |
| **Wizard turno** | `GestionTurnoDiaShell` — gate solo lectura (sin wizard) |
| **Flujos A/B/C** | `ModalCoberturaParcial`, `ModalCambioTurnoPropio`, `ModalTurnoAdicional` — aviso + submit deshabilitado vía `gso_escritura` API |
| **Banner grilla** | `GrillaMesLicenciasPanel` — copy acta + leyenda 🔒 |
| **Tests** | `grillaGsoSoloLectura.test.js` (6) — vitest ✅ |
| **QA manual** | ✅ RRHH MOSTO — tarjeta mayo Sala *«consulta y gestión RRHH»* · jefe M-1 🔒 sin edición |
| **Commit** | `4dcd9b9` — `feat(gso): cerrar US-8 mes cerrado badge y gates modales turno` |
| **Deploy** | hosting https://portal-hospital-v2.web.app — 2026-06-06 |

---

## CIERRE US-4 + US-5 — hints GSO UX/copy (2026-06-06)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **US-4 (E)** | Badge **🔗** + tooltip *«Licencia gestionada en otro sector ({nombre})»* cuando `grupo_trabajo_id_ancla` ≠ `gdt` del `vis_*` |
| **US-5 (F / Q3-2)** | Badge **📅** + copy *«Sin dotación en este grupo desde el {fecha}. Licencias del período anterior conservadas.»* en celdas post-purge / `no_laborable` con licencia, o día > `vigente_hasta` |
| **Util compartido** | `grillaMesGsoHints.js` — `evaluarImputacionExternaCelda`, `evaluarPostPurgeHlgCelda`, `copyPostPurgeHlg` |
| **UI grilla** | `GrillaMesEquipoTabla.jsx`, `GrillaMesTitularCalendario.jsx`, `grillaMesCellUtils.js` (tooltip línea) |
| **UI avisos** | `GrillaMesSinDotacionAviso.jsx`, `GrillaTarjetaGrupoPeriodo.jsx`, `GrillaMesLicenciasPanel.jsx` (leyenda 🔗 📅) |
| **Modal** | `DiaGrillaDetalleModal.jsx` — bloques informativos sky/ámbar US-4 y US-5 |
| **Tests** | `grillaMesGsoHints.test.js` (5) · `grillaMesCellUtils.test.js` (4) — vitest ✅ |
| **Limitación** | Días fuera de tramo HLg (`diaFueraTramoHlg` → celda vacía) no muestran licencias aunque existan en `vis_*` — sin cambio backend en esta iteración |
| **QA manual** | ✅ `sol_01KT3ZG…` día 11 jun-26 — Sala 🔗 *Oficina PERSONAL* · Oficina 📅 post-purge |
| **Commit** | `dbc9fc5` — `feat(gso): cerrar US-4 y US-5 hints fan-out y post-purge HLg` |
| **Deploy** | hosting https://portal-hospital-v2.web.app — 2026-06-06 |

**Última actualización índice:** 2026-06-06 — US-4/US-5 cerrados (QA + deploy).

---

## CIERRE SMOKE US-3 — 68-B horas + reconciliación (2026-06-06)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Objetivo** | Validar que US-3 es **agnóstico** a unidad horas (`cfg_uma_horas`) y a `nivel_ocupacion_dia_id` (68-B piloto = `cfg_nod_exclusivo`) |
| **Script** | `scripts/smoke-us3-fanout-68b-dev.mjs` · `npm run smoke:us3-fanout-68b` |
| **Piloto** | MOSTO `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` · Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · **2026-06-13** (turno M) |
| **Paso 1** | Fan-out smoke `sol_SMOKE68B_US3_DIA13` → chip **68-B** sobre turno M · `teoria_ref` capturada en proyección |
| **Paso 2** | Override `asi_*.overrides_turno` reemplazo **T** + `materializarTurnoTeoricoDia` (no patch directo `vis_*` — se revierte con `materializarGrupoMes` al listar grilla) |
| **UI validada** | Celda: T + chip 68-B + **⚠️** · Modal: bloque ámbar US-3 + acciones US-14 |
| **Fix UI** | `DiaGrillaDetalleModal.jsx` — no llama resumen si `solicitud_id` no es ULID real (evita 403 smoke) · `GrillaMesEquipoTabla.jsx` — badge ⚠️ `amber-700` · **hosting deploy 2026-06-06** |
| **Commit** | `4394055` — `feat(gso): smoke US-3 68-B horas y fixes UI reconciliacion` |
| **Limpieza** | `--modo=revert --apply` + `--modo=restore-turno --apply` → día 13 vuelve a **M** sin evento smoke |
| **Lección** | Portero = gate alta (`depende_rda`) · Auditor = US-3 post-evento (`teoria_ref` vs piso vigente) |

**Última actualización índice:** 2026-06-06 — smoke 68-B + US-3 cerrado y revertido.

---

## CIERRE US-15 — fichada en celda por rol (2026-06-06)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Contrato Q9-3** | RRHH: horarios en modal + badge P/A · Jefe: solo `fichada_presencia` (P/A) sin `fichadas_reales` · Titular: sin fichada |
| **Util compartido** | `shared/utils/grillaFichadaPresencia.js` — presencia agregada + contradicción fichada ↔ teoría |
| **Sanitize API jefe** | `grillaVisSanitizeGso.js` — quita capa 4 cruda; expone `fichada_presencia` |
| **Q9-4 B** | `grillaTeoriaDesalineacion.js` — ⚠️ si fichada contradice teoría **con licencia en celda** |
| **UI** | `GrillaFichadaPresenciaBadge.jsx` · `DiaGrillaDetalleModal.jsx` (bloque Fichada/Asistencia por rol) |
| **Deploy prod** | functions + hosting · https://portal-hospital-v2.web.app — **2026-06-06** |
| **Smoke visual prod** | Grilla igual que antes (sin capa 4 en `vis_*` → sin badges P/A; comportamiento esperado) |
| **Guard capa 4** | Sin `fichadas_reales`/`fichadas`/`capa_realidad` en celda → no se infiere ausente (evita ruido pre-reloj) |
| **Tests** | `grillaFichadaPresencia.test.js` · `grillaVisSanitizeGso.test.js` · `grillaTeoriaDesalineacion.test.js` |
| **Próximo paso (script)** | `npm run smoke:us15-fichada-presencia -- --dni=… --gdt=… --fecha=YYYY-MM-DD --modo=presente` (dry-run) · `--apply` para inyectar · `--modo=revert --apply` para limpiar |
| **RFC HLG** | ⏸ [`RFC_HLG_COBERTURA_HLC_WARNING_V2.md`](./RFC_HLG_COBERTURA_HLC_WARNING_V2.md) — pendiente aprobación RRHH (`VAL-HLG-W004`) |
| **Siguiente backlog GSO** | ~~US-4, US-5~~ ✅ · **US-8**… — ver [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) §2.2 |

**Última actualización índice:** 2026-06-06 — cierre US-15 registrado.

---

## CIERRE US-3 A + US-14 — reconciliación teoría post-licencia (2026-06-06)

| Qué | Dónde / evidencia |
|-----|-------------------|
| **Badge ⚠️** | `teoria_ref` en fan-out MDC + backfill en rematerialización; comparación en grilla equipo/titular |
| **Modal US-14** | `DiaGrillaDetalleModal.jsx` — bloque ámbar + 3 acciones (bandeja, ajuste turno, derivar plan) |
| **Util compartido** | `shared/utils/grillaTeoriaDesalineacion.js` |
| **Deploy prod** | functions + hosting · rematerialización grupos con licencias jun/jul-26 |
| **Smoke E2E** | Override día 27 Sala Internación (`M+T` → `T`) → ⚠️ + modal validado en UI → **revertido** |
| **Smoke 68-B horas** | Día 13 jun-26 MOSTO — fan-out smoke + override T → ⚠️ + modal → **revertido** (sección arriba) |
| **Tests** | `functions/test/grillaTeoriaDesalineacion.test.js` · `grillaMesEquipoDisplay.test.js` |
| **Siguiente (sugerido)** | US-15 · RFC VAL-HLG-W004 |

**Última actualización índice:** 2026-06-06 — cierre US-3/US-14 registrado.

---

## CIERRE US-17 — remediación (2026-06-06)

| Qué | Dónde |
|-----|--------|
| **Acta cierre** | [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md) |
| **Manifiesto R0–R4** | [`MANIFIESTO_REIMPACTO_INTEGRIDAD_PLAN_REGIMEN_2026.md`](./MANIFIESTO_REIMPACTO_INTEGRIDAD_PLAN_REGIMEN_2026.md) |
| **Audit cierre** | `npm run audit:us17-planes-huecos` → 5 planes, **0 huecos** |
| **Lista RRHH (histórico)** | [`reports/US17_LISTA_TRABAJO_RRHH_2026-06-05.md`](../reports/US17_LISTA_TRABAJO_RRHH_2026-06-05.md) |
| **Siguiente (sugerido)** | ~~US-3 A + US-14~~ ✅ · ~~US-15~~ ✅ · smoke P/A script · RFC HLG ⏸ |

**Última actualización índice:** 2026-06-06 — cierre US-17 registrado (US-3/US-14 cerrados aparte arriba).

---

## Histórico — PAUSA post inventario US-17 (2026-06-05)

| Qué | Dónde |
|-----|--------|
| **Handoff sesión** | [`HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md`](./HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md) |
| **Inventario + severidad** | [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md) |
| **Audit CLI** | `npm run audit:us17-planes-huecos` |
| **master** | `352692b` (merge PR #3) |
| **Siguiente (sugerido)** | Remediación RRHH pasivo 9/126 **o** código US-3 escenario A + US-14 |

**Última actualización:** 2026-06-05 — pausa registrada (supersedida por cierre 2026-06-06).

---

## Histórico — CIERRE F-UX.3 — gestión turno A/B/C (implementación terminada)

| Qué | Dónde |
|-----|--------|
| **Handoff completo** | [`HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md`](./HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md) |
| **Estado frontend F-UX.3** | ✅ Wizard A/B/C · modales · outbox v2 · banner por tarjeta grupo×mes · labels embebidos |
| **Spec visual grilla (§12)** | ✅ UI `73d58cd` · consulta ligera callable desplegada |
| **Registro documental F-UX.3** | [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) |
| **RFC F4 (outbox + batch)** | [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) · [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) |
| **Branch trabajo** | `feat/epic-multi-hlg-fase1-execution` |
| **Fase 6 backend batch v2** | ✅ A-BATCH + B-BATCH-1 + C-BATCH (`cambiosTurno.js` + worker v2) · deploy functions **2026-06-04** |
| **QA batch prod** | ✅ Manual **4 aplicadas** + smokes dev |
| **QA grilla prod** | ✅ Validado en grilla (hosting + functions 2026-06-04) |
| **Push rama** | ✅ Sincronizar con `git pull` — ver handoff 2026-06-04 |
| **Handoff sesión 2026-06-04** | [`HANDOFF_SESION_2026-06-04_CIERRE_FUX_BATCH_Y_DOCUMENTAL.md`](./HANDOFF_SESION_2026-06-04_CIERRE_FUX_BATCH_Y_DOCUMENTAL.md) |

### Pendientes (resumen — detalle en [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md))

| Tipo | Ítems |
|------|--------|
| **Proceso** | PR → `master`, tag `v2.4.0-fux-gestion-turno`, QA formal §4.2 |
| **Código P0** | GSO: US-9, US-1, US-16 (anti-blanco + habilitar plan) |
| **Código P1** | GSO: US-3, US-10, US-14, US-8… · F3: T-05…T-09 |
| **Opcional F-UX** | Horas RRHH post-C, validación A2 servidor |

1. Abrir PR y merge → **`PR_EPIC_MULTI_HLG_FUX.md`** · compare: `master`…`feat/epic-multi-hlg-fase1-execution`
2. Post-merge: tag `v2.4.0-fux-gestion-turno` (comandos en release notes F-UX)
3. Siguiente sprint código: §2 y §8 de **`PENDIENTES_IMPLEMENTACION_V2.md`**

**Última actualización:** registro backlog implementación — 2026-06-04

---

> **Sesión previa 2026-06-02** · F3 T-02/T-03/T-04/T-08 + **F-UX.2** fichadas en grilla — **validado F:2 prod**.  
> Handoff pausa: [`HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md`](./HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md) · GSO: [`HANDOFF_SESION_2026-06-01_PAUSA_GSO_CIERRE_PERIODO.md`](./HANDOFF_SESION_2026-06-01_PAUSA_GSO_CIERRE_PERIODO.md).

## Contexto F4 (histórico — reemplazado por bloque arriba)

| Qué | Dónde |
|-----|--------|
| **Handoff completo (propuesta textual)** | [`HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md`](./HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md) |
| **Estado** | ~~Spec producto **cerrada**~~ → **frontend F-UX.3 cerrado** 2026-06-03 |
| **RFC F4 (outbox)** | [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) |
| **PR merge épica** | `master` ← `feat/epic-multi-hlg-fase1-execution` · `gh auth login` pendiente |
| **F4 backend** | ✅ batch v2 A/B/C (ver registro F-UX.3) |
| **UI actual** | Wizard A/B/C + banner outbox v2 ✅ |

**Última actualización histórica:** F-UX gestión turno — spec cerrada §9 — 2026-06-03

## Contexto F4 (sesión previa mismo día)

| Qué | Dónde |
|-----|--------|
| **Tag F3** | ✅ `v2.3.0-f3-turnos-compuestos` |
| **Deploy prod F3** | ✅ Functions + hosting 2026-06-02 |

| Campo | Valor |
|-------|--------|
| **Branch trabajo** | `feat/epic-multi-hlg-fase1-execution` (commit pausa GSO pendiente de tag) |
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
| **Handoff agente implementador** | [`HANDOFF_AGENTE_IMPLEMENTACION_ROADMAP.md`](./HANDOFF_AGENTE_IMPLEMENTACION_ROADMAP.md) |

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
| **F1.3** cierre período | ✅ Prod | `cerrarPeriodoLiquidacion` + `reabrirPeriodoLiquidacion` |
| **F1.4** UI cierre GSO | ✅ Prod | Tarjetas cerrado/sin dotación; modal compacto; sin selector RRHH |
| **F1** núcleo prod | ✅ Smoke | Cierre período (3 `vis_*`) + purge HLg Sala; ver acta abajo |
| **F1** manual QA | ✅ | A1–A5 + **B1–B5** GSO RRHH cerrados 2026-06-02 — handoff GSO |
| **F1** deploy functions | ✅ | 2026-06-02 — `rrhhDeshabilitarHlg` + purge HLg (`resolveHastaPurgeTrasDeshabilitarHlg`) |
| **F3 T-02** | ✅ Código | Zod + golden tests `npm run test:segmentos-contract` |
| **F3 T-03** | ✅ Validado | Smoke seguro `smoke-materializar-turno-dia-dev.mjs` sin mutar régimen fijo |
| **F3 T-04** | ✅ Parcial validado | `materializarDiaAfectado` en `cambiosTurno.js` + freeze `smoke-outbox-freeze-dev.mjs` (`ASI-PER-001`) |
| **F3 T-08** | ✅ Validado | `fichadas_esperadas` bloques×2 + extras; `test:fichadas-esperadas` + `smoke:fichadas-esperadas` |
| **F-UX.2** | ✅ Validado UI | Badge **F:2** en grilla/modal (planificado, fijo, rotativo); fix fallback horario sin `turno_id` en prod |
| **Ticketera / HLg vigencia** | ✅ Prod | `a44b83f` — corte inclusivo (acta ticketera § abajo) |
| **F2 O-P1-2** `materializarRango` | ✅ Código + wire HLg | `6a4db61` — alta M+M+1; deshabilitar inicio→corte |
| **F2 2.1** metadata `vis_*` | ✅ Código + deploy parcial | `e349412` — laboral + GSO listado; ver handoff pausa |
| **F2 O-P1-1** job día 5 | ✅ Prod | Scheduler + callable; smoke julio OK |
| **F2 O-P1-2** feriado + toasts | ✅ Deploy | `rematerializarPostCalendario({ fecha_ymd })` + `grillaMaterializacionToast.js` |
| **F2 O-P1-3** GSO M-1 solo lectura | ✅ Deploy | `grillaGsoSoloLectura.js` + hosting |
| **F2 O-P1-4** plan usuario nuevo §19.6 | ✅ Deploy | banner + incorporación agentes |
| **F2.6** resolverFijo D2 | ✅ Código | `Number(dia_semana)` + franco sin match |
| **F2.7** rematerializar UI RRHH | ✅ Código | `RegimenesHorariosPage` + `CalendarioConfig` |
| **Deploy producción** | ✅ Sesión 01/06 | Ver tabla deploy en [`HANDOFF_SESION_2026-06-01_PAUSA_F2.md`](./HANDOFF_SESION_2026-06-01_PAUSA_F2.md) |
| **F3 T-05..T-07, T-09** | ⏳ Pendiente | UI editor segmentos, help, caché — ver handoff 2026-06-02 |
| **F3 cierre épica** | ✅ Núcleo | Piloto Sala validado · release notes · tag pendiente commit |
| **F4 Outbox** | ✅ En rama (F-UX.3) | Ver [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) · backlog: [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) |

---

## Registro sesión (2026-06-02) — pausa F3 / F-UX.2

| Tema | Resultado | Nota |
|------|-----------|------|
| T-08 + tests/smokes | ✅ | `test:fichadas-esperadas`, `smoke:fichadas-esperadas` |
| F-UX.2 UI + `vis_*.fichadas_esperadas` | ✅ | Deploy functions ×2 + hosting; validación **F:2** usuario |
| Fix fijo/rotativo sin `turno_id` | ✅ | Fallback segmento horario → fichadas 2 en día laborable |
| Handoff pausa | ✅ | `HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md` |

**Siguiente sesión:** Tag F3 + deploy hosting/functions · PR merge épica.

---

## Registro sesión (2026-06-02) — continuación F3 piloto Sala + ids «+»

| Tema | Resultado | Nota |
|------|-----------|------|
| Piloto compuesto régimen `1779788226715` | ✅ Validado grilla | Usuario confirma **F:2**, horarios M+T / N+M coherentes |
| Migración ids atómicos → `+` | ✅ Prod | `migrar-regimen-planificado-compuesto-plus.mjs --apply` — 21 días plan Sala + remat 4 meses |
| Tip UI régimen «+» | ✅ Código | `RegimenTurnoCompuestoPlusTip.jsx` — deploy hosting pendiente |
| Release notes F3 | ✅ Doc | `RELEASE_NOTES_EPIC_TURNOS_COMPUESTOS_F3_V2.md` |
| UX-6 filtro API jefe | ✅ Código | `grillaVisSanitizeGso.js` — sin `fichadas_reales` en respuesta GSO |

**Siguiente:** tag `v2.3.0-f3-turnos-compuestos` · deploy · PR merge.

---

## Registro sesión (2026-06-02) — GSO / F1

| Tema | Resultado | Nota |
|------|-----------|------|
| Validación HLG `activo:false` en alta/solape | ✅ Confirmado | Backend y frontend ya excluyen HLG deshabilitada en control `VAL-HLG-014`. |
| Smoke F1 D2 Portería mayo | ✅ Ajustado | `scripts/smoke-f1-qa-4-2-prod.mjs` ahora marca `SKIP` si no hay HLG activa para el mes/grupo. |
| Datos laborales (card HLg) | ✅ Corregido | Clasificación interna HLG por HLC: “vigente interna” = abierta/no cerrada; “histórica” = cerrada o deshabilitada. Evita mostrar HLG futura vigente dentro de históricos. |
| QA manual A4/A5 | ✅ Cerrado | A4: coherencia por semántica (histórico vs vigente). A5: override scoped validado con mutación real + rollback. |
| QA manual A3 | ✅ Cerrado | §4.2 #6: revertir plan Oficina jun-2026 en Explorador; Sala jun-2026 sin cambio; rehabilitar plan Oficina en Bandeja Evaluador. |
| QA manual A1 | ✅ Cerrado | 64-A `sol_01KT3ZG4VPY2SNRWW3Z09DV73S` día 11 fan-out Oficina+Sala. LAO `sol_01KT402WR9SVN46JESKAS6KE1E` 03–09/06 ancla **Sala**, `LAO-2026` en `vis_2026_06` días 03–05 y 08–09 en ambos `gdt`. |
| UX aclaratoria A4 | ✅ Implementado | `web/src/pages/jefe/PlanTurnoServicioPage.jsx`: aviso simple al pie de grilla histórica (“foto histórica del plan…”). |
| Deploy | ✅ Hosting | Publicado en `https://portal-hospital-v2.web.app` para validación visual. |
| QA B1–B5 GSO RRHH | ✅ Cerrado | UI + purge Portería MOSTO; criterio dotación = HLg activa al cierre de mes. |
| Purge HLg Portería | ✅ Prod | `--apply` 01/06–13/06; fix purge `asi`/`vis` en código. |

**Siguiente:** deploy functions (purge deshabilitar) · smokes C · **F3** o deuda E.

---

## Acta smoke F1 §4.2 + D2 (2026-06-01)

**Script:** `node scripts/smoke-f1-qa-4-2-prod.mjs` · **F2:** `smoke-f2-orquestacion-prod.mjs` (3/3 OK).

| Prueba | Resultado |
|--------|-----------|
| D2 MOSTO mayo Portería | ✅ 12 turnos (no mes todo NL) |
| MOSTO jun Oficina (multicargo) | ✅ 13 turnos |
| LOKITO jun/jul Oficina | ✅ 14 + 25 turnos |
| CHAPARRO may Sala | ✅ 9 turnos |
| CHAPARRO jun Sala | SKIP — HLg inactiva desde 01/06 (purge F0) |

**Incidente LOKITO (plan `eliminado` + HABILITADO):** fix `planHabilitadoDesdeQuerySnapshot` deployado; jun/jul OK en UI.

**Sign-off §4.2 #2 LAO/GS-A:** cerrado 2026-06-02 (evidencia arriba). Siguiente F1: prioridad **B** GSO RRHH.

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

**Corrección grilla (2026-06-02):** al deshabilitar HLg, `materializarRango` ya no escribe turno el día de corte; purge capa teórica desde el corte inclusive; tope `resolveHastaPurgeTrasDeshabilitarHlg` (no pisa HLg activa posterior, ej. Portería desde 14/06). Grilla/titular: corte exclusivo operativo; solicitudes: inclusivo. **Purge prod ejecutado:** `audit-purge-hlg-post-corte.mjs --apply` 01/06–13/06 Portería MOSTO → `purge_ok: true`. Script: `--apply` aplica purge; sin flag solo audita.

**QA manual — horizonte solicitudes:** no usar artículo 64 con `fecha_desde` más allá del **fin del mes siguiente** (regla M+M+1 en código; la ventana “45 días corridos” quedó archivada en el plan).

**Script:** `node scripts/audit-persona-grupos-fecha.mjs --dni=28914247 --fecha=YYYY-MM-DD`

**Git:** `a44b83f` fix vigencia · `6a4db61` materializarRango — push rama `feat/epic-multi-hlg-fase1-execution`.

---

## Prioridad producto — Grilla operativa → menú RRHH

| Paso | Qué | Estado |
|------|-----|--------|
| 1 | Menú RRHH + ruta grilla-operativa | ✅ |
| 2 | Validación operativa RRHH (acta UX-4) | ✅ Smoke prod 2026-06-01 (cierre + purge); formalizar acta RRHH si hace falta |
| 3 | Vista jefe acotada (F-UX.2) | ✅ Validación final usuario: **F:2** OK |

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
| O-P1-1 | Job día 5 **materialización** M+1 (fijo/rotativo), idempotente §17.2.1 | ✅ Código — deploy `materializacionVentanaDia5Scheduled` + `ejecutarMaterializacionVentanaDia5` |
| O-P1-2 | `materializarRango` + feriado puntual | ✅ Código + deploy — `rematerializarPostCalendario({ fecha_ymd })` vía rango; toasts F2.1 en GSO |
| O-P1-3 | GSO: M-1 **solo lectura** usuario/jefe desde día 1 | ✅ Código + deploy — `ASI-GSO-001` + banner UI |
| O-P1-4 | Turnos mensuales: warning + flujo plan paralelo usuario nuevo §19.6 | ✅ Código — `listarContextoPlanGrupo` + incorporación en `guardarPlan`; deploy pendiente |

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

## Cómo seguimos — próxima sesión (post-pausa 2026-06-02)

### 1. Arranque otra PC

1. `git pull origin feat/epic-multi-hlg-fase1-execution`
2. Copiar `.env.v2.local` (raíz repo).
3. `npm install`
4. Leer [`HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md`](./HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md) §7.

### 2. F3 — cierre épica turnos compuestos

| Paso | Acción |
|------|--------|
| Piloto | Nocturno/compuesto (M+T+N o régimen real) en un `gdt`; validar grilla mes + **F:n** |
| T-05/06 | Editor plan / ayuda (si entra en alcance) |
| Docs | Release notes + tag (`EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md`) |

### 3. F-UX.2 restante + F1

| Paso | Acción |
|------|--------|
| UX-6 | Auditar callables listado grilla: jefe sin `fichadas_reales` |
| F1 | Paso 4 QA formal; PR merge épica cuando aprueben |

**No mezclar** rama `feat/epic-turno-mensual-fase2-pr3` sin decisión explícita.

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

> **Lista maestra actualizada:** [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) (sustituye esta sección para planificación 2026-06-04+).

### Alta (próxima sesión)

1. PR merge épica + tag F-UX (`REL-1`, `REL-2`).
2. GSO **US-9**, **US-1**, **US-16** (P0).
3. Paso 4 QA formal Multi-HLG.

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
| Smoke fichadas / materializar día | `scripts/smoke-fichadas-esperadas-dev.mjs`, `smoke-materializar-turno-dia-dev.mjs` |
| Smoke US-15 capa 4 (P/A) | `npm run smoke:us15-fichada-presencia -- --dni=… --gdt=… --fecha=YYYY-MM-DD --modo=presente` |
| Smoke US-3 fan-out 68-B (horas) | `npm run smoke:us3-fanout-68b -- --dni=… --gdt=… --fecha=YYYY-MM-DD --modo=inject` · `patch-turno-t` · `revert` · `restore-turno` (+ `--apply`) |
| Rematerializar 1 día + leer vis | `scripts/_tmp-materializar-dia-y-leer-vis.mjs` |
| Handoff pausa F3 | `docs/v2/HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md` |
| HLg por persona/gdt | `scripts/audit-hlg-persona-gdts.mjs` |
| Grupos vigentes solicitud (fecha) | `scripts/audit-persona-grupos-fecha.mjs` |
| Vigencia HLg solicitud | `functions/modules/shared/solicitudHlgVigencia.js` |
| IAM callables nuevas | `scripts/grant-run-invoker-firebase-token.mjs` → `npm run firebase:grant-callables-invoker:firebase-login` |

---

## Historial sesiones recientes (turnos / grilla)

| Fecha | Documento |
|-------|-----------|
| 29/05 | [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](./HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md) — **repaso orquestación §15–22** |
| 02/06 | [`HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md`](./HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md) — **pausa F3 + F-UX.2 @ validación F:2** |
| 01/06 | [`HANDOFF_SESION_2026-06-01_PAUSA_F2.md`](./HANDOFF_SESION_2026-06-01_PAUSA_F2.md) — **pausa F2 @ e349412** |
| 01/06 | Smoke prod + acta ticketera (este doc) |
| 29/05 | [`HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md`](./HANDOFF_SESION_2026-05-29_CIERRE_MULTI_HLG.md) — **cierre hito** |
| 29/05 | [`HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md`](./HANDOFF_SESION_2026-05-29_MATERIALIZACION_PLAN_VS_HLG.md) — incidente Z |
| 28/05 | [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) |
