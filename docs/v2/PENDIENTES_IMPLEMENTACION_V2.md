# Pendientes de implementación — Portal Hospital V2

**SSoT backlog código/producto** (qué **falta implementar** o cerrar en proceso).  
**Última actualización:** 2026-06-10 (**T-05 (A)** grilla operativa foco URL ✅ `8285283` · **US-13** ✅ ops)  
**Rama / release:** `master` @ `ea25b3f` · tags **`v2.6.3-gso-us6`** · **`v2.6.3-pos-t05-grilla`** (`8285283`)  
**Sesión / continuidad:** índice [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) · **RETOMAR:** T-05 planes URL · F3 paleta editor · T-06

---

## Leyenda

| Estado | Significado |
|--------|-------------|
| **P0** | Bloquea confianza operativa o repetición de incidente |
| **P1** | Requerido por acta/criterios; no bloquea piloto ya remediado |
| **P2** | Mejora / pulido / diferido |
| **Proceso** | Sin diff de código (merge, tag, QA formal) |
| **✅ Hecho** | Implementado y validado en rama o prod (referencia) |

---

## 1. Proceso y release (sin código)

| ID | Entregable | Estado | Referencia |
|----|------------|--------|------------|
| **REL-1** | PR `feat/epic-multi-hlg-fase1-execution` → `master` | Proceso | [`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md) |
| **REL-2** | Tag `v2.4.0-fux-gestion-turno` post-merge | Proceso | [`RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`](./RELEASE_NOTES_FUX_GESTION_TURNO_V3.md) |
| **REL-3** | QA formal Multi-HLG §4.2 (acta RRHH) | Proceso | [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) |
| **REL-4** | `gh auth login` / PR desde CLI | Proceso | Entorno local del operador |

**✅ Hecho en rama (no equivale a master):** F-UX.3 A/B/C + batch v2 + deploy prod 2026-06-04 — [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md).

**✅ Hecho 2026-06-06:** Fase 5 segmentación HLg por tramo (Plan + GSO) — [`reports/FASE5_CIERRE_SEGMENTACION_HLG_PLAN_GSO_2026-06-06.md`](../../reports/FASE5_CIERRE_SEGMENTACION_HLG_PLAN_GSO_2026-06-06.md) · [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) §7ter.

---

## 2. Épica GSO — conflictos capas

Criterios: [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) · brechas: [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md) · acta: [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md).

### 2.1 Blindaje huecos / anti-blanco — **✅ cerrado en prod (`v2.6.1`)**

| US | Prioridad | Entregable | Evidencia |
|----|-----------|------------|-----------|
| **US-9** | P0 | `assertPlanSinHuecosTurno` → `PLT-US9-001` en guardar/aprobar/incorporación | `validacionesPlanTurno.js`, deploy functions jun 2026 |
| **US-1** | P0 | `incompletoPlan` visible (rayado rosa, chip «Sin turno») | `grillaMesEquipoDisplay.js`, `grillaTurnosVisual.js` |
| **US-16** | P0 | Sin gestión táctica en hueco de plan | `GrillaMesLicenciasPanel.jsx`, gates modales |
| **US-10** | P1 | Banner + contador huecos; Enviar bloqueado en UI | `GrillaMensualEditor.jsx`, `planHuecosTurnoUtils.js` |
| **US-14** | P1 | Modal incompleto: mensaje + CTA «Corregir plan» (deep-link) | `DiaGrillaDetalleModal.jsx` |
| **US-3** | P1 | Licencia sobre plan incompleto: aviso en modal (escenario B parcial) | Mismo modal + criterios escenario B |

Tests: `npm run test:validaciones-plan-turno`, `npm run test:blindaje-gso-dry-run`, vitest GSO/US-10. QA manual post-merge: checklist en [`PR_BLINDAJE_GSO_BODY.md`](./PR_BLINDAJE_GSO_BODY.md).

### 2.2 GSO — reconciliación / UX (backlog restante)

| US | Prioridad | Qué falta implementar | Archivos / área típica |
|----|-----------|------------------------|-------------------------|
| **US-3** | — | **✅ Cerrado** — escenario A (teoría post-licencia + Q9-4 fichada) | `grillaTeoriaDesalineacion.js`, grilla equipo/titular |
| **US-14** | — | **✅ Cerrado** — modal ⚠️ + 3 acciones acta | `DiaGrillaDetalleModal.jsx` |
| **US-15** | — | **✅ Cerrado** — P/A por rol; capa 4 en standby (sin datos reloj en prod) | `grillaFichadaPresencia.js`, `grillaVisSanitizeGso.js`, UI badges/modal |
| **US-4** | — | **✅ Cerrado** — badge 🔗 + tooltip fan-out (escenario E) | `grillaMesGsoHints.js`, grilla equipo/titular/modal |
| **US-5** | — | **✅ Cerrado** — copy Q3-2 📅 post-purge HLg (escenario F) | `grillaMesGsoHints.js`, avisos sin dotación, leyenda |
| **US-6** | — | **✅ Cerrado** — ⏳ teoría pendiente lazy (escenario G); chip `teoriaPendiente` (`ccc1040` · `v2.6.3-gso-us6`) | `grillaMesGsoHints.js`, `grillaTurnosVisual.js`, grilla + modal |
| **US-7** | — | **✅ Cerrado** — ℹ️ licencia en franco (escenario D) | `evaluarLicenciaEnFrancoCelda`, grilla + modal |
| **US-8** | — | **✅ Cerrado** — badge 🔒 + gates modales + copy RRHH tarjeta (`4dcd9b9`) | `grillaGsoSoloLectura.js`, grilla + modales turno |
| **US-11** | — | **✅ Cerrado** — toast materialización sector alineado a titular | `grillaMaterializacionToast.js`, `useGrillaMesVista.js` |
| **US-13** | — | **✅ Cerrado (código)** — Fase A/B/C web + functions (`teoriaPermisosGso`, batch, G6 plan); **proceso:** deploy functions + validación [`CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md`](./CHECKLIST_VALIDACION_RRHH_US13_PERMISOS_TEORIA.md) en staging | [`MATRIZ_US13_PERMISOS_TEORIA_V2.md`](./MATRIZ_US13_PERMISOS_TEORIA.md) |
| **US-17** | — | **✅ Cerrado (código + ops)** — inventario + remediación 2026-06-06; audit prod **0 huecos** | [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md) · [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md) |

**Orden sugerido (restante épica GSO):** ~~US-3…US-11~~ ✅ · ~~**US-13**~~ ✅ (código 2026-06-08) · RFC HLG warning ⏸ RRHH · **ops US-13** (deploy + QA RRHH).

**Nota:** Piloto junio Sala **operativo** en BD; §2.1 es **defensa** desplegada ante regresión huecos/blanco. **US-17 global cerrado** 2026-06-06. **US-6 ⏳** en piloto estable suele no verse en LAO/franco ya materializado (QA 2026-06-08 — ver índice sesión).

---

## 1bis. RFC plan paralelo + HLg inmutable — **cerrado (Fases 0–5)**

**SSoT:** [`RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`](./RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md) · criterios GSO §6.7 · as-built §8 en [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md).

| Fase | Contenido | Estado | Referencia código / evidencia |
|------|-----------|--------|-------------------------------|
| **0** | Saneamiento BD legado | ✅ | `scripts/fase0-rfc-plan-paralelo-cleanup.mjs` |
| **1** | Schema `plan_rol`, `MERGEADO`, índices | ✅ | `planTurnoServicioMeta.js`, `fase1-migrate-plan-paralelo-schema.mjs` |
| **2** | Backend `plt_inc`, merge, materialización filtrada | ✅ | `planesTurnoServicio.js`, `planIncorporacionParalelo.js` |
| **3** | UI tarjetas duales, bandeja incorporación, banner | ✅ | `PlanTurnoServicioPage.jsx`, `planRolUtils.js` (`f187dff`) |
| **4** | HLg inmutable, `purgaAgentePlanesPorHlg`, anulación/cierre | ✅ | `catalogosLaborales.js`, `purgaAgentePlanesPorHlg.js` (`a245d86`) |
| **5** | Manual/glosario, criterios §6.7, checklist E2E doc | ✅ | `627a435` |

**Relación con backlog anterior:** cierra **F2 O-P1-4** / roadmap **2.5** (plan usuario nuevo §19.6) y el incidente “incorporar degrada principal a `EN_REVISION`”. **Blindaje huecos:** cerrado §2.1 (`v2.6.1`). **US-17:** cerrado código + ops (2026-06-06). **Sigue abierto:** reconciliación ⚠️ (§2.2).

**Opcional P2 (no bloquea RFC):** [`RFC_ALERTA_DIVERGENCIA_PLAN_VS_GRILLA_UX_V2.md`](./RFC_ALERTA_DIVERGENCIA_PLAN_VS_GRILLA_UX_V2.md) (**FUX-OPT-5**) — aviso on-demand plan foto vs grilla operativa.

---

## 3. F3 turnos compuestos — tickets UI pendientes

**Núcleo F3 cerrado** (tag `v2.3.0-f3-turnos-compuestos`). Falta **solo** capa editor/UX extendida:

| Ticket | Entregable | Estado | Referencia |
|--------|------------|--------|------------|
| **T-05** | (A) Foco GDT grilla RRHH+jefe (`8285283`) · planes URL escritura pendiente · (B) paleta `+` editor | **(A) grilla ✅** · planes/F3 pendiente | Handoff T-05 · épica [`EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md`](./EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md) |
| **T-06** | Bandeja + ayuda extendida | Pendiente | `HelpContext`, bandeja |
| **T-07** | Lecturas `vis_*` + caché RAM catálogo | Pendiente | Optimización; sin outbox |
| **T-09** | Guías + `helpContent` | Pendiente | Docs UX |

---

## 4. F-UX.3 / F4 — post-cierre opcional (no bloquea merge)

| ID | Entregable | Prioridad | Notas |
|----|------------|-----------|--------|
| **FUX-OPT-1** | Horas RRHH post-flujo C (fuera de celda) | P2 | Épica futura |
| **FUX-OPT-2** | Validación horas espejo A2 en servidor (A-BATCH) | P2 | Opcional RFC |
| **FUX-OPT-3** | Alias callable `enviarAccionesAsistencia` | P2 | Nombre histórico RFC; hoy = `aplicarBatchAsistencia` |
| **FUX-OPT-4** | Limpieza overrides smoke dev jun-2026 | P2 | Ops |
| **FUX-OPT-5** | Alerta divergencia dotación plan vs grilla (on-demand) | P2 | RFC [`RFC_ALERTA_DIVERGENCIA_PLAN_VS_GRILLA_UX_V2.md`](./RFC_ALERTA_DIVERGENCIA_PLAN_VS_GRILLA_UX_V2.md); independiente Fase 4 HLg |

**✅ Hecho:** 4.1–4.5 RFC F4, `aplicarBatchAsistencia` A/B/C v2, outbox UI, visual §12, smokes — registro §4–7.

---

## 5. Orquestación F2 — deuda abierta

Ver [`ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md`](./ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md) y [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md).

| ID | Entregable | Estado | Notas |
|----|------------|--------|--------|
| **O-P2-1** | Auto-cierre período día 5 (Scheduler) | P2 | Diferido; hoy cierre **manual** RRHH |
| **O-P2-2** | LAO + cola sin RDA §20.4 | P2 | Excepción con precedente RRHH |
| **O-P2-3** | Acotar lazy GSO si día 5 + alta HLg cubren | P2 | `grillaMesAgenteCore.js` |
| **O-P2-4** | Manual RRHH normativo desde `MANUAL_CAPAS_*` | P2 | Validación proceso |
| **F2-2.5 / O-P1-4** | Plan paralelo incorporación §19.6 + HLg cascada | ✅ | RFC Fases 0–5 — §1bis |
| **F2-2.1** | Toasts materialización UI unificados | ✅ | US-11 · `ccc1040` · hosting 2026-06-08 |
| **F2-2.3** | Feriado masivo / rematerializar rango amplio | P1 | Feriado 1 día ✅ |
| **F2-UX-6** | Auditar todos los callables listado grilla jefe sin `fichadas_reales` | P1 | Parcial `grillaVisSanitizeGso.js` |

---

## 6. Backlog transversal (baja / futuro)

| Tema | Estado | Notas |
|------|--------|--------|
| Fichadas reales (reloj) | Futuro | Integración hardware |
| Code splitting bundle > 500KB | P2 | Web perf |
| Hook KI-1 `proyectarAportesNormativosVisGrupo` | Futuro | Épica MDC extendida |
| Scripts legacy `audit-fase4-6`, `rematerializar-vis-turno-teorico` | P2 | Migrar a `buildVisDocumentId` 3 args |
| Materializar otros `gdt` fuera piloto Sala | Ops | Cuando RRHH lo pida |
| Unificar regla feriado worker vs `vis_*` | P1 | Plan § incidente L501–512 |
| Épica PR3 turno mensual otra rama | Bloqueado | Sin merge sin decisión explícita |

---

## 7. Qué **no** falta implementar (cerrado hasta 2026-06-05)

| Ámbito | Evidencia |
|--------|-----------|
| F-UX.3 wizard A/B/C + outbox v2 | UI + `cambiosTurno.js` + worker |
| Batch A-BATCH / B-BATCH-1 / C-BATCH | `17a04bf`, tests 9/9, smokes |
| F4 núcleo outbox | Mismo tramo F-UX.3 |
| F3 T-02, T-03, T-04, T-08 | Tests + smokes + piloto Sala |
| F-UX.2 badge F:n | Validado prod |
| F0 contención O-P0-4,1,5,7 | Smoke prod |
| F1 cierre período manual | Callable + UI GSO |
| **RFC plan paralelo + HLg inmutable (0–5)** | §1bis · `f187dff`, `a245d86`, `627a435` |
| **Épica blindaje GSO (US-9, 1, 16, 10, 14, 3 parcial)** | PR #2 · `v2.6.1-blindaje-gso` · hosting + functions prod |
| **GSO US-6, US-7, US-11 (lazy / franco / toasts)** | `ccc1040` · tag `v2.6.3-gso-us6` · hosting 2026-06-08 |
| GSO §6.7 pendiente incorporación vs fantasma | Criterios + análisis §8 (E2E manual doc) |

---

## 8. Próxima sesión de código (recomendación)

1. **Proceso:** deploy **functions** (US-13) + hosting si aplica · checklist RRHH staging.
2. **Paralelo:** F3 **T-05/T-06** (editor segmentos) o **FUX-OPT-5** (divergencia plan vs grilla).
3. **Proceso:** QA formal Multi-HLG §4.2 (ítems 6 y 9 manuales RRHH/jefe).
4. ~~**GSO US-6 → US-7 → US-11**~~ ✅ 2026-06-08 · ~~**US-17** ops~~ ✅ 2026-06-06 · ~~**US-3/US-14** completos~~ ✅.

Actualizar este archivo y [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) al cerrar cada ítem.
