# Handoff — Cierre Fase 5 grilla (Plan + GSO + titular)

**Fecha:** 2026-06-06  
**Estado:** **Fase 5 cerrada** en `master` + prod hosting  
**Commits:** `2ce3b49` (segmentación plan/GSO) · `438e398` (calendario titular por tramo HLg)  
**Prod:** https://portal-hospital-v2.web.app  
**Plan maestro:** [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) §7ter

---

## Entregables cerrados

| Capa | Qué | Evidencia |
|------|-----|-----------|
| Backend | `hlgSegmentosMes`, filas por `fila_id = persona_id__hlg_id` | `npm run test:fase5-segmentacion-hlg` — 30 tests OK |
| GSO equipo | 1 fila/tramo HLg, vacío positivo fuera vigencia | `smoke-listar-grilla-mosto-jun26.mjs` — 2 filas MOSTO |
| Plan mensual + aprobada | Segmentación tramos, US-9 scoped | Validación UI jun-2026 Sala |
| **Calendario titular** | 1 calendario/tramo HLg; celdas vacías fuera periodo; licencias solo en tramo; `color_ui` unificado | Validación UI Jorge 2026-06-06 |
| Deploy | push `master` + hosting | `438e398` @ origin |

### Piloto MOSTO jun-2026 Sala

| Tramo | HLg | Rango | Carga |
|-------|-----|-------|-------|
| A | `hlg_01KSMMYTHPM9ASYSKW1E6RTQ0N` | 01–10/06 | 12 hs fijo |
| B | `hlg_01KT78BKZB57XYCKW7QN55JHEP` | 11–30/06 | 40 hs planificado |

---

## Matriz §4.2 — sign-off Fase 5

| # | Caso | Estado | Notas |
|---|------|--------|-------|
| 1 | CHAPARRO jun Sala | ✅ | smoke BD 2026-06-06 |
| 2 | MOSTO LAO + GS-A en gdt correcto | ✅ | UI titular + `color_ui` unificado |
| 3 | LOKITO planificado/compuesto | ✅ | smoke jun/jul Oficina |
| 5 | Titular multicargo / multitrato | ✅ | 2 calendarios jun Sala; vacío fuera tramo |
| 8 | Grilla equipo jefe | ✅ | 2 filas MOSTO; smoke callable |
| 6 | Rehabilitar/eliminar plan | ⏳ | Manual RRHH — no bloquea Fase 5 |
| 9 | Override jefe scoped | ⏳ | Manual jefe — no bloquea Fase 5 |

**Smoke automatizado:** `node scripts/smoke-f1-qa-4-2-prod.mjs` — 5 OK, 1 SKIP, 0 FAIL (2026-06-06).

---

## Archivos clave (titular)

| Archivo | Rol |
|---------|-----|
| `web/src/features/grilla/grillaTitularTramosMes.js` | Segmenta HLg → calendarios titular |
| `web/src/features/grilla/useGrillaMesVista.js` | `titularCalendarios[]` por tramo |
| `web/src/features/grilla/GrillaMesTitularCalendario.jsx` | UI calendario (vacío / fondos / licencias) |
| `web/src/features/grilla/GrillaMesLicenciasPanel.jsx` | Secciones por tramo + rango |
| `web/src/features/grilla/grillaMesCellUtils.js` | `color_ui` consistente en todas las vistas |

---

## Pendiente post-Fase 5 (siguiente sprint)

1. **US-3 escenario A + US-14** — [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)
2. **§4.2 ítems 6 y 9** — QA manual RRHH/jefe cuando haya ventana
3. **F2.4** — deploy + smoke job materialización día 5
4. **O-P1-3** — GSO M-1 solo lectura usuario/jefe

---

*Sesión cerrada 2026-06-06. Épica Multi-HLG en `master`; no queda PR de Fase 5 pendiente.*
