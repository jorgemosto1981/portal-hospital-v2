# Handoff — Pausa 2026-06-17 (RFC filas celda · motor cobertura · presentacion_compuesto)

> **Fecha pausa:** 2026-06-17  
> **Rama:** `feature/grilla-fase1-colision`  
> **Tag documental:** `v2.8.0-rfc-cumplimiento-compuesto-filas-celda` (aprobación RFC; motor + presentación en commits posteriores)  
> **Prod:** https://portal-hospital-v2.web.app (último deploy functions+hosting previo a esta pausa; **re-deploy** tras pull en otra PC si hace falta)  
> **RETOMAR:** **Fase 3 UI** — grilla + modal leyendo `presentacion_compuesto.filas[]` (ver §4).

---

## 1. Punto de continuación (copiar al abrir Agent)

```
Rama feature/grilla-fase1-colision (git pull). Épica RFC filas celda turno compuesto:
motor cobertura 50% y presentacion_compuesto en vis_* ya implementados y testeados.
Siguiente: Fase 3 UI (GrillaMesEquipoTabla, DiaGrillaDetalleModal) — N filas teoría+fichada+badge
desde dias.DD.presentacion_compuesto; luego deploy functions + backfill piloto jun-26.
Handoff: docs/v2/HANDOFF_SESION_2026-06-17_PAUSA_PRESENTACION_COMPUESTO_FILAS_CELDA.md
RFC: docs/v2/RFC_CUMPLIMIENTO_TURNO_COMPUESTO_FILAS_CELDA.md
```

---

## 2. Estado de la épica (RFC)

| Fase | Descripción | Estado |
|------|-------------|--------|
| **0** | RFC aprobado + tag `v2.8.0-rfc-cumplimiento-compuesto-filas-celda` | ✅ |
| **1** | Motor: cobertura por intersección, umbral **≥50%**, disciplina sobre recorte en ventana | ✅ commit `e0d1b61` |
| **2** | `resolverPresentacionCompuestoCelda` + persistencia `vis_*.dias.{DD}.presentacion_compuesto` | ✅ commit `235bb9c` |
| **3** | UI grilla/modal: matriz N filas (teoría siempre en compuesto) | ⏸ **pendiente** |
| **Ops** | `npm run firebase:deploy:functions` + backfill junio piloto tras Fase 3 o en paralelo | ⏸ |

---

## 3. Commits en remoto (desde tag / pausa anterior)

| Commit | Mensaje |
|--------|---------|
| `c9e4330` | feat(grilla): Fase F+ piloto, empareje M+T+N y RFC filas compuesto |
| `e0d1b61` | feat(cumplimiento): cobertura 50% por segmento en turno compuesto |
| `235bb9c` | feat(cumplimiento): presentacion_compuesto materializada en vis |

**Base previa en rama:** `e022052` (Fase F + QA teoría/real).

---

## 4. Qué hacer al retomar (orden sugerido)

1. **Otra PC:** `git fetch && git checkout feature/grilla-fase1-colision && git pull`
2. **Tests:**  
   `node --test functions/test/calcularDeltasCumplimiento.test.js`  
   `node --test functions/test/resolverPresentacionCompuestoCelda.test.js`
3. **Fase 3 UI** (sin recalcular en cliente):
   - Leer `presentacion_compuesto.filas[]` en `GrillaMesEquipoTabla` (modo jefe + RRHH).
   - Apilar por fila: `teoria_label` + `fichada_label` + `badge_label`.
   - Modal `DiaGrillaDetalleModal`: misma fuente; refresh tras ABM.
   - Opcional: fusionar lectura en `visCeldaFusionLectura.js` si hoy no expone el sub-objeto.
4. **Deploy + datos:**
   - `node scripts/sync-shared-to-functions.mjs`
   - `npm run firebase:deploy:functions`
   - `npm run build:web && firebase deploy --project portal-hospital-v2 --only hosting`
   - Backfill celda piloto:  
     `node scripts/backfill_fase_f_validacion.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --persona=per_01KR3HD24AMJ6YX3N7B3GPAZJ4 --fecha=2026-06-16`  
     (o mes completo según script)
5. **QA manual:** matriz RFC §7 QA-C1…C7 · CHAPARRO días 13–16 · Sala Internación 1.

---

## 5. Archivos clave

| Área | Ruta |
|------|------|
| RFC | `docs/v2/RFC_CUMPLIMIENTO_TURNO_COMPUESTO_FILAS_CELDA.md` |
| Motor cobertura | `shared/utils/calcularDeltasCumplimiento.js` |
| Presentación | `shared/utils/resolverPresentacionCompuestoCelda.js` |
| Persistencia | `functions/modules/shared/validacionFichadaDiaPersistencia.js` |
| Tras fichada | `functions/modules/shared/analiticaCumplimientoTrasFichada.js` |
| Worker teoría | `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` |
| Tests | `functions/test/calcularDeltasCumplimiento.test.js`, `functions/test/resolverPresentacionCompuestoCelda.test.js` |
| Diagnóstico | `scripts/diag_celda_cumplimiento.mjs` |
| UI (tocar en Fase 3) | `web/src/features/grilla/GrillaMesEquipoTabla.jsx`, `DiaGrillaCelda.jsx`, `DiaGrillaDetalleModal.jsx`, `grillaTurnosVisual.js` |

---

## 6. Contrato `presentacion_compuesto` (resumen)

- Solo si **≥2 segmentos** en capa y `analitica.calculo_por_segmentos === true`.
- `filas[i]` alineada a `capa.segmentos[i]`: `teoria_label`, `fichada_label` (null si ausente), `estado_tramo`, `badge_label` / `badge_tipo`, `cobertura_minutos`, `carga_teorica_minutos`.
- `fichadas_reales` en Firestore **no se modifica**.

---

## 7. Piloto QA (referencia)

- **Grupo:** `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` (Sala Internación 1)  
- **Agente:** CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4`  
- **Turno:** M+T+N continuo 06:00→06:00  
- Casos automatizados: QA-C1 (día 13, 24h), QA-C4 (día 16 ABM M+N), QA-C5 (06:00–18:30 sintético)

---

## 8. Comandos rápidos

```bash
git fetch origin
git checkout feature/grilla-fase1-colision
git pull origin feature/grilla-fase1-colision
npm install && npm install --prefix web

node scripts/sync-shared-to-functions.mjs
node --test functions/test/calcularDeltasCumplimiento.test.js
node --test functions/test/resolverPresentacionCompuestoCelda.test.js
```

---

## 9. Contexto sesión anterior

- QA día a día y fixes ABM/empareje: [`HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md`](./HANDOFF_SESION_2026-06-16_PAUSA_QA_FICHADAS_TEORIA_REAL.md)  
- Matriz escenarios: [`MATRIZ_FICHADA_TEORIA_REAL_V2.md`](./MATRIZ_FICHADA_TEORIA_REAL_V2.md)
