# Release notes — F-UX.3 Gestión turno del día (A/B/C) + batch v2

**Fecha cierre:** 2026-06-04  
**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**RFC:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) · visual [`RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md`](./RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md)  
**Tag sugerido:** `v2.4.0-fux-gestion-turno` (tras merge a `master`)

---

## Resumen

Flujos **A** (intercambio de guardia bilateral), **B** (traslado propio origen→destino) y **C** (turno adicional con snapshot `estado_previo`) desde la grilla operativa: wizard, modales, **outbox por tarjeta grupo×mes**, preview en celdas y **batch atómico** en Cloud Functions (A-BATCH, B-BATCH-1, C-BATCH).

**Producción:** functions + hosting desplegados 2026-06-04 · QA grilla validado por usuario.

---

## Entregables cerrados

| Área | Commits / referencia | Validación |
|------|----------------------|------------|
| Spec + RFC payloads | `eaf5e92`, `613b766`, `c3e0294` | Spec §9 cerrada |
| Frontend A/B/C + outbox | `19b411e`, `7be370b` | QA navegador |
| Visual grilla §12 | `73d58cd` | Preview ámbar, modal historial, consulta ligera |
| C-BATCH | `a49e9f1` | `test:batch-asistencia-normalize` |
| A-BATCH + B-BATCH-1 | `17a04bf` | Worker cross-fecha + smokes v2 |
| Handoff / pendientes | `425b869`, `61d8005` | QA 4 aplicadas + grilla prod |

---

## Backend (batch)

| Flujo | Comportamiento |
|-------|----------------|
| **A v2** | Dos fechas, dos tokens `vis_*`, mismo override `schema_version: 2` en ambos `asi_*` |
| **B v2** | Una op → dos ítems (origen/destino), `reemplazo_traslado_v2`, materialización por día |
| **C v2** | `estado_previo` en override; rechazo horas en alta jefe |
| Legacy MVP | Cobertura mismo día sin cambio |

Callables: `aplicarBatchAsistencia`, `registrarConsultaGestionTurnoGrilla`, `materializarTurnoTeoricoDia`.

---

## Smokes / tests

```bash
npm run test:batch-asistencia-normalize   # 9/9
npm run smoke:outbox-batch                # legacy + rollback CONC
npm run smoke:outbox-batch-v2             # --solo=a|b|c|abc (dev + .env.v2.local)
```

---

## UI (hosting)

- Mensajes batch (`BATCH-*`, `ASI-CONC-001`, GSO, período cerrado).
- Traslado B: `expectedVersionTokenOrigen` + destino en wire batch.
- Banner outbox por grupo×mes; labels A/B/C v2.

---

## Cierre épica (único paso humano)

1. **PR** `feat/epic-multi-hlg-fase1-execution` → `master`  
   Compare: https://github.com/jorgemosto1981/portal-hospital-v2/compare/master...feat/epic-multi-hlg-fase1-execution  
   Plantilla: [`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md)

2. Tras merge:

```bash
git checkout master && git pull
git tag -a v2.4.0-fux-gestion-turno -m "F-UX.3 gestión turno A/B/C + batch v2"
git push origin v2.4.0-fux-gestion-turno
```

---

## Fuera de alcance (post-merge)

- Horas RRHH post-C (trámite fuera de celda).
- A-BATCH validación horas espejo A2 en servidor (opcional).
- PR3 turno mensual fase 2 (rama separada).
