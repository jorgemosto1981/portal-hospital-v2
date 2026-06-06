# Plan de vuelo — US-17 inventario planes `HABILITADO` con huecos

**Estado:** **✅ CERRADO (código + ops)** — remediación RRHH completada 2026-06-06 · audit prod **0 huecos** · acta: [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md) · inventario inicial: [`HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md`](./HANDOFF_SESION_2026-06-05_PAUSA_US17_CIERRE.md)

## Objetivo

Inventariar planes mensuales **operativos** ya habilitados que violarían la regla US-9 (`laborable`/`guardia` sin `turno_id` válido), para remediación RRHH y cierre acta junio 2026.

## Alcance de la query

| Incluir | Excluir |
|---------|---------|
| `estado == "HABILITADO"` | `eliminado === true` |
| `tipo_plan == "mensual"` | `plan_rol === "incorporacion"` (`plt_inc`) en pasada 1 |
| Documento en `planes_turno_servicio` | Perpetuos, borradores, `MERGEADO` (salvo caso puntual) |

**Fuente de verdad del hueco (integridad US-9):** `agentes[].dias` en el documento del plan (misma regla que `assertPlanSinHuecosTurno` / `listarHuecosTurnoEnAgentes`). **No se relaja** ese criterio: un día con jornada visible en GSO pero sin `turno_id` en el plan sigue siendo deuda técnica hasta persistirlo.

**Cruce plan ↔ `vis_*` (solo informe RRHH):** el script etiqueta cada hueco US-9 con **severidad** según la vista materializada `vistas_grilla_mes_agente` (misma señal que la grilla: `rda_ingreso`, `rda_egreso` o `rda_turno_id`). La severidad **no** modifica US-9 ni el firewall de habilitación.

### Contrato de salida — severidad RRHH

| Campo / valor | Significado |
|---------------|-------------|
| Hueco US-9 | `tipo_dia` ∈ {`laborable`, `guardia`} y `turno_id` vacío o inválido en el **plan** |
| `severidad: MEDIA` | Hueco US-9 **y** la celda en `vis_*` **tiene jornada materializada** → asignación **volátil**: la grilla muestra turno, el plan no lo ancla |
| `severidad: ALTA` | Hueco US-9 **y** la celda en `vis_*` **no** tiene jornada → hueco operativo real (sin referencia materializada) |
| `tiene_materializacion` | `true` si aplica la condición de MEDIA (booleano por celda) |
| Totales | `total_huecos_severidad_alta`, `total_huecos_severidad_media`; por plan: `huecos_severidad_alta`, `huecos_severidad_media` |
| `clasificacion_rrhh` | Texto fijo en el JSON exportado (glosario para quien remedia) |
| `sin_agentes: true` | Plan sin filas en `agentes[]`: `severidad_plan: ALTA`, `anomalia_estructural: sin_agentes` (no hay huecos por celda; anomalía estructural total) |

**Matiz para la posteridad:** la severidad distingue **integridad de datos (plan)** de **discrepancia de visualización (GSO)**. Ignorar huecos MEDIA en el audit “porque se ve bien en pantalla” invalidaría el objetivo de US-9: si la materialización falla o se recalcula, esos días quedarían en blanco en el plan.

### Guía de acción RRHH (remediación)

**Meta:** `0` huecos US-9 (y por tanto `0` ALTA y `0` MEDIA). **Prioridad operativa:** atender primero **ALTA** (pocos, planificación incompleta) y luego **MEDIA** (mantenimiento de persistencia).

| Severidad | Qué implica | Acción típica |
|-----------|-------------|----------------|
| **ALTA** | Sin turno en plan ni jornada en `vis_*` | Reabrir plan según acta (RRHH → `EN_REVISION` si estaba habilitado) → **asignar turno o franco** explícito en el editor para cada celda listada → guardar → volver a habilitar (US-9 debe pasar) |
| **MEDIA** | Sin `turno_id` en plan pero **sí** horario en GSO/`vis_*` | Misma reapertura editable → en el editor **confirmar/persistir** el turno que ya corresponde (no “inventar” jornada desde cero) → **guardar** el plan para escribir `turno_id` → re-habilitar |

Tras remediación, re-ejecutar el audit y verificar que `total_huecos_celdas` y ambos contadores de severidad sean `0`.

## Implementación (3 pasos)

### 1. Lib — `validacionesPlanTurno.js` ✅

- `listarHuecosTurnoEnAgentes(agentes)` → `{ persona_id, ymd, tipo_dia }[]`
- Tests en `functions/test/validacionesPlanTurno.test.js` (mismo criterio que US-9).

### 2. CLI — `scripts/audit-planes-habilitados-huecos-us17.mjs` ✅

- Patrón: `load-env-v2.mjs` + `firebase-admin` (como otros `scripts/audit-*.mjs`).
- Flags: `--json`, `--out=<path>`, `--grupo=`, `--periodo=`, `--max-plans=N`.
- Salida por plan: `plan_id`, `grupo_id`, `periodo`, `huecos_count`, `huecos_severidad_alta`, `huecos_severidad_media`, `huecos[]` (cada ítem: `persona_id`, `ymd`, `tipo_dia`, `severidad`, `tiene_materializacion`).
- Cruce `vis_*` por persona/grupo/mes (`buildVisDocumentId` + colección `vistas_grilla_mes_agente`).
- Solo lectura (sin `--apply`).

### 3. Ejecución ops

```bash
npm run audit:us17-planes-huecos
# o con acotación:
node scripts/audit-planes-habilitados-huecos-us17.mjs --periodo=2026-06 --json --out=reports/us17-2026-06-05.json
```

Credenciales: `GOOGLE_APPLICATION_CREDENTIALS` en `.env.v2.local`.

## Done (sesión US-17)

- [x] Lib + tests en verde
- [x] Script CLI (`npm run audit:us17-planes-huecos`)
- [x] Script ejecutado contra prod (2026-06-05): 5 analizados, 4 con huecos, **135** celdas US-9 → **9 ALTA** + **126 MEDIA** (severidad RRHH)
- [x] Reporte local `reports/us17-*.json` (gitignored; incluir severidad en corridas post-merge)
- [x] Trazabilidad PR [#3](https://github.com/jorgemosto1981/portal-hospital-v2/pull/3) + `PR_US17_BODY.md`

## Done (remediación 2026-06-06)

- [x] **R0** `planEnriquecimientoDias.js` — inferencia fijo/rotativo, pool cruzado, ids ≤32
- [x] Enriquecimiento en **guardar** y **aprobar** (`planesTurnoServicio.js`)
- [x] **R2** `scripts/reimpact-plan-mensual-r2.mjs` aplicado sobre planes afectados
- [x] UI: editor + `PlanTurnoServicioPage` (Enviar/Editar plan principal BORRADOR; mes rechazado)
- [x] Tests `planEnriquecimientoDias.test.js` — 10/10
- [x] Re-audit prod: **5 planes HABILITADO, 0 huecos** (`reports/us17-2026-06-06-cierre.json`)
- [x] Acta cierre: [`HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md`](./HANDOFF_SESION_2026-06-06_CIERRE_US17_REMEDIACION.md)

## Siguiente épica (post US-17)

US-3 escenario A + US-14 completo (⚠️ licencia vs teoría vigente) — ver [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md) §2.2.
