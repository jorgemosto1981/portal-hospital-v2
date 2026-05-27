# RFC — Cierre de período para liquidación V2

**Estado:** borrador aprobado con epic turnos compuestos.  
**Campo:** `vistas_grilla_mes_agente.estado_periodo_liquidacion_id` → `cfg_estado_periodo_liquidacion`.

---

## 1. Valores

| codigo_interno | id | Efecto |
|---------------|-----|--------|
| ABIERTO | `cfg_epl_01KSN4ZJPTDMSK2K7AR2SV4B1R` | Mutaciones permitidas (jefe/RRHH según rol) |
| CONCILIADO | `cfg_epl_01KSN4ZJPVQ8GPKGNZV7HM9A2E` | Warnings; mutaciones solo RRHH |
| LIQUIDADO_CERRADO | `cfg_epl_01KSN4ZJPVJE8C6X1VS2HQSR20` | Rechazar overrides, coberturas, replanificación del mes |

---

## 2. Callables (futuro)

- `cerrarPeriodoLiquidacion` — solo RRHH; set `estado_periodo_liquidacion_id`, auditoría `periodo_cerrado_en`, `periodo_cerrado_por_persona_id`.
- `reabrirPeriodoLiquidacion` — solo RRHH con motivo.

---

## 3. APIs que deben respetar freeze

- `registrarCambioTurno` / eliminar override
- `cobertura_parcial` (nuevo)
- `guardarPlanTurnoServicio` del período afectado
- `enviarAccionesAsistencia` (epic caché) — validar por cada persona/fecha del batch

---

## 4. UI

- Badge `estado_periodo_label` en bandeja/planificación (DD/MM/AAAA en fechas de cierre).
- Mensaje claro en español al rechazar (sin mostrar id crudo al usuario).
