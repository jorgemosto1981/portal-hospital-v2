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

### Qué es **materializar** (definición cerrada en repaso)

| Aspecto | Regla |
|---------|--------|
| **Qué hace** | Recalcula **solo capa 1** (teórica) desde capa 0 y escribe `asi_*` + `vis_*` del tramo afectado. |
| **Qué no hace** | No borra licencias (`eventos[]`) ni overrides (merge por día). **No** es purge HLg ni cierre de período. |
| **Trazabilidad** | Cada ejecución debe quedar **identificada e informada** en la app: disparador (alta HLg, día 5, régimen, plan, lazy reparación, RRHH manual), alcance (`per`, `gdt`, mes/es), resultado (éxito / parcial / error). Hoy parcial en `metadata` del worker; **deuda producto:** UI/toast/auditoría unificada en todos los callables. |

**Orden en un día:** Base → teórica → override → licencia (visual) → fichada (futuro).

---

## 2. Ventana automática (fijo / rotativo)

**Ventana operativa rodante:** en todo momento el hospital mantiene teórico materializado para **mes calendario actual (M)** y **mes siguiente (M+1)**.

| Disparador | Acción |
|------------|--------|
| **Alta HLg** | Materializar **M + M+1** (ej. alta en mayo → mayo y junio). Código: `catalogosLaborales.js`. |
| **Días 1–4 del mes** | Movimientos de personal / cambios de grupo: al **cargar HLg** se materializa de nuevo **M + M+1** (puede adelantar el nuevo M+1, ej. julio en junio). |
| **Día 5** (solo **fijo / rotativo**) | Materializar **M+1** **solo si no está ya hecho** (validar antes: no pisar ni escribir de más). **M** solo si cambió la base o snapshot degenerado. |
| **Cambio régimen / feriado / HLg** | Rematerializar meses **abiertos** en rango afectado |
| **Plan aprobado** | Fuera del auto: `materializarGrupoMes` tras aprobar |

**No rehacer** mes ya OK: ej. julio materializado el 2/jun por alta HLg → el **5/jun** el job **omite** julio salvo cambio de base o degenerado.

**Licencias:** tope `fecha_desde` alineado a **M + M+1** (mismos plazos que la ventana teórica automática).

**Nota:** la propuesta alternativa “45 días corridos” queda **archivada**; horizonte de pedidos y capa 1 automática se alinean a **M + M+1** (ver §5).

---

## 3. Cierre de período (día 1 / manual RRHH)

| Rol | Regla |
|-----|-------|
| **Usuario / Jefe** | Desde día 1 del mes: mes M-1 **solo lectura** en GSO |
| **RRHH** | **Cierre manual** del mes M-1 (botón en GSO + callable); estado `CFG_EPL_LIQUIDADO_CERRADO` en `vis_*` |

**Decisión repaso:** **no** automatizar cierre con Cloud Scheduler en la primera entrega (riesgo operativo hasta asimilar bloqueo de rematerialización y MDC sobre M-1). Job día 5 de **liquidación** queda **fase 2**; el día 5 de **materialización** M+1 (§2) es otro proceso.

Mes **cerrado** = no rematerializar, no nuevos overrides/licencias que escriban M-1 (gates: hoy parcial en `cambiosTurno.js`; extender MDC y `rematerializar*`).

---

## 4. HLg — régimen, cierre, eliminación y purge

| Regla | Detalle |
|-------|---------|
| **Régimen en HLg vigente** | **Bloqueado.** Cerrar o eliminar HLg; nueva HLg con el régimen correcto. |
| **Cerrar HLg** | `fecha_fin` (ej. 15/05) → purge teórico desde **`fecha_fin + 1`** (16/05 inclusive). |
| **Eliminar HLg** | Purge teórico desde **`fecha_inicio`** del HLg (inclusive adelante). |
| **Qué purga** | Solo capa 1 (horarios/turnos de materialización). **No** licencias, overrides, fichadas. |
| **UX** | Warning con `purge_desde`, impacto, turnos mensuales si aplica; **doble aceptación**. |

**Nueva HLg:** purge `gdt` viejo + materializar M+M+1 desde `fecha_inicio`.  
**Turnos mensuales:** si hay plan del grupo y entra usuario nuevo → warning + plan paralelo solo para el/los nuevos; quienes ya estaban **sin cambios** (ver plan §19.6).

---

## 5. Licencias y horizonte (alineado a ventana M + M+1)

