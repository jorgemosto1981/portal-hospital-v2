# Plan de vuelo — US-17 inventario planes `HABILITADO` con huecos

**Estado:** diseño cerrado (2026-06-05) · **Prerequisito:** blindaje US-9 en prod (`v2.6.1-blindaje-gso`)

## Objetivo

Inventariar planes mensuales **operativos** ya habilitados que violarían la regla US-9 (`laborable`/`guardia` sin `turno_id` válido), para remediación RRHH y cierre acta junio 2026.

## Alcance de la query

| Incluir | Excluir |
|---------|---------|
| `estado == "HABILITADO"` | `eliminado === true` |
| `tipo_plan == "mensual"` | `plan_rol === "incorporacion"` (`plt_inc`) en pasada 1 |
| Documento en `planes_turno_servicio` | Perpetuos, borradores, `MERGEADO` (salvo caso puntual) |

**Fuente de verdad del hueco:** `agentes[].dias` en el documento del plan (misma regla que `assertPlanSinHuecosTurno` / `listarHuecosTurnoEnAgentes`).

**No cubre en v1:** cruce plan ↔ `vis_*` (ver `audit-fase4-6-plan-habilitado.mjs` si hace falta).

## Implementación (3 pasos)

### 1. Lib — `validacionesPlanTurno.js` ✅

- `listarHuecosTurnoEnAgentes(agentes)` → `{ persona_id, ymd, tipo_dia }[]`
- Tests en `functions/test/validacionesPlanTurno.test.js` (mismo criterio que US-9).

### 2. CLI — `scripts/audit-planes-habilitados-huecos-us17.mjs` ✅

- Patrón: `load-env-v2.mjs` + `firebase-admin` (como otros `scripts/audit-*.mjs`).
- Flags: `--json`, `--out=<path>`, `--grupo=`, `--periodo=`, `--max-plans=N`.
- Salida por plan: `plan_id`, `grupo_id`, `periodo`, `huecos_count`, `huecos[]`.
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
- [x] Script ejecutado contra prod (2026-06-05): 5 analizados, 4 con huecos, 135 celdas
- [x] Reporte local `reports/us17-2026-06-05.json` (gitignored)
- [x] Trazabilidad PR [#3](https://github.com/jorgemosto1981/portal-hospital-v2/pull/3) + `PR_US17_BODY.md`

## Siguiente épica (después de remediación)

US-3 escenario A + US-14 completo (⚠️ licencia vs teoría vigente).
