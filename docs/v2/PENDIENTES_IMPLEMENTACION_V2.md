# Pendientes de implementación — Portal Hospital V2

**SSoT backlog código/producto** (qué **falta implementar** o cerrar en proceso).  
**Última actualización:** 2026-06-05 (**PAUSA** — US-17 código cerrado; remediación RRHH pendiente)  
**Rama / release:** `master` @ `352692b` · tag **`v2.6.1-blindaje-gso`** · PR blindaje [#2](https://github.com/jorgemosto1981/portal-hospital-v2/pull/2) · PR US-17 [#3](https://github.com/jorgemosto1981/portal-hospital-v2/pull/3) **mergeado**  
**Sesión / continuidad:** **RETOMAR** [`HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md`](./HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md) · índice: [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) · RFC: [`RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`](./RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md)

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

### 2.2 GSO — código aún pendiente

| US | Prioridad | Qué falta implementar | Archivos / área típica |
|----|-----------|------------------------|-------------------------|
| **US-3** | P1 | Badge ⚠️ teoría vs licencia / post-cambio teoría (escenario A; distinto de B en modal) | `GrillaMesCeldaLicencia`, tabla equipo |
| **US-14** | P1 | Acciones acta ante ⚠️ residual (bandeja + gestión turno; acción 1–2 completas en otros flujos) | `DiaGrillaDetalleModal.jsx` (extender) |
| **US-15** | P2 | Presente/ausente fichada por rol (sin crudo a jefe) | GSO + `grillaVisSanitizeGso.js` (extender) |
| **US-4** | P1 | Ícono/enlace fan-out estándar | Etiquetas grilla |
| **US-5** | P1 | Copy unificado post-purge HLg | UI grilla / toasts |
| **US-6** | P2 | Indicador lazy materialización consistente | `varianteCeldaOperativa`, toasts titular vs equipo |
| **US-7** | P2 | Hint licencia en franco | UI celda |
| **US-8** | P1 | Revisar gates modales turno con mes cerrado / `ASI-GSO-001` | Modales gestión turno |
| **US-11** | P2 | Unificar mensaje materialización equipo vs titular | `useGrillaMesVista.js`, `grillaMaterializacionToast.js` |
| **US-13** | P1 | Matriz permisos teoría (doc → código) | Disperso plan / override / HLg |
| **US-17** | P0 (ops) | **✅ Código cerrado** (`master`, audit + severidad ALTA/MEDIA) · **⏳ Remediación RRHH:** 135 huecos → **9 ALTA** + **126 MEDIA** (inventario 2026-06-05) | [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md) · handoff [`HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md`](./HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md) |

**Orden sugerido (restante):** US-17 remediación (ops RRHH, re-audit) **en paralelo** con US-3 escenario A + US-14 completo → US-15 → resto (ver análisis §5).

**Nota:** Piloto junio Sala **operativo** en BD; §2.1 es **defensa** desplegada ante regresión huecos/blanco. **No** sustituye remediación histórica (**US-17**) ni RFC plan paralelo (§1bis).

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

**Relación con backlog anterior:** cierra **F2 O-P1-4** / roadmap **2.5** (plan usuario nuevo §19.6) y el incidente “incorporar degrada principal a `EN_REVISION`”. **Blindaje huecos:** cerrado §2.1 (`v2.6.1`). **US-17 inventario (código):** cerrado en `master`. **Sigue abierto:** US-17 remediación ops, reconciliación ⚠️ (§2.2).

**Opcional P2 (no bloquea RFC):** [`RFC_ALERTA_DIVERGENCIA_PLAN_VS_GRILLA_UX_V2.md`](./RFC_ALERTA_DIVERGENCIA_PLAN_VS_GRILLA_UX_V2.md) (**FUX-OPT-5**) — aviso on-demand plan foto vs grilla operativa.

---

## 3. F3 turnos compuestos — tickets UI pendientes

**Núcleo F3 cerrado** (tag `v2.3.0-f3-turnos-compuestos`). Falta **solo** capa editor/UX extendida:

| Ticket | Entregable | Estado | Referencia |
|--------|------------|--------|------------|
| **T-05** | Grilla selector dinámico / editor segmentos en plan mensual | Pendiente | [`EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md`](./EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md), `GrillaMensualEditor` |
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
| **F2-2.1** | Toasts materialización UI unificados | P1 | Metadata `vis_*` ✅; toasts ⏳ |
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
| GSO §6.7 pendiente incorporación vs fantasma | Criterios + análisis §8 (E2E manual doc) |

---

## 8. Próxima sesión de código (recomendación)

1. **QA manual:** checklist [`PR_BLINDAJE_GSO_BODY.md`](./PR_BLINDAJE_GSO_BODY.md) (jefe: editor + GSO; RRHH: aprobar con hueco → `PLT-US9-001`).
2. **Ops P0:** **US-17** inventario planes `HABILITADO` sin huecos (remediación global).
3. **Código P1:** US-3 escenario A (⚠️ teoría post-licencia) + US-14 acciones completas ante ⚠️.
4. **Paralelo opcional:** F3 **T-05** o **FUX-OPT-5** (divergencia plan vs grilla).

Actualizar este archivo y [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) al cerrar cada ítem.
