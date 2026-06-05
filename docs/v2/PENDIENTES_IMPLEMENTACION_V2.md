# Pendientes de implementación — Portal Hospital V2

**SSoT backlog código/producto** (qué **falta implementar** o cerrar en proceso).  
**Última actualización:** 2026-06-04  
**Rama de trabajo:** `feat/epic-multi-hlg-fase1-execution`  
**Sesión / continuidad:** [`HANDOFF_SESION_2026-06-04_CIERRE_FUX_BATCH_Y_DOCUMENTAL.md`](./HANDOFF_SESION_2026-06-04_CIERRE_FUX_BATCH_Y_DOCUMENTAL.md) · índice corto: [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)

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

## 2. Épica GSO — conflictos capas (código pendiente)

**Documentación lista; implementación no iniciada.**  
Criterios: [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) · brechas: [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md) · acta: [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md).

| US | Prioridad | Qué falta implementar | Archivos / área típica |
|----|-----------|------------------------|-------------------------|
| **US-9** | P0 | Rechazar habilitar plan con `laborable`/`guardia` sin `turno_id` | `functions/modules/asistencia/planesTurnoServicio.js` |
| **US-1** | P0 | Anti-blanco: celda `laborable` sin `rda_*` → estado visible (no `tieneDatos=false` vacío) | `GrillaMesEquipoTabla.jsx`, `GrillaMesTitularCalendario.jsx`, display helpers |
| **US-16** | P0 | Bloqueo operación en `INCOMPLETO_PLAN`; sin override en hueco de plan | Misma grilla + gates modales |
| **US-10** | P1 | Warning al guardar plan borrador con huecos | Editor plan mensual |
| **US-3** | P1 | Badge ⚠️ teoría vs licencia / post-cambio teoría | `GrillaMesCeldaLicencia`, tabla equipo |
| **US-14** | P1 | Acciones acta ante ⚠️ (corregir plan, bandeja, gestión) | `DiaGrillaDetalleModal.jsx` |
| **US-15** | P2 | Presente/ausente fichada por rol (sin crudo a jefe) | GSO + `grillaVisSanitizeGso.js` (extender) |
| **US-4** | P1 | Ícono/enlace fan-out estándar | Etiquetas grilla |
| **US-5** | P1 | Copy unificado post-purge HLg | UI grilla / toasts |
| **US-6** | P2 | Indicador lazy materialización consistente | `varianteCeldaOperativa`, toasts titular vs equipo |
| **US-7** | P2 | Hint licencia en franco | UI celda |
| **US-8** | P1 | Revisar gates modales turno con mes cerrado / `ASI-GSO-001` | Modales gestión turno |
| **US-11** | P2 | Unificar mensaje materialización equipo vs titular | `useGrillaMesVista.js`, `grillaMaterializacionToast.js` |
| **US-13** | P1 | Matriz permisos teoría (doc → código) | Disperso plan / override / HLg |
| **US-17** | P0 (ops) | Inventario global planes `HABILITADO` sin huecos | Script / informe (no solo piloto junio Sala) |

**Orden sugerido:** US-9 → US-1 + US-16 → US-10 → US-3 + US-14 + US-15 → US-17 → resto (ver análisis §5).

**Nota:** Piloto junio Sala **operativo** en BD; las US anteriores son **defensa** ante regresión.

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

## 7. Qué **no** falta implementar (cerrado 2026-06-04)

| Ámbito | Evidencia |
|--------|-----------|
| F-UX.3 wizard A/B/C + outbox v2 | UI + `cambiosTurno.js` + worker |
| Batch A-BATCH / B-BATCH-1 / C-BATCH | `17a04bf`, tests 9/9, smokes |
| F4 núcleo outbox | Mismo tramo F-UX.3 |
| F3 T-02, T-03, T-04, T-08 | Tests + smokes + piloto Sala |
| F-UX.2 badge F:n | Validado prod |
| F0 contención O-P0-4,1,5,7 | Smoke prod |
| F1 cierre período manual | Callable + UI GSO |

---

## 8. Próxima sesión de código (recomendación)

1. **Proceso:** REL-1 merge PR (si aprobado).
2. **Código P0:** épica GSO **US-9** + **US-1** + **US-16** (un sprint defensivo).
3. **Paralelo opcional:** F3 **T-05** si prioriza editor plan sobre GSO.

Actualizar este archivo y [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) al cerrar cada ítem.
