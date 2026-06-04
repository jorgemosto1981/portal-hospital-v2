# Handoff — Sesión 2026-06-04 · F-UX.3 batch v2 + documental + GSO acta

**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**HEAD remoto (tras push):** ver `git log -1` en origin  
**Producción:** https://portal-hospital-v2.web.app · Functions desplegadas 2026-06-04

---

## 1. Qué se cerró en esta sesión

| Tema | Resultado |
|------|-----------|
| **A-BATCH / B-BATCH-1 / C-BATCH** | Implementado `17a04bf` · deploy functions · QA batch **4 aplicadas** |
| **Smokes** | `test:batch-asistencia-normalize` 9/9 · `smoke:outbox-batch` · `smoke:outbox-batch-v2` (A/B/C) |
| **Hosting** | Build + deploy preview §12 + mensajes batch + token origen B |
| **QA usuario** | Grilla prod validada post-batch |
| **Registro documental F-UX** | [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) |
| **GSO (solo docs)** | Acta reconciliación junio Sala + análisis app vs criterios — **sin código** |

**Épica F-UX.3:** implementación **terminada** en rama. Gate: **PR → `master`** ([`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md)).

---

## 2. Commits relevantes (orden reciente)

| Commit | Contenido |
|--------|-----------|
| `17a04bf` | A-BATCH, B-BATCH-1, worker v2, smokes, UI batch |
| `73d58cd` | Visual grilla §12 + consulta ligera |
| `a49e9f1` | C-BATCH |
| `97409b4` … `486d81b` | Release notes, registro maestro, índices, handoff |

Consultar lista completa: [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) §5.

---

## 3. Arranque en otra PC

```bash
git fetch origin
git checkout feat/epic-multi-hlg-fase1-execution
git pull origin feat/epic-multi-hlg-fase1-execution
```

1. Copiar **`.env.v2.local`** en la raíz (no está en git).
2. `npm install` y `cd web && npm install` (si hace falta).
3. Leer en orden:
   - [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) (bloque superior)
   - [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md)
   - Este handoff
4. Dev local: `npm run dev:web` → http://localhost:5173
5. Callables prod: ya desplegados; no hace falta redeploy salvo cambios nuevos en `functions/`.

### Comandos útiles

```bash
npm run test:batch-asistencia-normalize
npm run smoke:outbox-batch-v2 -- --solo=abc   # requiere .env.v2.local + GAC
npm run firebase:deploy:functions
npm run build:web
npx firebase deploy --project portal-hospital-v2 --only hosting
```

---

## 4. Próximo paso sugerido

1. **Merge PR** a `master` (plantilla en [`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md)).
2. Tag `v2.4.0-fux-gestion-turno` post-merge.
3. **Épica GSO conflictos** (opcional, paralelo): partir de [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md) y [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md) — US-1, US-9, US-16 P0.

---

## 5. Documentos nuevos / actualizados esta sesión

| Archivo | Rol |
|---------|-----|
| [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) | Inventario maestro F-UX.3 |
| [`RELEASE_NOTES_FUX_GESTION_TURNO_V3.md`](./RELEASE_NOTES_FUX_GESTION_TURNO_V3.md) | Release |
| [`PR_EPIC_MULTI_HLG_FUX.md`](./PR_EPIC_MULTI_HLG_FUX.md) | PR |
| [`scripts/smoke-outbox-batch-v2-dev.mjs`](../scripts/smoke-outbox-batch-v2-dev.mjs) | Smoke A/B/C |
| [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md) | Acta RRHH GSO (docs) |
| [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md) | Brechas US vs código |
| [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md) | Ops materializar al abrir |

---

**Última actualización:** 2026-06-04 — sesión guardada para continuidad multi-PC.
