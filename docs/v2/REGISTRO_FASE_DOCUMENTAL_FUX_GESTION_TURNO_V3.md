# Registro — Fase documental F-UX.3 Gestión turno del día (V2)

**Fecha cierre documental e implementación:** 2026-06-04  
**Estado:** Fase **COMPLETADA** en rama `feat/epic-multi-hlg-fase1-execution` · QA grilla prod OK · merge `master` pendiente  
**Tag sugerido post-merge:** `v2.4.0-fux-gestion-turno`

**Índice operativo:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) (bloque cierre) · PR: [`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md)

---

## 1. Artefactos nucleares (SSoT documental)

| # | Documento | Rol |
|---|-----------|-----|
| 1 | [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) | Contrato payloads A/B/C, reglas A-N*, B-N*, C-N*, §3.1 A-BATCH, §3.2 B-BATCH, §3.3 C-BATCH |
| 2 | [`RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md`](./RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md) | Preview celdas, post-batch, modal historial, `consultas_gestion_turno` |
| 3 | [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) | Outbox local, idempotencia, freeze, callable batch (nombre histórico `enviarAccionesAsistencia`) |
| 4 | [`HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md`](./HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md) | Handoff sesión: términos UI, matriz entregables, §12 visual |
| 5 | [`RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`](./RELEASE_NOTES_FUX_GESTION_TURNO_V3.md) | Release notes cierre F-UX.3 |
| 6 | [`RELEASE_NOTES_EPIC_TURNOS_COMPUESTOS_F3_V2.md`](./RELEASE_NOTES_EPIC_TURNOS_COMPUESTOS_F3_V2.md) | Prerequisito F3 (segmentos, F:n) |
| 7 | [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) | Segmentos SoT, materialización worker |
| 8 | [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) | Biblia grilla multi-HLG, gates, QA §4.2 |

**Amendments / anexos RFC F4:** `613b766` (Flujo B corrimiento intra-día).

---

## 2. Documentación de soporte (GSO / grilla / QA)

| Documento | Rol |
|-----------|-----|
| [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) | Gherkin capas 0–4, anti-blanco, licencias vs teoría |
| [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md) | Por qué la grilla equipo recalcula al abrir |
| [`HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md`](./HANDOFF_SESION_2026-06-02_PAUSA_F3_FUX_FICHADAS.md) | F-UX.2 fichadas esperadas (prerequisito badge F:n) |
| [`HANDOFF_SESION_2026-06-01_PAUSA_GSO_CIERRE_PERIODO.md`](./HANDOFF_SESION_2026-06-01_PAUSA_GSO_CIERRE_PERIODO.md) | Cierre período, freeze `ASI-PER-001` |
| [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md) | Etapas F-UX … F4 (actualizado § F-UX.3 / F4) |

---

## 3. Decisiones de producto cerradas (resumen)

| Tema | Decisión |
|------|----------|
| Flujo A | Intercambio bilateral; dos fechas; dos tokens `vis_*`; `schema_version: 2` en ambos `asi_*` |
| Flujo B | Traslado origen→destino aditivo; franco en origen solo si no queda saldo; batch expande 2 ítems (`reemplazo_traslado_v2`) |
| Flujo C | Adicional con `estado_previo`; sin horas en alta jefe; materialización unifica en grilla |
| Outbox | Tarjeta por **grupo × mes**; preview en grilla antes de aplicar; no iconos en celda |
| Batch | `aplicarBatchAsistencia`; máx. 50 ops; mismo período; concurrencia `[ASI-CONC-001]` |
| Roles etapa 1 | RRHH y jefe mismas capabilities gestión turno (restricción etapa 2 diferida) |

---

## 4. Alineación con código (2026-06-04)

### Backend (Functions)

| Pieza | Ruta | Notas |
|-------|------|--------|
| Batch + overrides | `functions/modules/asistencia/cambiosTurno.js` | `normalizeBatchOp*`, A/B/C v2, `aplicarBatchAsistencia`, `registrarConsultaGestionTurnoGrilla` |
| Materialización día | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` | `aplicarCoberturasParciales` v2 cross-fecha; traslado v2 origen/destino |
| Capa teórica lectura | `functions/modules/asistencia/obtenerCapaTeoricaDia.js` | Concurrencia `version_token` |
| GSO solo lectura | `functions/modules/asistencia/grillaGsoSoloLectura.js` | `ASI-GSO-001`, período cerrado `ASI-PER-001` |
| IDs documentos | `functions/modules/shared/mdcRdaDocumentIds.js` | `asi_*`, `vis_*` |

### Frontend (Web)

| Pieza | Ruta | Notas |
|-------|------|--------|
| Shell grilla + batch | `web/src/features/grilla/GrillaMesLicenciasPanel.jsx` | Outbox, aplicar batch, errores callable |
| Wizard / modales | `ModalGestionTurnoDia.jsx`, `ModalCoberturaParcial.jsx`, `ModalCambioTurnoPropio.jsx`, `ModalTurnoAdicional.jsx` | Flujos A/B/C |
| Preview outbox | `grillaCeldaOutboxVisual.js`, `grillaCambioTurnoPropioPreview.js`, `grillaCoberturaParcialPreview.js`, `grillaAdicionalPreview.js` | `proyectarDiaConOpsPendientes` |
| Labels outbox | `grillaOutboxLabels.js` | Tarjetas legibles |
| Wire batch | `web/src/services/coberturaParcialService.js` | `mapOutboxOpToBatchPayload`, tokens dual A/B |
| Callables | `web/src/services/callables.js` | `aplicarBatchAsistencia`, `registrarConsultaGestionTurnoGrilla` |
| Historial celda | `grillaGestionTurnoHistorial.js`, `DiaGrillaDetalleModal.jsx` | Amendment §5 |

### Tests y smokes

| Comando | Alcance |
|---------|---------|
| `npm run test:batch-asistencia-normalize` | 9 tests normalización legacy + A/B/C v2 |
| `npm run smoke:outbox-batch` | Legacy cobertura + rollback concurrencia (dev + credenciales) |
| `npm run smoke:outbox-batch-v2` | A/B/C integración Firestore (`scripts/smoke-outbox-batch-v2-dev.mjs`) |
| `npm run test:segmentos-contract` | Contrato F3 segmentos |

---

## 5. Historial git (tramo F-UX.3 en rama)

| Commit | Resumen |
|--------|---------|
| `eaf5e92` | Spec gestión turno A/B/C §9 |
| `93dd385` | Entregable 1 shell modal, materializar celda |
| `19b411e` | Frontend A/B/C outbox v2 legible |
| `7be370b` | Outbox tarjeta grupo×mes |
| `613b766` | Amendment RFC Flujo B |
| `c3e0294` | Amendment visual grilla + handoff §12 |
| `73d58cd` | Preview visual grilla + consulta ligera |
| `a49e9f1` | C-BATCH normalizer |
| `17a04bf` | A-BATCH + B-BATCH-1 + worker + smokes v2 |
| `425b869` / `61d8005` | Handoff/pendientes QA |
| `97409b4` | Release notes + plantilla PR + docs GSO índice |

**Deploy prod (sesión):** functions 2026-06-04 · hosting 2026-06-04 · QA usuario batch 4 + grilla OK.

---

## 6. Callables desplegados (invoker público + IAM grant script)

| Callable | Uso F-UX |
|----------|----------|
| `aplicarBatchAsistencia` | Aplicar cola outbox |
| `registrarConsultaGestionTurnoGrilla` | Consulta ligera al abrir celda con overrides |
| `materializarTurnoTeoricoDia` | Rematerialización post override |
| `obtenerCapaTeoricaDia` | Token concurrencia modales |
| `obtenerVistaGrillaMesAgente` / `listarVistaGrillaMesPorGrupo` | Grilla |
| `cerrarPeriodoLiquidacion` / `reabrirPeriodoLiquidacion` | Freeze período |

Script IAM: `npm run firebase:grant-callables-invoker` (tras `gcloud auth login`).

---

## 7. QA cerrado

| Prueba | Resultado |
|--------|-----------|
| Navegador wizard A/B/C + outbox | ✅ Sesión 2026-06-03 |
| Visual §12 preview + modal | ✅ Código + hosting |
| Batch manual prod | ✅ 4 aplicadas |
| Grilla post-batch | ✅ Usuario 2026-06-04 |
| Unit normalize 9/9 | ✅ |
| Smoke legacy batch | ✅ |
| Smoke v2 A/B/C dev | ✅ |

---

## 8. Pendiente post-cierre (no bloquea registro documental)

| Ítem | Notas |
|------|--------|
| Merge PR → `master` | [`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md) |
| Tag `v2.4.0-fux-gestion-turno` | Tras merge |
| Horas RRHH post-flujo C | Fuera de celda; épica futura |
| Validación horas espejo A2 en servidor | Opcional A-BATCH |
| `enviarAccionesAsistencia` alias legacy | Nombre RFC; implementación = `aplicarBatchAsistencia` |
| Limpieza overrides smoke jun-2026 dev | Ops opcional |

---

## 9. Indexación en README y roadmap

Este registro debe citarse desde:

- [`docs/v2/README.md`](./README.md) — tabla módulo operativo
- [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md) — F-UX.3 y F4
- [`HANDOFF_AGENTE_IMPLEMENTACION_ROADMAP.md`](./HANDOFF_AGENTE_IMPLEMENTACION_ROADMAP.md) — estado F-UX.3

**Última actualización registro:** 2026-06-04
