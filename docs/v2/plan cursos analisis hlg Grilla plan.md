---
title: "Plan Cursor — Análisis HLG · Turnos · Grilla plan"
alias: plan-cursos-analisis-hlg-grilla-plan
updated: 2026-05-29
---

# Plan Cursor: análisis HLG → turnos → materialización → grilla operativa

Este archivo es el **punto de entrada** con el nombre usado en Cursor. El contenido completo está en:

## Documento principal (leer / editar aquí)

**[ANALISIS_INTEGRAL_HLG_TURNOS_MATERIALIZACION_GSO.md](./ANALISIS_INTEGRAL_HLG_TURNOS_MATERIALIZACION_GSO.md)**

Incluye diagrama Mermaid, dos capas (aprobado vs operativo), callables, matriz 1–10 y referencias de código.

---

## Continuidad de implementación

| Doc | Uso |
|-----|-----|
| [HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md](./HANDOFF_SESION_2026-05-29_TURNO_MENSUAL_PR3_PAUSA.md) | Pausa PR3; rama `feat/epic-turno-mensual-fase2-pr3` |
| [PENDIENTES_PROXIMA_SESION.md](./PENDIENTES_PROXIMA_SESION.md) | Índice retomar |
| [HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md](./HANDOFF_SESION_2026-05-28_TURNOS_GRILLA_APROBADA.md) | Matriz + scripts `inspect-plan` / audit |

---

## Contratos y capa teórica

| Doc | Uso |
|-----|-----|
| [RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md) | Snapshot `grilla_aprobada` |
| [CAPA_TEORICA_SEGMENTOS_V2.md](./CAPA_TEORICA_SEGMENTOS_V2.md) | Segmentos, `fichadas_esperadas` |
| [PLAN_CAPA_TEORICA_ASISTENCIA_V2.md](./PLAN_CAPA_TEORICA_ASISTENCIA_V2.md) | Plan capa teórica (si existe en repo) |
| [DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md](./DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md) | Catálogo turnos |

---

## Plan épica jun-2026 (Cursor local)

Ruta típica en esta máquina:

`C:\Users\Mosto\.cursor\plans\turno_mensual_jun-2026_371c6708.plan.md`

Stub en plans: `analisis_integral_hlg_turnos_materializacion_gso.plan.md`

---

## Piloto QA

| Plan | Período |
|------|---------|
| `plt_01KSSPY2H5EZA925FQP4S1G2XW` | 2026-06 |
| `plt_01KSR8J55H1TN10M3ANSSWMPF2` | 2026-05 |
| Grupo | `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V` (Sala Internación 1) |

---

## Siguiente paso de trabajo

1. Merge PR3 → `feat/epic-turnos-compuestos-v2`
2. PR4: GSO + `/portal/rrhh/grilla-operativa`
3. Matriz ítems 5–10 (`asi_*`, `vis_*`, `depende_rda`)
