## Resumen ejecutivo

Esta rama cierra la **épica de madurez operativa** en asistencia/turnos: el problema raíz que motivó el trabajo (degradación del plan principal al incorporar agentes, integridad HLg/planes y callejón operativo) queda resuelto y documentado como **as-built**, no como RFC pendiente.

**Punto de convergencia:** la estructura es robusta (`plan_rol`, `plan_padre_id`, `MERGEADO`, purga cascada HLg → `plt_*`). Lo que sigue en backlog es **integración en `master`**, **tag de release** y, en un sprint posterior, **blindaje de negocio al habilitar** (US-9/1/16), independiente de esta arquitectura.

---

## Qué incluye este PR

### 1. Multi-HLG / GSO / cierre período (F0–F1)

- Grilla scoped por `gdt_*`, `vis_*` / `capa_teorica_por_grupo`.
- Purge HLg post-corte, gates anclas, listado sector bulk, toasts materialización.
- Cierre / reapertura período liquidación (callable + UI RRHH).

### 2. F3 — Turnos compuestos (núcleo)

- Segmentos SoT, cobertura, `fichadas_esperadas` (F:n), piloto Sala.
- Tag previo en rama: `v2.3.0-f3-turnos-compuestos`.

### 3. F-UX.3 / F4 — Gestión turno del día + outbox

- Wizard A / B / C, outbox por tarjeta grupo×mes, visual grilla §12.
- `aplicarBatchAsistencia` v2 (A-BATCH, B-BATCH-1, C-BATCH).
- Desplegado y validado en prod (functions + hosting, jun 2026).

### 4. RFC Plan paralelo + HLg inmutable — **Fases 0–5 (as-built)**

Documento maestro: `docs/v2/RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`

| Fase | Entrega |
|------|---------|
| 0 | Saneamiento BD legado (`fase0-rfc-plan-paralelo-cleanup.mjs`) |
| 1 | Schema `plan_rol`, `MERGEADO`, índices Firestore |
| 2 | `plt_inc`, merge atómico, materialización filtrada por persona |
| 3 | UI tarjetas duales, bandeja incorporación, banner planificado vs fijo/rotativo |
| 4 | HLg inmutable (régimen/grupo), `purgaAgentePlanesPorHlg`, anulación/cierre integrados |
| 5 | Manual/glosario, criterios GSO §6.7, checklist E2E documentado |

**Efecto de negocio:** incorporar agentes en mes ya **HABILITADO** ya no muta el plan principal a `EN_REVISION`; el operativo permanece estable hasta merge explícito del hijo.

Criterios GSO: `docs/v2/CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md` §6.7.  
As-built: `docs/v2/ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md` §8.

---

## Producción (estado previo al merge)

- **Hosting:** https://portal-hospital-v2.web.app (builds desde esta rama, jun 2026).
- **Functions:** batch asistencia, grilla, planes (incorporación paralela), laborales (anulación/deshabilitar HLg + purga).

---

## QA ya realizado (rama / prod)

- [x] F-UX.3 batch manual + visual grilla post-batch
- [x] `npm run test:batch-asistencia-normalize` (9/9)
- [x] Smokes outbox / fichadas / materialización (dev con credenciales)
- [x] F3 piloto Sala + F:2 en grilla
- [x] F1 smokes cierre período + purge HLg
- [x] Plan paralelo: flujo documentado Fase 5 (E2E manual §8 análisis GSO)
- [x] QA manual Multi-HLG §4.2 (muestra en sesiones previas; acta formal REL-3 post-merge)

---

## Test plan post-merge (obligatorio antes de tag)

- [ ] Smoke §4.2 muestra desde `master`
- [ ] Grilla: un flujo A, B y C en período abierto
- [ ] Plan mensual: operativo HABILITADO → `plt_inc` → merge → GSO equipo coherente
- [ ] Sin regresión: cierre período, GSO M-1 solo lectura, purge HLg
- [ ] Índices Firestore en entorno objetivo

---

## Tag sugerido post-merge

- **Recomendado:** `v2.5.0-stable-planes-paralelos` (épica consolidada; evita colisión con `v2.2.0-pre-multi-hlg` y alinea semver tras `v2.3.0-f3` / notas `v2.4.0-fux`).
- Alternativa documentada: `v2.4.0-fux-gestion-turno` ampliando release notes con plan paralelo.

---

## Fuera de alcance (siguiente sprint desde `master`)

- **US-9 / US-1 / US-16** — blindaje anti-hueco al HABILITAR y anti-blanco GSO (P0).
- **US-17**, **T-05…T-09**, **FUX-OPT-5**.

Ver `docs/v2/PENDIENTES_IMPLEMENTACION_V2.md` §8.

---

## Documentación para revisores

- `docs/v2/RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`
- `docs/v2/REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`
- `docs/v2/PLAN_GRILLA_MULTI_HLG_V2.md`
- `docs/v2/PENDIENTES_IMPLEMENTACION_V2.md`
