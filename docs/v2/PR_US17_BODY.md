## Summary
- Expone `listarHuecosTurnoEnAgentes` en `validacionesPlanTurno.js` (mismo criterio que US-9) y refactoriza `assertPlanSinHuecosTurno` para usar el listado.
- Añade script offline `scripts/audit-planes-habilitados-huecos-us17.mjs` y `npm run audit:us17-planes-huecos` (solo lectura Firestore).
- Documentación: `PLAN_VUELO_US17_INVENTARIO_PLANES.md` y actualización del SSoT en `PENDIENTES_IMPLEMENTACION_V2.md`.

## Inventario prod (2026-06-05)
Ejecutado con credenciales de audit; reporte local `reports/us17-2026-06-05.json` (no versionado).
- Planes analizados (US-17): **5**
- Planes con huecos o sin agentes: **4**
- Total celdas hueco: **135**
- Planes sin agentes: **0**

## Test plan
- [x] `npm run test:validaciones-plan-turno` (7/7)
- [x] `npm run audit:us17-planes-huecos -- --json --out=reports/us17-2026-06-05.json`
- [ ] Tras merge: deploy functions opcional si se quiere la lib refactor en prod (el script de audit usa el módulo local).
