## Summary
- Expone `listarHuecosTurnoEnAgentes` en `validacionesPlanTurno.js` (mismo criterio que US-9) y refactoriza `assertPlanSinHuecosTurno` para usar el listado.
- Añade script offline `scripts/audit-planes-habilitados-huecos-us17.mjs` y `npm run audit:us17-planes-huecos` (solo lectura Firestore).
- **Severidad RRHH en el JSON:** cada hueco US-9 se cruza con `vis_*` → `ALTA` (sin jornada materializada) vs `MEDIA` (deuda de persistencia: se ve turno en GSO, falta `turno_id` en plan). **US-9 no se relaja.**
- Documentación: `PLAN_VUELO_US17_INVENTARIO_PLANES.md` (contrato de salida + guía remediación) y SSoT en `PENDIENTES_IMPLEMENTACION_V2.md`.

## Contrato de salida (auditoría)

| Nivel | Criterio | Para RRHH |
|-------|----------|-----------|
| Hueco US-9 | `laborable`/`guardia` sin `turno_id` en el plan | Siempre debe corregirse antes de considerar el plan “sano” |
| **MEDIA** | Hueco US-9 + jornada en `vis_*` (`rda_*`) | **Anclar** lo ya visible: editor → persistir turno → guardar (mantenimiento de datos) |
| **ALTA** | Hueco US-9 + sin jornada en `vis_*` | **Planificar:** asignar turno o franco explícito |

Campos en JSON: `severidad`, `tiene_materializacion`, totales `total_huecos_severidad_alta` / `_media`, bloque `clasificacion_rrhh`. Planes sin `agentes[]`: `severidad_plan: ALTA`, `anomalia_estructural: sin_agentes`. Detalle: [`PLAN_VUELO_US17_INVENTARIO_PLANES.md`](./PLAN_VUELO_US17_INVENTARIO_PLANES.md).

## Inventario prod (2026-06-05)

Ejecutado con credenciales de audit; reportes locales en `reports/` (no versionados).

| Métrica | Valor |
|---------|------:|
| Planes analizados (US-17) | 5 |
| Planes con huecos | 4 |
| Celdas hueco US-9 (total) | 135 |
| Severidad **ALTA** (urgencia planificación) | **9** |
| Severidad **MEDIA** (persistencia volátil) | **126** |
| Planes sin agentes | 0 |

**Expectativa de remediación:** objetivo `0` en los tres contadores (US-9 total, ALTA, MEDIA). Priorizar las **9 ALTA**; las **126 MEDIA** son volumen de confirmación en editor, no redefinición de jornada desde cero.

## Test plan
- [x] `npm run test:validaciones-plan-turno` (7/7)
- [x] `npm run audit:us17-planes-huecos -- --json --out=reports/us17-2026-06-05.json`
- [x] Audit con severidad: `--json --out=reports/us17-2026-06-05-severidad.json` (9 ALTA / 126 MEDIA)
- [ ] Tras merge: deploy functions opcional si se quiere la lib refactor en prod (el script de audit usa el módulo local).
