# Handoff — Pases GDT Fase 2 (save point 2026-07-24)

**Rama:** `develop` · **HEAD esperado:** `1c3186e` (o posterior si hay commits de handoff)  
**Remoto:** `origin/develop`  
**Entorno:** `portal-hospital-v2-dev` (`portal-hospital-v2-dev.web.app`)

## Commits clave (átomos)

| Commit | Contenido |
|--------|-----------|
| `84d5480` | UI modal pase interno, anti auto-pase, seed sub-GDT |
| `2ce4a7d` | `ejecutarPaseInternoGdt` (tx HLg + `sol_pases_gdt`) |
| `19f39a3` | `solicitarPaseExternoGdt` + modal interno/externo |
| `1c3186e` | Bandeja RRHH + `listarPasesGdtPendientesRrhh` / `aprobarPaseGdt` / `rechazarPaseGdt` |

## Desplegado en `-dev` (southamerica-east1 + invoker)

- `ejecutarPaseInternoGdt`, `solicitarPaseExternoGdt`
- `listarPasesGdtPendientesRrhh`, `aprobarPaseGdt`, `rechazarPaseGdt`
- `tomarConocimientoPaseGdtRrhh`, `tomarConocimientoPaseGdtJefe` ✅ create 2026-07-30 + `roles/run.invoker`
- `listarPasesGdtPendientesTcRrhh`, `listarPasesGdtPendientesTcJefe` ✅ create 2026-07-30 + invoker
- (previos plantel) `obtenerPlantelPorGdt`, `listarArbolGdtPlantel`
- Re-deploy 2026-07-30: `ejecutarPaseInternoGdt` / `aprobarPaseGdt` (jefes pendientes + acuse RRHH en aprobar)

## UI

- Jefe plantel: `/portal/jefe/plantel` → botón **Pase** (interno o externo)
- RRHH bandeja: `/portal/rrhh/pases-gdt` → **A resolver** / **Tomar conocimiento** / **Ya se tomó conocimiento** (paginación 10 + orden)
- Jefe TC: `/portal/jefe/pases-gdt-tc` → **Pendientes** / **Ya se tomó conocimiento** (paginación 10 + orden)

## Próximo átomo al retomar

1. ~~**Toma de conocimiento (TC):** cores + callables~~ ✅
2. ~~Deploy `-dev` + invoker IAM~~ ✅
3. ~~**UI bandejas TC**~~ ✅
4. ~~Histórico TC + paginación/orden~~ ✅ (2026-07-30)
5. Smoke visual histórico + commit atómico Fase 2 TC
6. Release a producción según política.

## En la otra PC

```bash
git fetch origin
git checkout develop
git pull origin develop
```

App local en modo `v2-dev` → proyecto `portal-hospital-v2-dev`.
