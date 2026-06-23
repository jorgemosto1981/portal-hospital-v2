# Handoff — Sesión 2026-06-23 (CVC · QA grilla reactiva · Flujo C)

> **RETOMAR AQUÍ:** **deploy functions + hosting** · **commit** a pedido · opcional re-QA **CHAPARRO d19** (Q2.4 histórico).  
> **Índice:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) · Plan: [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) · **CVC:** [`RFC_CICLO_VIS_CELDA_GRILLA_V2.md`](./RFC_CICLO_VIS_CELDA_GRILLA_V2.md)

**Piloto:** Sala Internación 1 `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · **2026-06**  
**Rama:** `master` (cambios **sin commit** — ver `git status`)  
**Prod:** https://portal-hospital-v2.web.app (deploy documentado **2026-06-19**; QA de esta sesión en **localhost** `npm run dev:web`)

---

## 1. QA manual — matriz sesión 23-jun

### Ciclo / checklist base

| ID | Caso | Resultado |
|----|------|-----------|
| Q1.1 | Ciclo batch / smoke reactivo | ✅ |
| Q1.3 | Aplicar cambio (ciclo inmediato) | ✅ |
| Q1.4 | Coherencia modal ↔ celda | ✅ |
| Q1.5 | Revertir piloto | ⏭ No (datos de prueba) |
| Q2.1 / Q2.2 / Q2.3 | Traslado B | ✅ |
| **Q2.4** | **CHAPARRO d19** — 3× traslado (inicio sesión) | ❌ **histórico** | Origen no en **F** tras 2.º movimiento; no re-ejecutado tras fixes CVC |
| Q4 | Intercambio LOKITO ↔ CHAPARRO **d8** (T ↔ N, 08/06) | ✅ OK | Teoría post-swap M+N / M+T; grilla sin F5 |
| Q3 | Cadena N/M CAMPOS (protocolo 3 pasos + d12 regresión) | ✅ **OK** 2026-06-23 |

---

## Protocolo Q3 — CAMPOS día 10 (cadena N → franco → M)

**Agente:** CAMPOS, JAQUELINA · `per_01KR3GZX9TB33NHTE2QD5ZP13V` · DNI 35100564  
**GDT / mes:** Sala Internación 1 · **2026-06**  
**Regresión:** tras paso 3 la celda **no** debe quedar en franco si el historial muestra incorporación **M** (fix supersession 19-jun + CVC).

### Precondición

- Conocer teórico **inicial** del **10/06** en modal (p. ej. **M+T** del plan).
- Si el día ya tiene gestiones viejas, valorar reset puntual o otro día limpio (el guion histórico es **10/06**).

### Pasos (tres lotes separados — aplicar cada uno y verificar grilla **sin F5**)

| # | Flujo | Acción | Esperado en **d10** tras el lote |
|---|--------|--------|----------------------------------|
| **1** | B — destino aditivo | **Incorporar N** en **10/06** (desde **09/06** u origen con N) | Teórico incluye **N** (p. ej. M+T+N o M+N según plan+incorporación) |
| **2** | B — traslado propio | **Trasladar N** del **10/06** → **09/06** (origen queda **franco**) | **d10 = F / franco** en grilla y modal |
| **3** | B — destino aditivo | **Incorporar M** en **10/06** (desde **09/06** u otro día con M) | **d10 = M** (o M+… según plan restante); **no franco** |

### Criterios **OK**

- Tras **cada** lote: celda **d10** y modal alineados (CVC); sin fantasmas de tramos ya trasladados.
- Tras **paso 3**: modal auditoría — turno teórico **M** (o compuesto con M), **no** “franco” con historial del 3.er lote visible.
- Historial del día lista los **3** cambios; el activo materializado es el del paso 3.

### Criterios **falla** (bug Q3)

- Paso 3 en historial pero celda/modal siguen **franco**.
- Origen **09/06** incoherente tras traslado de N (revisar par origen+destino).
- **Incorporar N** en día **plan franco** (p. ej. CAMPOS **d12**): historial OK pero modal sigue franco → flags `es_franco`/`tipo_día` obsoletos en `vis_*` (fix UI **2026-06-23**: `celdaVisIndicaFrancoOperativo` + `alinearFlagsTipoDiaAlTeoricoOperativo`).

### Referencia motor

`functions/test/overridesTurnoSupersession.test.js` — *«destino M revoca origen franco previo (cadena N luego M)»*.


| Agente | Día | Escenario | Resultado |
|--------|-----|-----------|-----------|
| LOKITO | **d19** → d18 | M, luego N, luego T hacia 18/06; origen franco al 3.er | ✅ Cada paso OK |
| LOKITO | **d12** (ref. sesión) | 2.º traslado dejaba T+N fantasma | ✅ Corregido con CVC + filtro teórico en grilla |

### Incorporación / destino con fichadas

| Agente | Día | Escenario | Resultado |
|--------|-----|-----------|-----------|
| LOKITO | **d6** | T incorporado desde **07/06** (aditivo) + recálculo fichadas destino | ✅ |
| CHAPARRO | **d16** | M+T+N; 3 marcas crudas desordenadas + fichada tarde T | ✅ Celda y modal coherentes; sin incumplimiento |

### M+T+N — reparto marcas (3 fichadas × 3 tramos)

| Agente | Día | Escenario | Resultado |
|--------|-----|-----------|-----------|
| LOKITO | **d16** | Marcas 05:45–13:55 · 21:40–04:10 · 15:00–17:00 (orden reloj ≠ M,T,N) | ✅ Tras `mapSegmentoMtnAIndiceFichada` |
| CHAPARRO | **d16** | Marcas 05:54–14:10 · 21:50–05:55 · 14:30–21:00 | ✅ |

### Flujo C (turno preasignado vs adicional)

| Ítem | Resultado |
|------|-----------|
| UI dos bloques en `ModalTurnoAdicional` | ✅ código local |
| Motor sin duplicar tramo preasignado | ✅ functions local · ⏳ **deploy** |

---

## 2. Entregables de código (acumulado 23-jun)

### Ciclo de visibilidad de celda (CVC)

| Pieza | Rol |
|-------|-----|
| [`RFC_CICLO_VIS_CELDA_GRILLA_V2.md`](./RFC_CICLO_VIS_CELDA_GRILLA_V2.md) | Documentación fases CVC-0…5 |
| `cicloVisCeldaGrilla.js` | `sincronizarCeldasVisGrilla`, `refsDesdeOpGrilla` |
| `GrillaMesLicenciasPanel.jsx` | `parchearCeldasTrasMutacion` → delega en CVC-4 |
| `grillaMesNodosBatchParches.js` | `resolverParchesVisTrasBatchExito`: fetch de todos los `paresCeldaDesdeOp` + merge con batch |

### Coherencia teórico ↔ presentación (traslados sucesivos)

| Pieza | Rol |
|-------|-----|
| `visCeldaFusionLectura.js` | `coherirCeldaVisTeoriaFranco`, `coherirPresentacionCompuestoAlTeoricoVis` |
| `mergeCeldaVisParche.js` | Coherencia tras cada parche |
| `grillaPresentacionCompuestoUi.js` | Filtro teórico en hot path grilla; **empareje M/T/N por franja horaria** (3×3 fichadas) |

### Flujo C — preasignado vs adicional

`ModalTurnoAdicional.jsx` · `grillaAdicionalPreview.js` · `coberturaParcialService.js` · `cambiosTurno.js` · `rdaTurnoTeoricoWorker.js` (ver commit previo en § histórico).

---

## 3. Próxima sesión (orden sugerido)

1. **Deploy** — functions + hosting (CVC + Flujo C + fixes franco parche).
2. **Commit** — cuando el equipo lo pida.
3. **Opcional** — CHAPARRO **d19** (Q2.4 histórico).

```bash
npm run dev:web
# node scripts/audit-grilla-fantasma-presente-jun26.mjs
```

---

## 4. Deuda conocida

- `grillaAdicionalPreview.test.js` — node:test vs Vitest (ruido local).
- Incumplimiento “sin fichada T” con marcas 15:00–17:00 en piso T: puede ser **motor** (cobertura parcial del tramo); UI ya muestra marcas en el piso correcto.
- Commit / push: solo cuando el operador lo pida.

---

## Changelog

| Fecha | Nota |
|-------|------|
| 2026-06-23 (mañana) | QA parcial; fallas d19/d16; Flujo C preasignado; primeros fixes franco/3×3 |
| 2026-06-23 (tarde) | CVC cerrado; QA verde LOKITO d19/d6/d16, CHAPARRO d16; empareje fichadas por franja M/T/N |
| 2026-06-23 | **Q4 OK** — intercambio LOKITO↔CHAPARRO d8 (T↔N, 08/06) |
| 2026-06-23 | Fix franco obsoleto en parche; CAMPOS **d12** incorporar N → **OK** |
| 2026-06-23 | **Q3 OK** — cadena N/M CAMPOS (protocolo + d12) |
