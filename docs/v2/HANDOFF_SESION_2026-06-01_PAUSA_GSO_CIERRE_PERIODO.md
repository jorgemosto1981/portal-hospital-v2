# Handoff — Pausa GSO RRHH · Cierre/reapertura período y tarjetas (2026-06-01)

> **Continuidad:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) · [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md)  
> **Prod:** https://portal-hospital-v2.web.app · **Ruta:** `/portal/rrhh/grilla-operativa`

---

## Resumen sesión (validado OK en prod)

Implementación y despliegue de **cierre / reapertura de liquidación por sector**, **estado visual en tarjetas mensuales**, correcciones de **carga infinita** y **Portería vacía** (comportamiento esperado + UX clara).

| Área | Estado |
|------|--------|
| Callable `consultarEstadosPeriodoLiquidacionGrupo` | ✅ Deploy |
| `reabrirPeriodoLiquidacion` (ya existía) | ✅ Wire UI |
| Tarjetas: cerrado + sin dotación | ✅ Prod OK |
| Modal: cerrar/reabrir compacto + aviso sin dotación | ✅ Prod OK |
| RRHH: sin filtro Período/Vista/Sector superior | ✅ Prod OK |
| Hosting + function consulta estados | ✅ Deploy sesión |

---

## Archivos clave (código)

### Backend

| Archivo | Rol |
|---------|-----|
| `functions/modules/asistencia/asistenciaPeriodoLiquidacion.js` | Cierre/reapertura; consulta batch; fix `grupo_trabajo_id` en consulta; `personas_vigentes` |
| `functions/onCall/grilla/consultarEstadosPeriodoLiquidacionGrupo.js` | Callable batch estados (RRHH + jefe lectura por grupo) |
| `functions/modules/shared/grillaMesAgenteCore.js` | `personasVigentesIdsGrupoMes` / `contarPersonasVigentesGrupoMes` |
| `functions/index.js` | Export callable consulta |

### Web (GSO calendario licencias)

| Archivo | Rol |
|---------|-----|
| `web/src/features/grilla/GrillaMesLicenciasPanel.jsx` | Tarjetas 3 meses; modal; sin selector RRHH; carga directa |
| `web/src/features/grilla/useGrillaMesVista.js` | `aplicarSeleccionDesdeTarjeta`; `cargar(override)`; preservar `gdt` en modo SECTOR |
| `web/src/features/grilla/useEstadosPeriodoLiquidacionGrupos.js` | Batch cerrado + `sinDotacion` |
| `web/src/features/grilla/GrillaTarjetaGrupoPeriodo.jsx` | UI tarjeta cerrada / sin dotación |
| `web/src/features/grilla/GrillaPeriodoLiquidacionAccionesRrhh.jsx` | Cerrar/reabrir; prop `compact` |
| `web/src/features/grilla/GrillaMesSinDotacionAviso.jsx` | Mensaje modal 0 agentes |
| `web/src/pages/rrhh/GrillaOperativaRrhhPage.jsx` | `variant="rrhh"` |

### Scripts

| Script | Uso |
|--------|-----|
| `scripts/smoke-f1-qa-4-2-prod.mjs` | 5 OK + 1 SKIP (CHAPARRO jun Sala) |
| `scripts/smoke-f2-orquestacion-prod.mjs` | 3/3 OK |
| `scripts/audit-porteria-grilla-mes.mjs` | Diagnóstico HLg Portería por mes (requiere `.env.v2.local`) |
| `scripts/grant-cloud-run-invoker-callables.mjs` | Incluye `consultarEstadosPeriodoLiquidacionGrupo` |

---

## Bugs corregidos en sesión

| Bug | Causa | Fix |
|-----|-------|-----|
| Bucle “Cargando grilla…” | `useEstadosPeriodoLiquidacionGrupos` re-ejecutaba por deps inestables; efecto con `vista` entero | `itemsKey` estable; deps acotadas; `cargar({ periodo, modo, grupoId })` |
| Portería / sector sin filas | Tarjeta usaba modo EQUIPO; `recargarGruposEquipo` borraba `grupoId` si no está en HLg del operador RRHH | Modo **SECTOR** desde tarjeta RRHH; preservar `grupoId` en SECTOR; `cargar` con override |
| Tarjetas nunca “cerradas” | Consulta batch pasaba `grupo_trabajo_id` pero core leía `grupoTrabajoId` | Alias en `consultarPeriodoLiquidacionGrupoMes` |
| Tarjetas saltaban de orden | Map sin orden fijo | Sort alfabético `es`; Titular siempre primero |
| Mensaje vacío engañoso | Tabla genérica “pulsá Cargar” | `GrillaMesSinDotacionAviso` cuando `total_personas === 0` |