| Campo | Regla (repaso cerrado) |
|-------|-------------------------|
| **`fecha_desde`** | No más allá del **fin del mes siguiente** al mes en curso (misma ventana que capa 1 automática: solo se puede pedir licencia donde el teórico del régimen fijo/rotativo está previsto materializarse). |
| **`fecha_hasta`** | **Sin tope** por horizonte (1 día o 1 año). |

**Capa 3:** MDC pinta licencias mes a mes; **no** pre-materializar un año entero de capa 1 por cada LAO.

| Validación del artículo | Al crear solicitud |
|-------------------------|-------------------|
| Calendario institucional / días hábiles / días corridos | **Permitido** (sin gate RDA día a día). |
| **`depende_rda`** | **Bloqueado** si falta RDA en anclajes del pedido; si `fecha_hasta` es lejana, validar **`fecha_hasta`** (no leer toda la cadena día a día). |

**Excepcional:** si `fecha_hasta` va más allá del teórico ya materializado y RRHH necesita igualmente el pedido → **regla diferida**: resolver cuando exista un caso concreto (plan §20.4); no materializar masivo por defecto.

**LAO + cambio HLg:** rodante — solo capa 1 cambia; LAO intacta; al reintegro, `gdt` vigente + materialización. **`vis` mínimo:** MDC crea/merge; materialización añade `rda_*` en el **mismo** doc (§20.6 plan).

---

## 6. Tabla evento → acción (para manual RRHH)

**Tipos:** **A** = cambio de base (HLg, régimen, calendario, tiempo); **B** = operativo (licencia, override, cierre período); **C** = reparación (lazy GSO).

| Evento | Tipo | Capa 1 | Capa 2–3 | Plan / notas | Si período cerrado |
|--------|------|--------|----------|--------------|-------------------|
| Alta HLg | A | Mat **M+M+1**; informar | — | Anotación opcional | — |
| Cerrar HLg | A | Purge desde **fin+1**; doble OK | — | §19.6 turnos mensuales si usuario nuevo | No purge mes cerrado |
| Eliminar HLg | A | Purge desde **fecha_inicio** HLg | — | Idem | No purge mes cerrado |
| Nueva HLg | A | Mat + purge `gdt` viejo | — | Régimen solo vía HLg nueva | — |
| Feriado institucional | A | Remat días afectados | — | — | Bloqueado |
| Aprobar plan mensual | A | `materializarGrupoMes` | — | `grilla_aprobada` fija | — |
| Job día 5 (fijo/rot) | A | M+1 si falta; M si cambió base | — | ≠ cierre liquidación | Skip M-1 cerrado |
| Día 1 calendario | A | — | UI M-1 solo lectura (no jefe) | — | — |
| Cierre período RRHH | B | — | — | Manual fase 1 | Congela M-1 |
| Override turno | B | Re-día | Escribe OVR | — | Bloqueado |
| Licencia (MDC) | B | — | `eventos[]`; `vis` mínimo OK | Rodante: LAO no se toca si cambia HLg | **Nuevas** en M-1 cerrado: no. **En trámite:** hasta aprobar/rechazar |
| Lazy GSO | C | Si degenerado | — | Acotar si día 5 OK | Bloqueado |

**SSoT detallada:** plan §21.

---

## 7. Grilla operativa (GSO) — quién ve qué (decisión producto)

| Rol | Menú (objetivo) | Capas visibles en GSO |
|-----|-----------------|------------------------|
| **RRHH** | **Primero** — dueño de la grilla operativa | Teórica, overrides, licencias; fichadas **reales** y auditoría cuando existan |
| **Jefe** | **Después** de validación RRHH — acceso similar | Teórica, overrides, licencias, **fichadas esperadas** (teórico); **resultado** auditoría RRHH; **no** fichadas reales del reloj |

---

## 8. Siguiente fase (post-repaso documental)

Implementación priorizada en plan §22: gate anclas `depende_rda`, purge HLg, cierre manual período, UX materializar, P0 piloto.

**IDs piloto:** MOSTO `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ`; Portería `gdt_01KQA9FVEW53JSNTPGX32NWQ5B`; Sala `gdt_01KQA6QCA8TDQK9YBTHKYA4R2V`; CHAPARRO `per_01KR3HD24AMJ6YX3N7B3GPAZJ4`; LOKITO `per_01KQQJA5Q1VKBTJ74RHQ0HSHSB`.

**Deuda:** DEUDA-CT-001 (`REGISTRO_DEUDA_2026-05-30_CAPA_TEORICA_Y_GRILLA.md`).
