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
- (previos plantel) `obtenerPlantelPorGdt`, `listarArbolGdtPlantel`

## UI

- Jefe plantel: `/portal/jefe/plantel` → botón **Pase** (interno o externo)
- RRHH bandeja: `/portal/rrhh/pases-gdt` → Aprobar / Rechazar

## Próximo átomo al retomar

1. **Toma de conocimiento (TC):** `tomarConocimientoPaseGdtRrhh` / `tomarConocimientoPaseGdtJefe`, **o**
2. Release a producción según política.

## En la otra PC

```bash
git fetch origin
git checkout develop
git pull origin develop
```

App local en modo `v2-dev` → proyecto `portal-hospital-v2-dev`.
