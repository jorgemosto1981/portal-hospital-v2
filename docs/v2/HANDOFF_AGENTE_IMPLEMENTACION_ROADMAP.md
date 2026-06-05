# Handoff — Agente implementador · Roadmap F-UX → F4

**Fecha:** 2026-06-01  
**Audiencia:** agente de implementación (código, tests, deploy)  
**Plan maestro:** [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md)  
**SSoT operativo día a día:** [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)  
**SSoT qué falta implementar:** [`PENDIENTES_IMPLEMENTACION_V2.md`](./PENDIENTES_IMPLEMENTACION_V2.md)  
**Rama:** `feat/epic-multi-hlg-fase1-execution` @ `71232f0` (verificar con `git pull`)  
**Producción:** https://portal-hospital-v2.web.app

---

## 1. Misión

Implementar el roadmap **por etapas**, respetando el orden **F-UX → F0 → F1 → F2 → F3 → F4** y el **DoD** de cada etapa (checklists al final de cada sección del roadmap) antes de declararla cerrada.

### Reglas no negociables

| Regla | Implicación |
|-------|-------------|
| Orden F3 → F4 | **No** empezar F4 (Outbox) hasta cerrar F3 (segmentos). |
| F0 antes de prod masivo | Purge, gate anclas, listado bulk, toasts deben estar OK. |
| SoT scoped | `capa_teorica_por_grupo[gdt]` + `vis_*` por burbuja; **sin** `capa_teorica` raíz. |
| Materializar vs purge | Materializar = solo **capa 1**; **purge ≠ materializar**. |
| Dos procesos día 5 | (1) materialización M+1 fijo/rotativo; (2) cierre liquidación M-1 — el **(2) está diferido** (P2). |
| PR turno mensual | No mergear épica PR3 turno mensual sin decisión explícita del equipo. |

### Principios arquitectónicos (cerrados)

- Motor de turnos = **física del tiempo** (`segmentos[]`, ISO); sin pesos monetarios en worker.
- Freeze en `vis_*` vía `estado_periodo_liquidacion_id`.
- GSO **solo lectura** de proyección; escribe worker / MDC / overrides.

Referencias: [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md), [`PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md`](./PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md) §15–22.

---

## 2. Estado real al retomar

| Etapa | Avance | Notas |
|-------|--------|-------|
| **F-UX.1** | ✅ ~100% | Menú RRHH, `/portal/rrhh/grilla-operativa`, sector por defecto |
| **F-UX.2** | ✅ Parcial | Badge **F:n** + modal; validado F:2 prod 2026-06-02 · UX-6 API pendiente |
| **F-UX.3** | ✅ Cerrado rama | Gestión turno A/B/C + batch v2 — [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) |
| **F0** | ✅ Código + smoke prod | O-P0-1,4,5,7; purge HLg validado CHAPARRO |
| **F1** | ✅ ~90% | Merge Multi-HLG en `master` (`25bc00c`); cierre manual RRHH OK |
| **F1.2 QA formal** | ⏳ | Matriz §4.2 [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) |
| **F2** | ~60–70% | Ver §3 — orquestación (paralelo a cierre épica) |
| **F3** | ✅ Núcleo | Tag `v2.3.0-f3-turnos-compuestos` · release notes F3 |
| **F4** | ✅ En rama (F-UX.3) | Outbox + `aplicarBatchAsistencia` A/B/C — merge `master` pendiente |

### Decisiones de negocio ya cerradas (no reabrir sin RRHH)

- Ventana teórica fijo/rotativo: **mes actual + mes siguiente**; día 5 → M+1 idempotente.
- Licencias `fecha_desde`: fin del **mes siguiente** (no 45d fijos en código actual).
- `depende_rda`: validar **anclas** (`fecha_desde` / `fecha_hasta`), no bucle 365 días.
- Cierre período: **manual RRHH** fase 1; auto-cierre día 5 liquidación = P2.
- HLg: régimen en vigente **bloqueado**; cerrar HLg → purge desde `fecha_fin + 1`.

---

## 3. F2 — cola exacta (punto de entrada)

