# Manual borrador — Capas, orquestación y coordinación temporal

**Estado:** borrador de análisis (no normativo hasta validación RRHH)  
**Fecha:** 2026-05-29  
**Plan Cursor (SSoT detallado):** `.cursor/plans/análisis_flujo_hlg-grilla_55e1f7c3.plan.md` (§15–22)  
**Handoff reentrada:** [`HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md`](HANDOFF_SESION_2026-05-29_ANALISIS_ORQUESTACION.md)

---

## 1. Capas (regla simple)

| Capa | Qué es | BD principal | Quién escribe |
|------|--------|--------------|---------------|
| **0 Base** | HLg, régimen, plan, calendario | `hlg_*`, `cfg_regimen_horario`, `plt_*` | RRHH / jefe |
| **1 Teórica** | Turno esperado por día | `asi_*.capa_teorica_por_grupo[gdt]`, `vis_*.rda_*` | Worker materialización |
| **2 Overrides** | Cambios de turno | `asi_*.overrides_turno[]` | Usuario / jefe |
| **3 Licencias** | MDC | `vis_*.dias[].eventos[]` | Motor ticketera |
| **4 Fichadas** | Futuro | `asi_*.fichadas[]` | — |
| **GSO** | Pantalla grilla | Lee `vis_*` | **No escribe** |

**Materialización** = recalcular capa 1. **No** borra licencias ni overrides (merge en el día).

**Orden en un día:** Base → teórica → override → licencia (visual) → fichada (futuro).

---

## 2. Ventana automática (fijo / rotativo)

| Disparador | Acción |
|------------|--------|
| **Alta HLg** | Materializar mes actual + mes siguiente (código actual en `catalogosLaborales.js`) |
| **Día 5 de cada mes** | Materializar **M+1** siempre; **M** solo si hubo cambio de base |
| **Cambio régimen / feriado / HLg** | Rematerializar meses **abiertos** en rango afectado |
| **Plan aprobado** | Fuera del auto: `materializarGrupoMes` tras aprobar |

**Propuesta unificar horizonte:** meses que intersectan `[hoy, hoy + 45 días]` (no solo “mes+mes”). El día 5 empuja la ventana cuando avanza el calendario.

**No rehacer** mes ya OK sin cambios (ej. julio materializado en junio al alta HLg → el 5/jul no rematerializa julio salvo evento).

---

## 3. Cierre de período (día 1 / día 5)

| Rol | Regla |
|-----|-------|
| **Usuario / Jefe** | Desde día 1: mes M-1 **solo lectura** en GSO |
| **RRHH** | Día 5: auto-cierre M-1 pendiente (`CFG_EPL_LIQUIDADO_CERRADO` en `vis_*`) |

Mes **cerrado** = no rematerializar, no nuevos overrides/licencias que escriban M-1 (gates pendientes en MDC y `rematerializar*`).

---

## 4. Baja / cierre HLg (purge, no solo rematerializar)

Desde **`fecha_fin + 1`** en el **`gdt`** afectado:

- **Purge** `capa_teorica_por_grupo[gdt]` en `asi_*` y `rda_*` / turno en `vis_*`.
- **Conservar** `eventos[]` de licencias salvo política explícita.
- **No purge** en meses ya cerrados.

**Nueva HLg:** materializar desde `fecha_inicio` + purge `gdt` viejo forward.  
**Baja sin nueva HLg:** solo purge forward.

---

## 5. Licencias y horizonte 45 días

| Campo | Regla propuesta |
|-------|-----------------|
| `fecha_desde` | Máximo **hoy + 45 días** |
| `fecha_hasta` | **Sin tope** (1 día o 1 año) |

**No** materializar automáticamente todo un LAO de 1 año: capa 3 (MDC) pinta mes a mes; capa 1 se llena con job día 5 / cambios HLg.

**Choque actual:** `depende_rda` en `grillaTurnoEntornoGate.js` recorre **todos** los días del tramo → incompatible con tramo anual sin materializar.

**Opciones abiertas (§20 del plan):**

- **L-A:** validar solo `fecha_desde`
- **L-B:** validar por mes calendario
- **L-C:** materializar año (no recomendado)
- **L-D:** `depende_rda: false` en artículos largos

**Régimen:** rodante (vigente el día que se materializa) vs congelado al aprobar (pendiente decisión).

---

## 6. Tabla evento → acción (resumen)

| Evento | Capa 1 | Capa 2–3 | Cerrado |
|--------|--------|----------|---------|
| Alta HLg | Mat ventana | — | — |
| Cierre HLg | Purge gdt fin+1 | — | No purge |
| Feriado | Remat días afectados | — | Bloqueado |
| Plan aprobado | `materializarGrupoMes` | — | — |
| Job día 5 | M+1; M si cambió | — | Skip M-1 |
| Override / licencia | Re-día si aplica | Escribe | Bloqueado |
| Lazy GSO | Si degenerado | — | Bloqueado |

---

## 7. Continuar mañana

Retomar **§20 del plan**: gate `depende_rda`, alinear `validarFechasArticulo.js` a 45d, tabla evento final, manual RRHH 1 página.

**IDs piloto:** MOSTO `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`; Portería `gdt_01KQA9FVEW53JSNTPGX32NWQ5B`; Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`; CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4`; LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB`.

**Deuda:** DEUDA-CT-001 (`REGISTRO_DEUDA_2026-05-30_CAPA_TEORICA_Y_GRILLA.md`).
