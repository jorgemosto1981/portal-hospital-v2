# Handoff — Pausa 2026-06-18 (batch inmediato · motor unificado · sanación · nodos grilla)

> **Fecha:** 2026-06-18  
> **Rama:** `master` (cambios locales pendientes de push al cierre de esta sesión)  
> **Piloto:** Sala Internación 1 `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` · jun-2026  
> **Agente QA traslado:** CAMPOS JAQUELINA `per_01KR3GZX9TB33NHTE2QD5ZP13V` · DNI 35100564  
> **Estado:** **PAUSA** — código listo en repo; **último deploy functions interrumpido** (hosting sí desplegado en sesión previa del hilo).

---

## 1. Punto de continuación (obligatorio — próxima sesión)

```
DESAPARECEN FICHADAS REALES DE LA VISUAL DE GRILLA OPERATIVA, VER EXTENSION DE ARCHIVOS DE FUNCIONES DE GRILLA OPERATIVA, REVISAR PLAN Y CARGA INSTANTANEA DE CELDAS SIN SALIR DE GRILLA
```

**Traducción técnica:**

1. **Bug UX:** tras batch inmediato / parches / sanación, las **fichadas reales** dejan de verse en la grilla operativa (revisar qué campo de `vis_*` o `presentacion_compuesto` / capa fichada deja de propagarse al store de nodos).
2. **Extender auditoría** a callables y workers de grilla: `listarVistaGrillaMesPorGrupo`, `obtenerVistaGrillaMesAgente`, `guardarCapaFichadaDia`, `materializarTurnoTeoricoDia`, `sanearMaterializacionDiaSiNecesario`, `aplicarBatchAsistencia`, `grillaMesAgenteCore.js`, `visCeldaFusionLectura.js`, `resolverPresentacionCompuestoCelda.js`.
3. **Plan en curso:** [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) — Fase **C** (patch post-fichada sin `vista.cargar` completo) y verificar que Fase **A3** no pise `fichadas_reales` al parchear solo teoría.
4. **Carga instantánea de celdas** sin cerrar el modal de mes: completar puente `useGrillaMesNodos` ↔ `GrillaMesLicenciasPanel` / `GrillaDiaCelda` para fichadas + teoría.

**Después de arreglar fichadas en UI:**

```bash
git pull origin master
npm run firebase:deploy:functions   # incluye sanear + fixes Jaqueline
# Re-validar Jaqueline 11–12 en hosting prod
node scripts/verificar-jaqueline-dias-11-12-jun26.mjs
```

---

## 2. Plan activo

| Documento | Contenido |
|-----------|-----------|
| [`PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md`](./PLAN_REACTIVIDAD_GRILLA_NODOS_V2.md) | Reactividad por nodo; reemplazo UX outbox → batch inmediato + store |
| [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) | Histórico outbox (cola local **retirada** en UI actual) |

---

## 3. Realizado en esta sesión (resumen)

### Cliente (web)

- Eliminación flujo **outbox local** en grilla mes: `aplicarCambioInmediato` → `aplicarBatchAsistencia` + toasts.
- Modales A/B/C async con “Aplicar cambio”.
- **Store nodos:** `grillaMesNodoStore`, `useGrillaMesNodos`, parches `grillaMesNodosBatchParches`, `GrillaDiaCelda` memo.
- **Auto-sanación modal día:** `useAutoSanacionDiaGrillaModal` + `grillaSanacionMaterializacionService` → callable `sanearMaterializacionDiaSiNecesario`.
- Banner “Actualizar ahora” + coherencia licencias (`teoria_refs` → servidor).
- Fix `DiaGrillaDetalleModal` (imports gestión turno); fix orden `dk` en refresh modal (`GrillaMesLicenciasPanel`).

### Servidor (functions)

- **`materializarTurnoMesBatch`** solo delega en **`materializarTurnoTeoricoDia`** (un solo motor).
- Traslado propio v2: quita segmentos con alias N/cfg, pierna origen por `fecha_origen`, franco en origen.
- **`computarCapaTeoricaSliceDia`** + **`evaluarCoherenciaMaterializacionDia`** + firma [`grillaMaterializacionFirmaDia.js`](../shared/utils/grillaMaterializacionFirmaDia.js).
- Callable **`sanearMaterializacionDiaSiNecesario`** (oráculo `coherencia` + `vis_dia.coherencia_teoria`).
- Fixes materialización Jaqueline:
  - No incorporar **destino** si **origen franco** en el mismo día.
  - **`franco_en_origen`** solo si traslado **inter-día** (`fecha_origen !== fecha_destino`).
  - Ignorar piernas origen **intra-día** (`fo === fd`) en clasificación.
  - Fix **`encolarCapaTeoricaPorGrupo`** (`persona_id` vs `pid`).

### Deploy (sesión)

| Target | Estado |
|--------|--------|
| Hosting `portal-hospital-v2.web.app` | ✅ build + deploy (bundle con auto-sanación UI) |
| Functions `sanearMaterializacionDiaSiNecesario` | ✅ creado en deploy intermedio |
| Functions fixes Jaqueline + `pid` | ⚠️ **en repo local**; redeploy **interrumpido** — repetir |

### QA datos (script admin, motor local post-fix)

```bash
node scripts/verificar-jaqueline-dias-11-12-jun26.mjs
# PASS: día 11 franco, día 12 rda_turno_id T+N
```

Causa raíz día 11 con N fantasma: override **destino 10→11** en doc del 11 re-incorporaba turno tras marcar franco por traslado **11→12**; overrides **12→12** espurios disparaban franco en el 12.

### Tests añadidos

- `functions/test/reemplazoTrasladoMaterializacion.test.js`
- `functions/test/grillaMaterializacionFirmaDia.test.js`
- Varios tests store/nodos en `web/src/features/grilla/*`

---

## 4. Dónde estamos

| Área | Estado |
|------|--------|
| Motor teoría unificado | ✅ código |
| Batch inmediato sin outbox | ✅ código |
| Sanación por firma + modal | ✅ código; prod requiere redeploy functions |
| Jaqueline 11/12 en Firestore (script) | ✅ PASS con motor local |
| **Fichadas visibles en grilla tras mutación** | ❌ **pendiente** (punto de continuación) |
| Fase B presentación solo materializada | ⏳ |
| Fase C patch cache sin reload mes | ⏳ |
| MDC `teoria_ref` solo servidor | ⏳ |
| Lineamientos Decreto 1919 (doc) | ⏳ paralelo |

---

## 5. Qué falta (priorizado)

1. **Fichadas reales en grilla operativa** (continuación literal arriba).
2. Redeploy **functions** y smoke hosting Jaqueline 11–12.
3. Fase **C** del plan nodos: parchear `fichadas_reales` / analítica en store sin invalidar todo el mes.
4. Fase **B**: celda anclada a `presentacion_compuesto` materializado.
5. Higiene overrides intra-día `fo=fd` en datos (opcional; motor ya los ignora).
6. Épica documental **1919** cuando el piloto grilla esté verde.

---

## 6. Comandos útiles

```bash
node scripts/sync-shared-to-functions.mjs
node --test functions/test/reemplazoTrasladoMaterializacion.test.js functions/test/grillaMaterializacionFirmaDia.test.js
npm run build:web
npm run firebase:deploy:functions
firebase deploy --project portal-hospital-v2 --only hosting
```

**Hosting:** https://portal-hospital-v2.web.app

---

## 7. Política acordada

**No compatibilidad hacia atrás** en materialización: no importa si no se borran overrides viejos manualmente; **hacia adelante** el motor y la UI deben comportarse bien con traslado v2 y sanación.