| ID | Entregable | Estado | Siguiente acción |
|----|------------|--------|------------------|
| **2.1** | Metadata + toasts materialización | ✅ metadata; ⏳ toasts UI | Toasts unificados GSO / HLg |
| **2.2** | Purge productivo | ✅ | — |
| **2.3** | `materializarRango` | ✅ HLg; ⏳ feriado masivo | Feriado 1 día × N agentes |
| **2.4** | Job día 5 materialización | ✅ Código | **Deploy + smoke dry_run** |
| **O-P1-3** | GSO M-1 solo lectura (usuario/jefe) | ⏳ | Gates en callables grilla |
| **2.5** | Plan usuario nuevo §19.6 | ✅ | RFC plan paralelo Fases 0–5 — [`RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`](./RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md) |
| **2.6** | Piloto `resolverFijo` + rematerializar UI | ⏳ | Casos D2/D11 |
| **2.7** | Rematerializar post-régimen/feriado UI | ⏳ | Wire régimen / calendario |

### Orden sugerido

1. **F2.4** — Deploy + smoke `jobMaterializacionVentanaDia5` (Scheduler 07:00 ART día 5).
2. **O-P1-3** — GSO mes M-1 solo lectura usuario/jefe desde día 1.
3. **2.1 / 2.3 / 2.5–2.7** según prioridad RRHH.
4. **F1.2** — QA formal §4.2 en paralelo si hay RRHH disponible.

Handoff pausa previa: [`HANDOFF_SESION_2026-06-01_PAUSA_F2.md`](./HANDOFF_SESION_2026-06-01_PAUSA_F2.md).

---

## 4. Mapa de archivos clave

### Orquestación / materialización

| Archivo | Rol |
|---------|-----|
| `functions/modules/asistencia/rdaTurnoTeoricoWorker.js` | Worker capa 1, `materializarGrupoMes` |
| `functions/modules/asistencia/materializarRango.js` | Materialización por rango YMD |
| `functions/modules/asistencia/purgeCapaTeoricaGdtRango.js` | Purge teórico post-HLg |
| `functions/modules/asistencia/visMaterializacionMetadata.js` | `metadata.ultimo_motivo`, rango |
| `functions/modules/asistencia/jobMaterializacionVentanaDia5.js` | Job día 5 M+1 |
| `functions/modules/catalogosLaborales.js` | Alta / deshabilitar HLg + wire rango |

### Grilla / GSO (web + backend)

| Archivo | Rol |
|---------|-----|
| `functions/modules/shared/grillaMesAgenteCore.js` | Lazy, listado sector, lectura `vis_*` |
| `web/src/features/grilla/useGrillaMesVista.js` | Estado vista, toasts |
| `web/src/features/grilla/GrillaMesLicenciasPanel.jsx` | UI calendario GSO |
| `web/src/pages/rrhh/GrillaOperativaRrhhPage.jsx` | Entrada RRHH |

### Cierre período

| Archivo | Rol |
|---------|-----|
| `functions/onCall/grilla/cerrarPeriodoLiquidacion.js` | Callable cierre |
| `functions/onCall/grilla/reabrirPeriodoLiquidacion.js` | Reapertura auditada |
| `functions/modules/asistencia/asistenciaPeriodoLiquidacion.js` | Gates EPL |

### Ticketera / gates

| Archivo | Rol |
|---------|-----|
| `functions/modules/ticketera/grillaTurnoEntornoGate.js` | `depende_rda` anclas |
| `functions/modules/shared/solicitudHlgVigencia.js` | HLg corte inclusivo |

### Tests existentes

- `functions/test/visMaterializacionMetadata.test.js`
- `functions/test/solicitudHlgVigencia.test.js`
- `functions/test/jobMaterializacionVentanaDia5.test.js`
- `functions/test/validarEntornoOperativo.test.js`

---

## 5. Protocolo deploy

```powershell
cd c:\Users\jorge\Desktop\portal-hospital-v2
git pull origin feat/epic-multi-hlg-fase1-execution

# Functions
npm run firebase:deploy:functions

# UI (si tocó web GSO / HLg / turnos)
npm run build:web
firebase deploy --project portal-hospital-v2 --only hosting

# Callables nuevos / CORS 403
npm run firebase:grant-callables-invoker:firebase-login
```

