---
fecha: 2026-05-28
branch: feat/epic-turnos-compuestos-v2
retomar_aqui: true
---

# Handoff — Turnos mensuales, `grilla_aprobada` y vistas unificadas

**RETOMAR AQUÍ** en la próxima sesión.

## Estado al cierre (28/05/2026)

| Ítem | Valor |
|------|--------|
| **Rama** | `feat/epic-turnos-compuestos-v2` |
| **Producción** | https://portal-hospital-v2.web.app |
| **Proyecto Firebase** | `portal-hospital-v2` |
| **Piloto plan** | `plt_01KSR8J55H1TN10M3ANSSWMPF2` |
| **Grupo** | Sala Internación 1 — `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` |
| **Período** | `2026-05` |
| **Estado plan** | HABILITADO, `grilla_aprobada` persistida (3 agentes × 31 días) |

### Commits de esta línea de trabajo (orden)

| Commit | Descripción |
|--------|-------------|
| `9b361b0` | Checkpoint: PLT-GRD-001, PLT-APR-DUP, RFC, grilla VER interina |
| `3bb62b9` | `grilla_aprobada` al aprobar + `obtenerVistaPlanTurnoServicio` |
| `730b4b9` | VER plan unificado (Explorador, Bandeja, Jefe) |

### Tags de seguridad

| Tag | Uso |
|-----|-----|
| `v2-pre-grilla-aprobada-plt` | Antes de snapshot en plan (`9b361b0`) |
| `v2-grilla-aprobada-plt` | Con snapshot + callable vista (`3bb62b9`) |

---

## Arquitectura acordada (dos capas)

```text
APROBADO (inmutable)                    OPERATIVO (evoluciona en el mes)
─────────────────────                   ───────────────────────────────
planes_turno_servicio                   asistencia_diaria (asi_*)
  └─ grilla_aprobada                      └─ capa_teorica
       ↑ lectura "VER turno"                    ↑ overrides, licencias, MDC
  └─ agentes[].dias (solo editor)         vistas_grilla_mes_agente (vis_*)
                                              ↑ grilla agente / equipo / gates

FUTURO: cierre turno RRHH = extremo "realidad" (fichadas + controles)
```

- **VER turno original** → siempre `obtenerVistaPlanTurnoServicio` → `grilla_aprobada` (o vista calculada sin persistir si ENVIADO/BORRADOR).
- **Grilla operativa del día** → `obtenerVistaGrillaMesAgente` / `vis_*` (puede divergir del plan tras overrides).

---

## Próxima sesión — OBJETIVO PRINCIPAL

> **CONTROL ESTE TURNO EN TODAS LAS PANTALLAS DE VISTA, IMPACTO DE DATOS EN ASI / VIS Y DEMÁS REGISTROS, E IR CORROBORANDO CÓMO SE FORMA GRILLA OPERATIVA ANTES DE RECIBIR FICHADAS.**

### Matriz de control (piloto `plt_01KSR8…` / mayo 2026)

Marcar cada fila cuando vista y datos coincidan con lo esperado.

| # | Pantalla / ruta | Qué lee | Qué validar |
|---|-----------------|--------|-------------|
| 1 | RRHH Explorador → **VER** | `obtenerVistaPlanTurnoServicio` → `grilla_aprobada` | CHAPARRO/MOSTO/LOKITO con turno+horario; francos `F`; feriados si aplica |
| 2 | RRHH Explorador → **Detalles → Grilla** | mismo callable | Misma grilla que VER |
| 3 | RRHH **Bandeja** → Ver turno | `PlanGrillaVistaModal` | Misma fuente (planes pendientes: vista calculada, no persistida) |
| 4 | Jefe **Planes turno** → detalle HABILITADO | `useVistaPlanTurno` | Grilla aprobada (histórico) |
| 5 | Agente **`/portal/grilla`** | `vis_*` vía `obtenerVistaGrillaMesAgente` | Coherente con materialización post-aprobación |
| 6 | Jefe **grilla equipo** | `listarVistaGrillaMesPorGrupo` | Turnos teóricos del grupo |
| 7 | Firestore **`asi_*`** | `capa_teorica` por día/agente | `plan_id`, segmentos, `fichadas_esperadas`, feriados |
| 8 | Firestore **`vis_*`** | `dias.N.rda_*`, `es_franco` | Alineado con `asi_*` tras materializar |
| 9 | Documento **`plt_*`** | `grilla_aprobada` | No cambia tras override en `asi_*` |
| 10 | Gate licencia **`depende_rda`** | `capa_teorica` en día con/sin turno | Rechazo/OK según día |

