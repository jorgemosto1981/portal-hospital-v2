# Handoff — Pases GDT Fase 2 (save point 2026-07-24)

**Rama:** `master` = `develop` = `origin/*` · **HEAD:** `21249e3`  
**Remoto:** sincronizado  
**Entorno −dev:** `portal-hospital-v2-dev`  
**Entorno prod:** `portal-hospital-v2` · https://portal-hospital-v2.web.app  

## Release producción (2026-07-30)

| Paso | Estado |
|------|--------|
| Merge `develop` → `master` (FF 11 commits) | ✅ `22a4810..21249e3` |
| Push `origin/master` | ✅ |
| Functions plantel/pases/TC (selectivo) | ✅ create/update southamerica-east1 |
| IAM `roles/run.invoker` allUsers (11 servicios) | ✅ Failed: 0 |
| Hosting | ✅ https://portal-hospital-v2.web.app |

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
4. ~~Histórico TC + paginación/orden~~ ✅
5. ~~Release prod (`master` + functions + hosting + IAM)~~ ✅ 2026-07-30
6. Smoke UAT en prod (plantel / pases / TC) con actores piloto
7. Restaurar stash local `wip: ruido ajeno pre-release TC` si hace falta seguir ticketera

## En la otra PC

```bash
git fetch origin
git checkout develop
git pull origin develop
```

App local en modo `v2-dev` → proyecto `portal-hospital-v2-dev`.