### Anti-patrones

- **No** commitear cambios en `functions/modules/shared/*` que solo generó el sync del predeploy.
- **No** desplegar solo functions si se prueba UI Titular / Turnos / GSO.
- `planesTurnoServicio` / rematerialización pueden **no** escribir metadata si no se redeployaron tras `e349412`.
- Tras deploy, verificar healthcheck paths en `onCall/grilla/*` (`runtimeFlags.json`).

---

## 6. Scripts QA (Admin SDK — `.env.v2.local`)

```powershell
node scripts/audit-vis-metadata.mjs
node scripts/audit-purge-hlg-post-corte.mjs --dni=27667499 --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --desde=2026-06-01
node scripts/materializar-grupo-mes.mjs --gdt=gdt_01KR3H81ENQK84ZK21EQWEQQXG --periodo=2026-06
node scripts/verificar-vis-mes-agente.mjs --dni=28914247 --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06
node scripts/audit-persona-grupos-fecha.mjs --dni=28914247 --fecha=2026-06-01
```

**Smoke metadata (2026-06-01):** `ultimo_motivo` aparece tras rematerializar post-deploy; docs viejos no se rellenan retroactivamente.

---

## 7. Piloto (IDs fijos)

| Agente | DNI | `persona_id` |
|--------|-----|--------------|
| MOSTO | 28914247 | `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` |
| CHAPARRO | 27667499 | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` |

| Grupo | `gdt_id` |
|-------|----------|
| Portería | `gdt_01KQA9FVEW53JSNTPGX32NWQ5B` |
| Sala Internación | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| Oficina Personal | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` |

Plan piloto Sala: `plt_01KSSPY2H5EZA925FQP4S1G2XW`.

---

## 8. Documentos de lectura obligatoria (orden)

1. [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md)
2. [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)
3. [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md)
4. [`PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md`](./PLAN_CURSOR_ANALISIS_HLG_GRILLA.plan.md) §15–22
5. [`ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md`](./ANALISIS_COHERENCIA_ORQUESTACION_VS_CODIGO.md) — contrastar gaps con PENDIENTES (parte ya cerrada)

Biblia épica: [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md).

---

## 9. Prompt inicial para el agente implementador

```
Implementá el roadmap en docs/v2/ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md.

Estado: F-UX.1, F0 y F1 casi cerrados; F2 en curso.
Empezá por F2.4 (deploy + smoke job día 5), luego O-P1-3 (GSO M-1 solo lectura).

Seguí docs/v2/PENDIENTES_PROXIMA_SESION.md como SSoT operativo.
Handoff: docs/v2/HANDOFF_AGENTE_IMPLEMENTACION_ROADMAP.md

Rama: feat/epic-multi-hlg-fase1-execution
No avances a F3 hasta cerrar DoD de F2 pendiente.
Respetá capas scoped, purge ≠ materializar, protocolo deploy del handoff.
Actualizá PENDIENTES y actas smoke al cerrar cada entregable.
```

---

## 10. División de roles

| Agente | Responsabilidad |
|--------|-----------------|
| **Análisis / producto** | Orquestación, reglas RRHH, priorización, handoffs, revisión DoD |
| **Implementación (este handoff)** | Código, tests, deploy, smoke, actas en PENDIENTES |

---

## 11. Etapas futuras (solo referencia — no implementar aún)

| Etapa | Objetivo | Dependencia |
|-------|----------|-------------|
| **F3** | Segmentos, cobertura, `fichadas_esperadas` (T-02…T-08) | F2 estable |
| **F4** | Outbox + `enviarAccionesAsistencia` | **F3 cerrada** |
| **F-UX.2** | Vista jefe acotada | Fichadas esperadas en UI ✅; auditoría sin fichadas reales ⏳ |
| **P2** | Auto-cierre día 5 liquidación, lazy acotado, manual normativo | Tras F2 |

Calendario sugerido: ver § Calendario en [`ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md`](./ROADMAP_IMPLEMENTACION_SUCESIVA_V2.md).