### Flujo a corroborar (sin fichadas reales aún)

1. **Aprobar plan** → escribe `grilla_aprobada` + `materializarGrupoMes` → `asi_*` + `vis_*`.
2. **Override jefe** (si se prueba) → solo muta `asi_*`/`vis_*`; `grilla_aprobada` **no** cambia.
3. **Licencia aprobada** (MDC) → impacto en `asi_*`/`vis_*`; comparar con snapshot del plan.
4. Anotar **diferencias esperadas** vs **bugs** (ej. plan VER = snapshot, grilla operativa ≠ snapshot tras override).

### Scripts ops (raíz `scripts/`)

```bash
node scripts/inspect-plan-por-id.mjs plt_01KSR8J55H1TN10M3ANSSWMPF2
node scripts/audit-fase4-6-plan-habilitado.mjs plt_01KSR8J55H1TN10M3ANSSWMPF2
node scripts/backfill-grilla-aprobada-plan.mjs plt_01KSR8J55H1TN10M3ANSSWMPF2
node scripts/audit-fase0-capa-teorica-muestra.mjs   # muestra asi/vis piloto
```

Requieren `.env.v2.local` + credenciales Admin.

---

## Implementado en código

### Backend (`functions/modules/asistencia/`)

- `planGrillaAprobadaBuilder.js` — construye `grilla_aprobada` en memoria (misma lógica que materialización).
- `planesTurnoServicio.js`:
  - `PLT-GRD-001` — un plan mensual activo por grupo+período (`eliminado: true` libera).
  - `PLT-APR-DUP` — dup al aprobar.
  - Al aprobar: `materializarGrupoMes` + persistir `grilla_aprobada`.
- `obtenerVistaPlanTurnoServicio` — lectura unificada; backfill lazy si HABILITADO sin snapshot; vista calculada para ENVIADO/BORRADOR sin persistir.

### Frontend (`web/src/features/planes/`)

- `useVistaPlanTurno.js`
- `PlanGrillaVistaModal.jsx`
- `PlanGrillaAprobadaTable.jsx` + `planGrillaAprobadaDisplay.js`

### Pantallas unificadas VER

- `ExploradorTurnosRrhhPage.jsx`
- `BandejaAprobaciones.jsx` (usada por `BandejaTurnosRrhhPage.jsx`)
- `PlanTurnoServicioPage.jsx` (detalle HABILITADO)

### Documentación

- [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md)
- [`PLAN_REGIMEN_HORARIO_V2.md`](./PLAN_REGIMEN_HORARIO_V2.md) — § plan mensual + `grilla_aprobada`
- [`PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](./PLAN_CAPA_TEORICA_ASISTENCIA_V2.md) — materialización

---

## Pendiente producto / técnico

1. **RFC cierre turno mensual RRHH** — extremo “realidad” vs `grilla_aprobada` (relacionado con [`RFC_CIERRE_PERIODO_LIQUIDACION_V2.md`](./RFC_CIERRE_PERIODO_LIQUIDACION_V2.md)).
2. **Fichadas reales** — integración reloj; cruce teoría (operativa) vs real.
3. **Indicador UI** en grilla operativa: “difiere del plan aprobado” cuando `asi_*` ≠ snapshot (opcional).
4. **QA formal** — completar matriz § control + gates compuesto/nocturno LOKITO.

---

## Retomar en otra PC

```bash
git fetch origin
git checkout feat/epic-turnos-compuestos-v2
git pull origin feat/epic-turnos-compuestos-v2
npm install
npm install --prefix web
npm install --prefix functions
# .env.v2.local (no está en git) — copiar credenciales
npm run dev:web   # :5173 local; prod: portal-hospital-v2.web.app
```

Deploy si hubo cambios solo locales:

```bash
npm run build:web
npm run firebase:deploy:functions
npx firebase deploy --project portal-hospital-v2 --only hosting
```

---

## Rutas UI

| Rol | Ruta | Uso |
|-----|------|-----|
| Jefe | `/portal/jefe/planes-turno` | Crear/editar/enviar plan |
| RRHH | `/portal/rrhh/bandeja-turnos` | Aprobar/rechazar pendientes |
| RRHH | `/portal/rrhh/explorador-turnos` | Historial + VER |
| Agente | `/portal/grilla` | Grilla operativa mes |

---

## Reglas de negocio vigentes

- Un solo plan mensual **activo** por `grupo_id` + `periodo` (cualquier estado salvo `eliminado: true`).
- Plan **HABILITADO** no se edita; operación en `asi_*`/`vis_*`.
- `grilla_aprobada` = foto aprobada; no se actualiza con overrides.
