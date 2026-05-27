# Capa teórica segmentada — Contrato V2

**Estado:** RFC aprobado (tag `v2.0.0-rfc-turnos-compuestos`).  
**Fecha:** 27 de mayo de 2026.  
**Relación:** [`PLAN_REGIMEN_HORARIO_V2.md`](./PLAN_REGIMEN_HORARIO_V2.md), [`PLAN_CAPA_TEORICA_ASISTENCIA_V2.md`](./PLAN_CAPA_TEORICA_ASISTENCIA_V2.md), [`DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md`](./DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md).

**Sin compatibilidad hacia atrás** con el modelo de turno único diario.

---

## 1. Principios

1. **SoT:** `asistencia_diaria.capa_teorica.segmentos[]` (lista ordenada de tramos efectivos del día).
2. **Resumen derivado:** `ingreso_teorico_final`, `egreso_teorico_final`, `horas_teoricas_totales`, `turno_compuesto_id`, `tiene_huecos` — recalculable desde segmentos.
3. **Persistencia:** solo `*_id` hacia `cfg_*`; UI muestra `*_label` vía enrich en callables.
4. **Fechas:** `fecha_base`, `ingreso_iso`, `egreso_iso` en ISO; UI en DD/MM/AAAA.
5. El frontend **no** reenvía `capa_teorica` completa; solo backend materializa.

---

## 2. Estructura `capa_teorica` (raíz del día)

| Campo | Tipo | Obl. | Descripción |
|-------|------|------|-------------|
| `fecha_base` | string YMD | Sí | Día teórico ancla |
| `segmentos` | array | Sí | SoT de tramos (§3) |
| `ingreso_teorico_final` | ISO string | Sí* | `min(ingreso_iso)` — derivado |
| `egreso_teorico_final` | ISO string | Sí* | `max(egreso_iso)` — derivado |
| `horas_teoricas_totales` | number | Sí* | Suma segmentos — derivado |
| `turno_compuesto_id` | string | No | Canonización de ids de segmento (ej. orden horario) |
| `tiene_huecos` | boolean | Sí* | Discontinuidad entre segmentos |
| `clasificacion_dia_calendario_id` | string | Sí | FK → `cfg_clasificacion_dia_calendario` |
| `calendario_evento_ref` | string YMD | No | Clave en `cfg_cal_YYYY.dias_no_laborables` |
| `multiplicador_institucional` | number | No | Copia lectura del calendario |
| `tipo_dia` | enum operativo | Sí | `laborable` \| `franco` \| `guardia` \| `no_laborable` |
| `es_feriado` | boolean | No | Índice legacy; derivar de clasificación |
| `version_capa_teorica` | number | No | Concurrencia optimista |
| `expectativas_fichada_extra` | array | No | Ver [`EXPECTATIVAS_FICHADA_SALIDA_MOMENTANEA_V2.md`](./EXPECTATIVAS_FICHADA_SALIDA_MOMENTANEA_V2.md) |

\*Recomputable; puede materializarse para lectura rápida.

---

## 3. Estructura `segmentos[]`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `segmento_id` | string | Id del turno en `cfg_regimen_horario.turnos_disponibles` (dinámico, no M/T/N fijo) |
| `ingreso_iso` | ISO 8601 | Inicio del tramo |
| `egreso_iso` | ISO 8601 | Fin del tramo |
| `fecha_base` | YMD | Día al que pertenece el segmento |
| `fecha_fin_real` | YMD | Día real de egreso si cruza medianoche |
| `cruza_medianoche` | boolean | |
| `persona_titular_id` | `per_*` | Dueño del tramo en plan base |
| `persona_ejecutante_id` | `per_*` | Quien ejecuta tras overrides |
| `origen_segmento` | enum | `plan_base` \| `override_cobertura` \| `licencia_ajuste` |
| `tipo_compensacion_id` | string | Si origen cobertura → FK `cfg_tipo_compensacion_cobertura` |
| `flags_liquidacion` | map | Opcional, ej. `es_guardia_festiva` desde metadata del turno |

---

## 4. Override `cobertura_parcial`

Entrada en `overrides_turno[]`:

```json
{
  "tipo_override_id": "cfg_tov_01KSN4ZJPXNNGSY07ZVXPQSSE5",
  "tipo_compensacion_id": "cfg_tcc_01KSN4ZJPJZ6H3ARPEX750YBTH",
  "persona_origen_id": "per_XX",
  "persona_cobertura_id": "per_YY",
  "segmentos_cubiertos": ["<segmento_id_regimen>"],
  "motivo": "texto obligatorio"
}
```

Reglas:
- Recalcula capa teórica de **XX** y **YY** ese día.
- Un segmento activo → un solo `persona_ejecutante_id`.
- Rechazar si `vis_*.estado_periodo_liquidacion_id === cfg_epl_liquidado_cerrado`.

---

## 5. Clasificación calendario vs operativo

- **Clasificación calendario** (`clasificacion_dia_calendario_id`): hábil, fin de semana, feriado, asueto, institucional — para liquidación/fichadas futuras.
- **Tipo día operativo** (`tipo_dia`): lo que el agente debe cumplir según plan/override.
- Un feriado con turno por override mantiene `clasificacion` festiva y puede tener `tipo_dia` laborable.

---

## 6. Freeze de período

En `vistas_grilla_mes_agente/{vis_id}`:

- `estado_periodo_liquidacion_id` → `cfg_estado_periodo_liquidacion`
- Ver [`RFC_CIERRE_PERIODO_LIQUIDACION_V2.md`](./RFC_CIERRE_PERIODO_LIQUIDACION_V2.md)

---

## 7. Addendum Delta v2 (resumen)

- Timestamps ISO en segmentos; no nombres fijos M/T/N en contrato.
- Read model `vis_*` para UI; no barrer `asi_*` en grilla.
- Epic siguiente: outbox + `enviarAccionesAsistencia` — [`EPIC_CACHE_LOCAL_ASISTENCIA_V2.md`](./EPIC_CACHE_LOCAL_ASISTENCIA_V2.md) (pendiente de redacción; ver plan auditoría en repo).

---

## 8. Código espejo

- Zod: `web/src/schemas/capaTeoricaSegmentos.schema.js`
- JSDoc: `functions/modules/asistencia/schemas/capaTeoricaSegmentos.contract.js`
