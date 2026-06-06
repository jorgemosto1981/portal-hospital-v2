---
name: Grilla aprobada en plan turno servicio
status: implementado
tag_checkpoint: v2-pre-grilla-aprobada-plt
tag_release: v2-grilla-aprobada-plt
---

# RFC — `grilla_aprobada` en `planes_turno_servicio`

## Decisión

Al pasar un plan mensual a **HABILITADO**, el backend persiste en el mismo documento `plt_*` un bloque **`grilla_aprobada`**: foto inmutable de turnos, horarios, francos, feriados y fichadas esperadas del mes **tal como quedó aprobado**.

| Capa | Colección | Rol | Mutable en el mes |
|------|-----------|-----|-------------------|
| **Aprobado (histórico)** | `planes_turno_servicio.grilla_aprobada` | “Qué aprobó RRHH” — todas las pantallas **VER plan** | **No** |
| **Operativa** | `asistencia_diaria`, `vistas_grilla_mes_agente` | Capa teórica viva, overrides, licencias, MDC | **Sí** |
| **Real (futuro)** | `asistencia_diaria` (fichadas, cierre RRHH) | Cruce teoría vs realidad al **cierre de turno** | **Sí** |

El plan **no se reforma** después de HABILITADO. La operación evoluciona en `asi_*` / `vis_*` sin reescribir `grilla_aprobada`.

## Principios

1. **Una lectura para “VER plan”** — callable `obtenerVistaPlanTurnoServicio({ plan_id })`; UI sin re-derivar desde `cfg_regimen_horario`.
2. **Escritura única al aprobar** — tras `materializarGrupoMes` OK, `construirGrillaAprobada` + `update` del `plt_*` (1 write adicional).
3. **Sin hardcoding** — horarios y `cfg_*` resueltos en backend con la misma lógica que materialización (`resolverDiaConPreCarga`, `buildCapaTeoricaSegmentada`).
4. **Bajo costo** — no N lecturas a `asi_*` para armar snapshot; se calcula en memoria reutilizando caché de régimen y calendario (1× índice calendario por plan).
5. **Coherencia B6** — operación sigue en `asi_*` con referencias (`plan_id` en `capa_teorica`); snapshot es copia de lectura, no FK cruzada.

## Esquema `grilla_aprobada` (versión 1)

```json
{
  "version": 1,
  "periodo": "2026-05",
  "grupo_id": "gdt_…",
  "materializado_en": "2026-05-28T12:00:00.000Z",
  "agentes": [
    {
      "persona_id": "per_…",
      "regimen_horario_id": "cfg_reg_…",
      "hlg_id": "hlg_…",
      "fila_id": "per_…__hlg_…",
      "vigente_desde": "2026-06-01",
      "vigente_hasta": "2026-06-10",
      "carga_horaria_semanal": 12,
      "dias": {
        "2026-05-01": {
          "tipo_dia": "laborable",
          "turno_id": "M",
          "turno_compuesto_id": "M",
          "ingreso": "08:00",
          "egreso": "14:00",
          "ingreso_iso": "…",
          "egreso_iso": "…",
          "es_franco": false,
          "es_feriado": false,
          "clasificacion_dia_calendario_id": "cfg_cdc_…",
          "fichadas_esperadas": 2,
          "segmentos": []
        }
      }
    }
  ]
}
```

- `agentes[].dias` sustituye para **lectura** al campo editor `agentes[].dias` (que puede estar vacío en fijos/rotativos).
- **Fase 5 (2026-06):** una entrada por tramo HLg (`hlg_id`); `dias` solo incluye fechas dentro de vigencia HLg; metadata `vigente_desde` / `vigente_hasta` / `carga_horaria_semanal` para UI histórica. Planes legacy sin metadata: `obtenerVistaPlanTurnoServicio` enriquece desde contexto grupo.
- `segmentos` opcional y acotado (compuestos/nocturnos); UI puede mostrar resumen + detalle bajo demanda.

## Flujo al aprobar

```
aprobarPlanTurnoServicio
  → tx: estado HABILITADO
  → materializarGrupoMes(grupo, mes)
  → construirGrillaAprobada(plan)   // sin lecturas masivas a asi_*
  → update plt: { grilla_aprobada, grilla_aprobada_en }
```

Si materialización falla: `materializacion_fallida: true` y **no** se escribe `grilla_aprobada`.

## Callable de lectura

`obtenerVistaPlanTurnoServicio({ plan_id })` → `{ plan, grilla_aprobada }`.

- Planes legacy HABILITADO sin snapshot: el callable puede **generar y persistir** una vez (lazy backfill administrativo).
- Scripts ops: `scripts/backfill-grilla-aprobada-plan.mjs <plt_id>`.

## UI (lectura unificada)

- `useVistaPlanTurno` + `PlanGrillaVistaModal` + `PlanGrillaAprobadaTable`.
- **VER turno original** (mismo callable, mismo documento):
  - Explorador RRHH → botón VER
  - Explorador RRHH → pestaña Grilla en Detalles
  - Bandeja RRHH → Ver turno (`BandejaAprobaciones`)
  - Jefe → detalle plan HABILITADO / histórico
- Planes **ENVIADO/BORRADOR**: vista calculada en servidor (no persiste hasta HABILITADO).
- Grillas **operativas** (`/portal/grilla`, equipo): siguen `obtenerVistaGrillaMesAgente` / `vis_*`.

## Cierre de turno (pendiente producto)

Extremo opuesto al `plt_*` aprobado: **cierre mensual RRHH** sobre realidad consolidada (`asi_*` + fichadas + controles). No forma parte de este RFC; ver `RFC_CIERRE_PERIODO_LIQUIDACION_V2.md` y futuro `RFC_CIERRE_TURNO_MENSUAL_V2.md`.

## Reglas Firestore

- Cliente: **no** puede escribir `grilla_aprobada` (solo callables Admin SDK).
- `estado` HABILITADO: update de campos de gobernanza limitados; `grilla_aprobada` solo backend.

## Próxima sesión (QA)

Control del piloto en todas las pantallas y colecciones: [`HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md`](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) — matriz de 10 ítems (VER plan vs `asi_*` vs `vis_*` vs grilla operativa antes de fichadas reales).

## Referencias

- [`PLAN_REGIMEN_HORARIO_V2.md`](./PLAN_REGIMEN_HORARIO_V2.md) — gobernanza `planes_turno_servicio`
- [`PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](./PLAN_CAPA_TEORICA_ASISTENCIA_V2.md) — materialización `asi_*` / `vis_*`
- [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) — segmentos y fichadas esperadas
