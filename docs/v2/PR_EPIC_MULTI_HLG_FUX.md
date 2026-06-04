# Pull request — Épica Multi-HLG + F3 + F-UX.3

Usar al abrir el PR en GitHub (base: **master**, compare: **feat/epic-multi-hlg-fase1-execution**).

## Title

```
feat(epic): Multi-HLG, F3 turnos compuestos, F-UX.3 gestión turno A/B/C y batch v2
```

## Body

```markdown
## Summary

- **Multi-HLG / GSO / cierre período:** grilla por burbuja, purge HLg, callables cierre/reapertura.
- **F3:** capa teórica segmentada, fichadas esperadas (F:n), régimen compuesto `+`, piloto Sala.
- **F-UX.3:** gestión turno del día — intercambio (A), traslado propio (B), adicional (C); outbox por tarjeta; preview visual en grilla; batch v2 (A-BATCH, B-BATCH-1, C-BATCH) desplegado y validado en prod.

## Producción (ya desplegado desde rama)

- Functions: `aplicarBatchAsistencia`, `registrarConsultaGestionTurnoGrilla`, materialización día.
- Hosting: https://portal-hospital-v2.web.app (build 2026-06-04).

## QA realizado

- [x] Batch manual: 4 operaciones aplicadas desde grilla
- [x] Validación visual grilla post-batch (usuario)
- [x] `npm run test:batch-asistencia-normalize` (9/9)
- [x] `npm run smoke:outbox-batch` / `smoke:outbox-batch-v2` (entorno dev con credenciales)

## Test plan post-merge

- [ ] Smoke §4.2 Multi-HLG (muestra) en prod desde `master`
- [ ] Grilla operativa: un flujo A, B y C en período abierto
- [ ] Sin regresión cierre período / GSO solo lectura M-1
- [ ] Tag `v2.4.0-fux-gestion-turno` (ver `RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`)

## Docs

- Handoff: `HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md`
- Release F-UX: `RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`
- Release F3: `RELEASE_NOTES_EPIC_TURNOS_COMPUESTOS_F3_V2.md`
```

## Merge

Squash o merge commit según convención del repo. No incluir en el PR los archivos locales de sync `functions/modules/shared/*` si aparecen en otra rama.