---

## Regla de producto: catálogo vs dotación

| Capa | Fuente | Pregunta |
|------|--------|----------|
| **Tarjetas RRHH** | `grupos_de_trabajo` activos | ¿Existe el sector en la institución? |
| **Grilla sector** | HLg vigente al **último día del mes** | ¿Quién está asignado en el corte? |

**Portería (`gdt_01KQA9FVEW53JSNTPGX32NWQ5B`):**

- Piloto MOSTO: HLg `hlg_01KSXC395J2ACV5W4HWW7YTCTM` → `activo: false`, `fecha_fin: 2026-06-01`.
- **Junio 2026 en adelante:** 0 agentes al cierre → tarjeta **Sin dotación** + modal explicativo (OK).
- **Mayo 2026:** MOSTO vigente al 31/05 → smoke `D2-MOSTO-mayo-Porteria` 12 turnos.

---

## Deploy sesión (prod)

```bash
npm run build:web
npx firebase deploy --project portal-hospital-v2 --only hosting
npm run firebase:deploy:functions -- --only "functions:consultarEstadosPeriodoLiquidacionGrupo"
# (deploy functions completo también ejecutado en sesión)
```

**Nota:** `gcloud` no disponible en PC sesión → si 403 en callable nuevo, ejecutar grant invoker en máquina con SDK.

---

## Puntos de control — próxima sesión (enumerados)

### Actualización QA manual (2026-06-02)

| Control | Estado | Nota de cierre |
|---------|--------|----------------|
| A2 | ✅ OK | LOKITO compuesto validado en UI. |
| A4 | ✅ OK (con criterio) | `jefe/planes-turno` muestra **foto histórica** del plan (incluye CHAPARRO en Sala junio); `rrhh/grilla-operativa` refleja estado vigente/materializado (sin CHAPARRO tras deshabilitar HLg). Se agregó aviso UI en detalle histórico para evitar ambigüedad. |
| A5 | ✅ OK | Override jefe scoped validado con mutación real en Sala julio (`guardarPlanTurnoServicio` 200), luego rollback inmediato y guardado de reversión (sin residuo funcional). |
| A3 | ✅ OK | §4.2 **#6**: en Explorador RRHH se revirtió a revisión el plan **Oficina PERSONAL** jun-2026 (`plt_01KT2BWXXAFPTYEG77Y0KWFS74`); **Sala Internación 1** siguió HABILITADO (3 agentes, acción «Revertir» disponible). Rehabilitación desde Bandeja Evaluador sin afectar Sala. |
| A1 | ✅ OK | §4.2 **#2**: **64-A** `sol_01KT3ZG4VPY2SNRWW3Z09DV73S` (2026-06-11, ancla Oficina) → `64-A` en `vis_2026_06` día 11 Oficina+Sala. **LAO** `sol_01KT402WR9SVN46JESKAS6KE1E` (2026-06-03…09, 5 hábiles, ancla **Sala** `gdt_01KQA6Q…`) → `cfg_esa_en_revision_jefe`; `LAO-2026` en días 03–05 y 08–09 en ambos `gdt`. Wizard: esperar fin de `simularLaoPreview` en paso 3 (falso negativo «No podés continuar» mientras carga). |

**Cambio UI aplicado para trazabilidad:**  
`web/src/pages/jefe/PlanTurnoServicioPage.jsx` — aviso simple al pie de “Grilla aprobada (histórico)”:  
“Foto histórica del plan. Si después se deshabilita una asignación, puede no coincidir con la grilla operativa vigente.”

### Prioridad A — Cierre F1 (manual QA)

| # | Control | Cómo validar | Piloto / dato |
|---|---------|--------------|---------------|
| A1 | §4.2 **#2** LAO + GS-A en `gdt` correcto | ✅ Cerrado | MOSTO · `sol_01KT3ZG4…` + `sol_01KT402WR9SVN46JESKAS6KE1E` |
| A2 | §4.2 **#3** LOKITO turno compuesto UI | Grilla julio Oficina | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` |
| A3 | §4.2 **#6** Rehabilitar/eliminar plan sin pisar otro `gdt` | ✅ Cerrado (revertir + rehabilitar; Sala intacta) | Oficina `gdt_01KR3H81…` vs Sala `gdt_01KQA6Q…` |
| A4 | §4.2 **#8** Grilla equipo jefe vs materialización | ✅ Cerrado con criterio histórico vs vigente | CHAPARRO |
| A5 | §4.2 **#9** Override jefe scoped | ✅ Cerrado (mutación + rollback) | ASI scope |

