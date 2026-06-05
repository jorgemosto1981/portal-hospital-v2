# Pull request — Cierre épica asistencia (consolidado)

Usar al abrir el PR en GitHub:

- **Base:** `master`
- **Compare:** `feat/epic-multi-hlg-fase1-execution`

**Estrategia acordada:** merge + tag **antes** de iniciar US-9 (blindaje anti-hueco). Este PR no incluye US-9/1/16.

**RFC as-built (plan paralelo + HLg):** [`RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`](./RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md)  
**Backlog post-merge:** [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md)

---

## Title

```
feat(epic): Multi-HLG, F3, F-UX.3 outbox/batch y RFC plan paralelo + HLg inmutable (Fases 0–5)
```

## Body (copiar en GitHub)

```markdown
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

Documento maestro: [`docs/v2/RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`](docs/v2/RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md)

| Fase | Entrega |
|------|---------|
| 0 | Saneamiento BD legado (`fase0-rfc-plan-paralelo-cleanup.mjs`) |
| 1 | Schema `plan_rol`, `MERGEADO`, índices Firestore |
| 2 | `plt_inc`, merge atómico, materialización filtrada por persona |
| 3 | UI tarjetas duales, bandeja incorporación, banner planificado vs fijo/rotativo |
| 4 | HLg inmutable (régimen/grupo), `purgaAgentePlanesPorHlg`, anulación/cierre integrados |
| 5 | Manual/glosario, criterios GSO §6.7, checklist E2E documentado |

**Efecto de negocio:** incorporar agentes en mes ya **HABILITADO** ya no muta el plan principal a `EN_REVISION`; el operativo permanece estable hasta merge explícito del hijo.

Criterios GSO incorporación vs fantasma: [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](docs/v2/CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) §6.7.  
As-built: [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](docs/v2/ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md) §8.

---

## Producción (estado previo al merge)

- **Hosting:** https://portal-hospital-v2.web.app (builds desde esta rama, jun 2026).
- **Functions:** batch asistencia, grilla, planes (`iniciarIncorporacionPlanMensual`, merge incorporación), laborales (`rrhhEliminarHlgAnulada`, deshabilitar HLg + purga).

---

## QA ya realizado (rama / prod)

- [x] F-UX.3 batch manual + visual grilla post-batch
- [x] `npm run test:batch-asistencia-normalize` (9/9)
- [x] Smokes outbox / fichadas / materialización (dev con credenciales)
- [x] F3 piloto Sala + F:2 en grilla
- [x] F1 smokes cierre período + purge HLg
- [x] Plan paralelo: flujo documentado Fase 5 (E2E manual §8 análisis GSO)
- [x] QA manual Multi-HLG §4.2 (muestra A/B en sesiones previas; acta formal REL-3 puede completarse post-merge)

---

## Test plan post-merge (obligatorio antes de tag)

- [ ] `git pull` en `master` — build web + smoke §4.2 muestra desde `master`
- [ ] Grilla: un flujo A, B y C en período abierto
- [ ] Plan mensual: mes con operativo HABILITADO → incorporación `plt_inc` → merge → GSO equipo coherente
- [ ] Sin regresión: cierre período, GSO M-1 solo lectura, purge HLg
- [ ] Índices Firestore desplegados (`firebase-v2/firestore.indexes.json`) en entorno objetivo

---

## Tag sugerido post-merge

Elegir **una** convención (equipo):

| Opción | Tag | Notas |
|--------|-----|--------|
| A (release notes existentes F-UX) | `v2.4.0-fux-gestion-turno` | Ampliar notas con bullet plan paralelo |
| B (énfasis plan paralelo) | `v2.5.0-planes-paralelos-hlg` | Épica asistencia + RFC 0–5 |
| C (nombre propuesto operativo) | `v2.5.0-stable-planes-paralelos` | Evitar `v2.2-*` (ya existe `v2.2.0-pre-multi-hlg`) |

Referencias: [`RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`](./RELEASE_NOTES_FUX_GESTION_TURNO_V3.md), [`RELEASE_NOTES_EPIC_TURNOS_COMPUESTOS_F3_V2.md`](./RELEASE_NOTES_EPIC_TURNOS_COMPUESTOS_F3_V2.md).

---

## Fuera de alcance de este PR (siguiente sprint)

- **US-9 / US-1 / US-16** — blindaje anti-hueco al **HABILITAR** y anti-blanco en GSO (P0; rama nueva desde `master` post-merge).
- **US-17** — inventario global planes HABILITADO sin huecos.
- **T-05…T-09** — editor segmentos F3 UI extendida.
- **FUX-OPT-5** — alerta divergencia plan foto vs grilla operativa.

Ver [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) §8.

---

## Documentación clave para revisores

| Doc | Rol |
|-----|-----|
| `RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md` | As-built incorporación + HLg |
| `REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md` | Inventario F-UX.3 / F4 |
| `PLAN_GRILLA_MULTI_HLG_V2.md` | Biblia Multi-HLG |
| `PENDIENTES_IMPLEMENTACION_V2.md` | Qué falta después del merge |

---

## Notas de merge

- Squash o merge commit según convención del repo.
- No mezclar rama `feat/epic-turno-mensual-fase2-pr3` sin decisión explícita.
- Tras merge: `npm run firebase:grant-callables-invoker:firebase-login` si hay callables nuevos con 403 OPTIONS.
```

## Comandos (operador)

```powershell
cd "E:\web nueva\portal-hospital-v2"
git fetch origin
git checkout feat/epic-multi-hlg-fase1-execution
git pull origin feat/epic-multi-hlg-fase1-execution

# Requiere gh auth login (REL-4)
gh pr create --base master --head feat/epic-multi-hlg-fase1-execution `
  --title "feat(epic): Multi-HLG, F3, F-UX.3 outbox/batch y RFC plan paralelo + HLg inmutable (Fases 0–5)" `
  --body-file docs/v2/PR_EPIC_BODY_GITHUB.md
```

Opcional: extraer solo el bloque markdown del **Body** a `PR_EPIC_BODY_GITHUB.md` si `gh` no acepta el archivo completo con frontmatter.

## Merge

Squash o merge commit según convención del repo. No incluir en el PR archivos locales de sync `functions/modules/shared/*` si aparecen en otra rama.
