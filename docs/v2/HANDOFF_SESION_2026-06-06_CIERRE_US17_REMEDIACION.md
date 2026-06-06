# Handoff — Sesión 2026-06-06 · Cierre US-17 remediación + integridad plan/régimen

**Estado:** **CERRADO (ops + código)** — meta US-17 alcanzada en prod.  
**Producción:** https://portal-hospital-v2.web.app  
**Handoff anterior (pausa inventario):** [`HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md`](./HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md)  
**Índice RETOMAR AQUÍ:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)

---

## 1. Resumen ejecutivo

| Métrica (2026-06-05 inventario) | Valor inicial | Valor cierre (2026-06-06) |
|---------------------------------|--------------:|--------------------------:|
| Planes HABILITADO analizados | 5 | 5 |
| Planes con huecos US-9 | 4 | **0** |
| Total celdas hueco | 135 (9 ALTA + 126 MEDIA) | **0** |
| Severidad ALTA / MEDIA | 9 / 126 | **0 / 0** |

**Criterio de cierre ops cumplido:** `npm run audit:us17-planes-huecos` → `total_huecos_celdas = 0`.

Reporte local (gitignored): `reports/us17-2026-06-06-cierre.json` — regenerar con:

```bash
npm run audit:us17-planes-huecos -- --json --out=reports/us17-<fecha>.json
```

---

## 2. Planes en prod al cierre

| Plan ID | Grupo | Período | Estado | Agentes | Huecos |
|---------|-------|---------|--------|--------:|-------:|
| `plt_01KSXB976E9ZWFX3PKKEZAJ9VY` | Sala Internación 1 | 2026-05 | HABILITADO | 3 | 0 |
| `plt_01KT9AZQGV0BRZVSEEMBT0141A` | Sala Internación 1 | 2026-06 | HABILITADO | 4 | 0 |
| `plt_01KT2BWXXAFPTYEG77Y0KWFS74` | Oficina PERSONAL | 2026-06 | HABILITADO | 4 | 0 |
| `plt_01KT2AT1Q2JK9EXKHH0J9GW532` | Sala Internación 1 | 2026-07 | HABILITADO | 4 | 0 |
| `plt_01KT2DBNY80WGR6KKKWZ46JG8F` | Oficina PERSONAL | 2026-07 | HABILITADO | 4 | 0 |

**Incidente piloto cerrado:** mayo Sala — régimen **fijo** MOSTO (08–14) sin `turnos_disponibles` en cfg → 9 huecos MEDIA → corregido vía enriquecimiento server-side + flujo rechazo → guardar → enviar → aprobar.

---

## 3. Cambios de código (integridad plan ↔ régimen)

| Capa | Archivo / entrega | Qué hace |
|------|-------------------|----------|
| **R0** | `functions/modules/asistencia/planEnriquecimientoDias.js` | `enriquecerAgentesDiasPlan`, inferencia `turno_id` fijo/rotativo, pool cruzado del plan, ids estables ≤32 chars |
| **R0** | `functions/modules/asistencia/planesTurnoServicio.js` | Enriquecer + `assertPlanSinHuecosTurno` en **guardar** y **aprobar** |
| **R2** | `scripts/reimpact-plan-mensual-r2.mjs` | Re-derivar planes mensuales (incl. `BORRADOR`) |
| **UI** | `web/src/pages/jefe/planes/GrillaMensualEditor.jsx` | Filas fijo/rotativo: huecos omitidos en contador; guardar con `turno_id: null` (servidor enriquece) |
| **UI** | `web/src/pages/jefe/PlanTurnoServicioPage.jsx` | Mes anterior rechazado editable; **Editar/Enviar** en plan principal BORRADOR; plan fresco en modal opciones |
| **Tests** | `functions/test/planEnriquecimientoDias.test.js` | 10/10 OK |

Manifiesto arquitectónico: [`MANIFIESTO_REIMPACTO_INTEGRIDAD_PLAN_REGIMEN_2026.md`](./MANIFIESTO_REIMPACTO_INTEGRIDAD_PLAN_REGIMEN_2026.md).

---

## 4. Validación ejecutada

| Prueba | Resultado |
|--------|-----------|
| `npm run audit:us17-planes-huecos` | 5 escaneados, 0 huecos |
| `node scripts/_tmp-audit-estados-planes.mjs` | 5 HABILITADO, 0 huecos en todos |
| `npm run test:plan-enriquecimiento-dias` | 10/10 |
| Flujo RRHH mayo Sala | Rechazo → corrección → guardar → enviar → **aprobar** (validado por operador) |
| MOSTO mayo | `turno_id: M`, sin ids >32, 0 laborables sin turno |

---

## 5. Deuda menor (no bloquea grilla)

| ID | Descripción | Prioridad |
|----|-------------|-----------|
| **R5-partial** | `contarHuecosEnPlanMensual` en página no omite fijo/rotativo como el editor (mitigado por enriquecimiento al guardar) | P2 |
| **DEF-enviar** | `enviarPlanTurnoServicio` no re-ejecuta assert US-9 en servidor (confía en guardar previo) | P2 |
| **OPS-script** | `audit-fase4-6-plan-habilitado.mjs` — actualizar plan ID / grupo hardcodeado | P2 |

---

## 6. Siguiente línea de trabajo (post US-17)

| Prioridad | Épica | Referencia |
|-----------|-------|------------|
| **P1** | US-3 escenario A (badge ⚠️ teoría vs licencia) | `PENDIENTES_IMPLEMENTACION_V2.md` §2.2 |
| **P1** | US-14 completo (acciones acta ante ⚠️) | `DiaGrillaDetalleModal.jsx` |
| **P2** | T-05/T-06 F3 editor segmentos | `EPIC_TURNOS_COMPUESTOS_TICKETS_V2.md` |
| **Proceso** | QA formal Multi-HLG §4.2 | `PLAN_GRILLA_MULTI_HLG_V2.md` |

---

## 7. Documentos SSoT actualizados

| Archivo | Rol |
|---------|-----|
| [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md) | Inventario + cierre ops |
| [`MANIFIESTO_REIMPACTO_INTEGRIDAD_PLAN_REGIMEN_2026.md`](./MANIFIESTO_REIMPACTO_INTEGRIDAD_PLAN_REGIMEN_2026.md) | R0–R3 cerrados |
| [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) | US-17 ✅ ops |
| [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) | US-17 global ✅ |
| `reports/US17_LISTA_TRABAJO_RRHH_2026-06-05.md` | Lista histórica (supersedida por cierre) |

**Última actualización documental:** 2026-06-06 — cierre US-17 remediación.
