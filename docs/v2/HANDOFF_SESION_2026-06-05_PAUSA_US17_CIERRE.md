# Handoff — Sesión 2026-06-05 · Cierre US-17 inventario + pausa

**Estado:** **SUPERSEDED** — ver cierre [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md).  
**Rama canónica:** `master` @ `352692b` (merge PR [#3](https://github.com/jorgemosto1981/portal-hospital-v2/pull/3))  
**Release previo (blindaje):** tag **`v2.6.1-blindaje-gso`** · PR [#2](https://github.com/jorgemosto1981/portal-hospital-v2/pull/2)  
**Producción:** https://portal-hospital-v2.web.app

---

## 1. Qué se cerró en esta sesión (US-17)

| Tema | Resultado |
|------|-----------|
| **Lib US-9 / US-17** | `listarHuecosTurnoEnAgentes` + refactor `assertPlanSinHuecosTurno` (`validacionesPlanTurno.js`) |
| **CLI audit** | `scripts/audit-planes-habilitados-huecos-us17.mjs` · `npm run audit:us17-planes-huecos` |
| **Severidad RRHH** | Cruce `vis_*` (`vistas_grilla_mes_agente`): **ALTA** (sin jornada materializada) vs **MEDIA** (deuda persistencia: GSO muestra turno, plan sin `turno_id`) — **US-9 no se relaja** |
| **`sin_agentes`** | `severidad_plan: ALTA`, `anomalia_estructural: sin_agentes` en JSON |
| **Inventario prod** | 2026-06-05: 5 planes analizados, 4 con huecos, **135** celdas US-9 → **9 ALTA** + **126 MEDIA** |
| **Documentación** | `PLAN_VUELO_US17_INVENTARIO_PLANES.md`, `PR_US17_BODY.md`, `PENDIENTES_IMPLEMENTACION_V2.md` §2 |
| **Merge** | PR #3 → `master` (`dc25366` severidad + docs) |

### Diagnóstico clave (para posteridad)

- **US-9** valida **contrato del plan** (`turno_id` en `agentes[].dias`).
- **GSO / calendario licencias** muestra **materialización** (`rda_ingreso` / `rda_egreso` en `vis_*`).
- Celda con turno visible pero listada por US-17 = **MEDIA** (asignación volátil hasta persistir en plan).
- Caso piloto mayo Sala MOSTO: 9 huecos US-9 todos **MEDIA** (coherente con captura de grilla).

---

## 2. Pasivo histórico (ops RRHH — no código)

| Métrica | Valor |
|---------|------:|
| Huecos US-9 totales | 135 |
| Prioridad **ALTA** | 9 |
| Prioridad **MEDIA** | 126 |
| Planes sin agentes (prod) | 0 |

**Guía:** [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md) (contrato salida + acciones ALTA vs MEDIA).  
**Reportes locales (gitignored):** `reports/us17-2026-06-05.json`, `reports/us17-2026-06-05-severidad.json`.

**Criterio de cierre ops:** re-audit hasta `total_huecos_celdas`, `total_huecos_severidad_alta` y `total_huecos_severidad_media` = **0**.

```bash
npm run audit:us17-planes-huecos -- --json --out=reports/us17-<fecha>.json
```

---

## 3. Arranque próxima sesión

```bash
git fetch origin
git checkout master
git pull origin master
```

1. Copiar **`.env.v2.local`** en la raíz (no está en git).
2. Leer en orden:
   - [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) (bloque **RETOMAR AQUÍ**)
   - Este handoff
   - [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) §2.2
3. **Opcional** si se quiere lib US-9 refactor en Cloud Functions (misma semántica que local):

```bash
npm run firebase:deploy:functions
```

### Tests de regresión útiles

```bash
npm run test:validaciones-plan-turno
npm run test:blindaje-gso-dry-run
```

---

## 4. Punto de continuación (elegir una línea de trabajo)

| Prioridad | Línea | Referencia |
|-----------|-------|------------|
| **P0 ops** | Remediación planes inventariados (9 ALTA primero, luego 126 MEDIA) | `PLAN_VUELO_US17` · acta [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md) |
| **P1 código** | US-3 escenario A (badge ⚠️ teoría vs licencia) | `PENDIENTES_IMPLEMENTACION_V2.md` §2.2 |
| **P1 código** | US-14 completo (acciones acta ante ⚠️ residual) | `DiaGrillaDetalleModal.jsx` |
| **Proceso** | QA formal Multi-HLG §4.2 · tags/release épica F-UX si aplica | `PLAN_GRILLA_MULTI_HLG_V2.md` |
| **RFC** | Plan paralelo ya cerrado F0–5; opcional FUX-OPT-5 divergencia plan vs grilla | `RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md` |

**Orden sugerido en backlog:** remediación US-17 (RRHH) en paralelo con **US-3 A + US-14** en código cuando retome desarrollo.

---

## 5. Documentos tocados / SSoT

| Archivo | Rol |
|---------|-----|
| [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md) | Diseño + severidad + guía RRHH |
| [`PR_US17_BODY.md`](./PR_US17_BODY.md) | Cuerpo PR #3 (histórico) |
| [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) | Backlog maestro |
| [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) | **Índice RETOMAR AQUÍ** |
| [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md) | US-9 / remediación acta |
| `scripts/audit-planes-habilitados-huecos-us17.mjs` | Herramienta inventario |

---

## 6. Commits relevantes (US-17 en master)

| Commit | Contenido |
|--------|-----------|
| `352692b` | Merge PR #3 |
| `dc25366` | Severidad ALTA/MEDIA + documentación remediación |
| `0ff71b8` | Script audit US-17 |
| (rama) | Lib `listarHuecosTurnoEnAgentes` + tests |

**Última actualización documental:** 2026-06-05 — pausa post-cierre inventario. **Cierre ops:** 2026-06-06 → [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md).
