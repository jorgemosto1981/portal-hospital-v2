# Evidencia — Oleada B MDC/RDA con flujo Oleada A limpio (21-may-2026)

**Solicitud de referencia:** `sol_01KS57Y01GDWCZFAS2EFF4JKP7` (misma que [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md))  
**Titular:** `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` · **Fecha:** `2026-03-21` · **Grilla:** 64-A

**Conclusión:** sin regresión MDC. Proyección al alta + consolidación al cierre jefe + fan-out `vis_*` alineados en tiempo y semántica con `sol_*` TO-BE.

---

## 1. Cadena de comandos esperada

| Orden | Comando | Disparador | Instante (UTC-3) |
|-------|---------|------------|------------------|
| 1 | `PROYECTAR_PENDIENTE` | Trigger Patrón B OK | 9:25:11 |
| 2 | `CONSOLIDAR_APROBADO` | Jefe aprueba → `cfg_esa_aprobada` | 9:25:50 |

RRHH **toma de conocimiento** (9:26:01) **no** dispara MDC.

Idempotencia (`mdc_comandos_aplicados`):

- `sol_01KS57Y01GDWCZFAS2EFF4JKP7_PROYECTAR_PENDIENTE_v1` — `aplicado_en` 9:25:11 ✅ (evidencia consola)
- `sol_01KS57Y01GDWCZFAS2EFF4JKP7_CONSOLIDAR_APROBADO_v1` — esperado ~9:25:50 (confirmar en consola; estado `asi`/`vis` demuestra aplicación)

---

## 2. `asistencia_diaria` / `asi_per_01KR3HD24AMJ6YX3N7B3GPAZJ4_20260321`

| Campo | Valor observado | OK |
|-------|-----------------|-----|
| `persona_id` | `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` | ✅ |
| `fecha_ymd` | `2026-03-21` | ✅ |
| `periodo` | `2026-03` | ✅ |
| `tiene_tramite_pendiente` | `false` | ✅ |
| `estado_consolidado` | `64-A` | ✅ |
| `aportes_normativos.sol_01KS57Y…` · `estado_instancia` | `APROBADO` | ✅ |
| `estado_solicitud_id` (aporte) | `cfg_esa_aprobada` | ✅ |
| `codigo_grilla` | `64-A` | ✅ |
| `grupo_trabajo_id_ancla` | `gdt_01KR3H81ENQK84ZK21EQWEQQXG` | ✅ |
| `actualizado_en` (raíz / aporte) | 9:25:50 | ✅ = `jefe_revision_en` / `mdc_ultimo_ok_en` |

---

## 3. `vistas_grilla_mes_agente` / `vis_2026_03_per_01KR3HD24AMJ6YX3N7B3GPAZJ4`

| Campo (`dias.21`) | Valor observado | OK |
|-------------------|-----------------|-----|
| `solicitud_id` | `sol_01KS57Y01GDWCZFAS2EFF4JKP7` | ✅ |
| `estado_solicitud_id` | `cfg_esa_aprobada` | ✅ |
| `color_ui` | `#3B82F6` | ✅ (consolidado; no `#F59E0B` pendiente) |
| `codigo_grilla` | `64-A` | ✅ |
| `nivel_ocupacion_dia_id` | `cfg_nod_exclusivo` | ✅ (enriquecimiento versión) |
| `tiene_conflicto` | `false` | ✅ |
| `metadata.ultima_sync_mdc` | 9:25:50 | ✅ |

---

## 4. Checklist regresión (Oleada A × B)

- [x] Cierre sustantivo solo en jefe (`CONSOLIDAR` en `sol_*`, no `rrhh_revision_*`)
- [x] `asi` en `APROBADO` + `cfg_esa_aprobada` en aporte
- [x] Fan-out grilla mes coherente con estado final
- [x] Sin estado intermedio `AUTORIZADO_JEFE` / `en_revision_rrhh` en este trámite
- [ ] Doc idempotencia `CONSOLIDAR_APROBADO_v1` (captura opcional en consola)

---

*Validado en consola Firestore prod V2 — 21-may-2026.*