### Actualización QA manual B — GSO RRHH (2026-06-02)

| Control | Estado | Nota de cierre |
|---------|--------|----------------|
| B1 | ✅ OK | Cerrar mayo Oficina → tarjeta «Cerrado» + modal solo lectura con grilla equipo. |
| B2 | ✅ OK | Reapertura motivo ≥3 → sin badge cerrado; «Cerrar período» visible de nuevo. |
| B3 | ✅ OK | Sala junio: tabla LOKITO + MOSTO (LAO en revisión en celdas). |
| B4 | ✅ OK (criterio vigente) | Junio Portería: sin dotación **01–13/06**; desde **14/06** HLg activa `hlg_01KT3V26…` — grilla con MOSTO solo días con HLg operativa (usuario validó post-purge). |
| B5 | ✅ OK (criterio vigente) | Mayo Portería: **sin dotación** (ninguna HLg `activo:true` al cierre 31/05). Coherente con grilla = verdad operativa. |

**Purge fantasmas Portería (MOSTO):** `audit-purge-hlg-post-corte.mjs --apply` · 2026-06-01…2026-06-13 · `purge_ok: true`. Código: purge desde corte + `resolveHastaPurgeTrasDeshabilitarHlg` en `rrhhDeshabilitarHlg` (deploy functions pendiente).

### Prioridad B — GSO RRHH (regresión rápida) — checklist original

| # | Control | Esperado |
|---|---------|----------|
| B1 | Cerrar mayo Oficina → tarjetas gris “Cerrado” | ✅ |
| B2 | Reabrir con motivo ≥3 → tarjetas normales + edición | ✅ |
| B3 | Sala junio con agentes → tabla con filas | ✅ |
| B4 | Portería junio | Sin dotación si `personas_vigentes:0` al cierre; si hay HLg activa en el mes, tabla con filas |
| B5 | Portería mayo | Sin dotación si no hay HLg activa al cierre; no exigir turnos con HLg solo deshabilitada |

### Prioridad C — Automatizado (opcional al abrir)

```bash
node scripts/smoke-f1-qa-4-2-prod.mjs
node scripts/smoke-f2-orquestacion-prod.mjs
```

### Prioridad D — Siguiente épica código

| # | Tema | Doc |
|---|------|-----|
| D1 | **F3** turnos compuestos (T-02…T-08) | `ROADMAP` §F3 |
| D2 | Imputación externa grilla (reproyección eventos viejos) | sesión anterior MDC `grupo_trabajo_id_ancla` |
| D3 | ASI-PER mensaje sector en ticketera (deploy si pendiente) | `formatearMensajeEntorno.js` |

### Prioridad E — Deuda / mejoras menores GSO

| # | Mejora |
|---|--------|
| E1 | Jefe: mismas tarjetas sin dotación (hook ya permite jefe en consulta) |
| E2 | No abrir modal si `estaSinDotacion` (opcional: solo toast) |
| E3 | Commit `web/dist` — **no** incluir en git (build local) |

---

## Git — retomar en otra PC

```bash
git fetch origin
git checkout feat/epic-multi-hlg-fase1-execution
git pull origin feat/epic-multi-hlg-fase1-execution
npm install
cd web && npm install && cd ..
# .env.v2.local no está en git — copiar manualmente o desde gestor secretos
npm run build:web   # si vas a desplegar hosting
```

**Rama trabajo:** `feat/epic-multi-hlg-fase1-execution`  
**Commit pausa:** ver `git log -1` tras push de esta sesión.

---

## IDs piloto (referencia rápida)

| Agente | persona_id | Notas |
|--------|------------|-------|
| MOSTO | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` | Multicargo; Portería HLg fin 01/06 |
| LOKITO | `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB` | Oficina |
| CHAPARRO | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` | Sala |
| Oficina | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` | |
| Portería | `gdt_01KQA9FVEW53JSNTPGX32NWQ5B` | |
| Sala | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` | |
