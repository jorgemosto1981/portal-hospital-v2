# Simulación de situaciones — HLg, plan, turno (override) e impactos GSO

**Alcance:** evaluación **conceptual** (sin codificar) según arquitectura V2, acta [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md) y [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md).  
**Lectura clave:** [`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md), [`MANUAL_CAPAS_ORQUESTACION_BORRADOR.md`](./MANUAL_CAPAS_ORQUESTACION_BORRADOR.md), [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md).

**Leyenda impacto**

| Símbolo | Capa / artefacto |
| :--- | :--- |
| **H** | `hlg_*` (dotación grupo + régimen) |
| **P** | `plt_*` (plan mensual; `grilla_aprobada` al habilitar) |
| **V** | `vis_{YYYY}_{MM}_per_*_gdt_*` (capa 1 + `eventos[]` capa 3) |
| **A** | `asi_*` (`capa_teorica_por_grupo[gdt]`, `overrides_turno[]`) |
| **GSO** | Calendario licencias (equipo / titular) |
| **L** | Licencias / solicitudes (MDC → `eventos[]`; **no** borradas por purge teórico) |

---

## 0. Reglas transversales (recordatorio)

1. **Plan habilitado > HLg** para días cubiertos por plan **planificado** en ese `gdt` (foto del mes).
2. **Purge HLg** limpia **solo capa 1** hacia adelante en ese `gdt`; **L** se preserva (acta P5, Q3-2).
3. **Override** gana sobre plan y régimen para ese día en **A** (y se refleja al materializar **V**).
4. **Celda blanca en GSO = error**; **no operar** (US-16). Hueco de plan = replan (Q9-1 B), no override de rutina.
5. **Abrir calendario equipo** puede **materializar** el mes del grupo → cambia **V** sin que RRHH “tocara” plan (Q9-5 → ⚠️ si hay **L** desalineada).

---

## A. Historial laboral en grupo (`hlg_*`)

### A1 — **Crear** HLg nueva (mismo `gdt`, agente sin dotación previa en el mes)

| Paso | Qué hace RRHH | Impacto |
| :--- | :--- | :--- |
| 1 | Alta `hlg_*`: `fecha_desde`, régimen, grupo | **H** vigente desde corte |
| 2 | — | **P** no cambia hasta jefe arme plan |
| 3 | Materialización (al abrir GSO, habilitar plan, job o admin) | **V/A**: capa 1 aparece según régimen (fijo/rotativo/planificado si ya hay **P** habilitado) |
| **GSO** | Agente puede **entrar en filas** del equipo si el listado incluye personas con **V** o plan | Sin **L**: turnos/F/NL según teoría |
| **Riesgo** | Mes ya con **P** habilitado sin ese agente en `agentes[]` | Agente **no** está en plan → teoría puede venir solo de régimen, **no** de celdas del plan |
| **Acción RRHH** | Incorporar agente al plan (borrador → habilitar) o esperar mes siguiente | Evita mezcla “en HLg pero no en plan” |

### A2 — **Modificar** HLg (cambio de `regimen_horario_id` o fechas, sin baja)

| Paso | Impacto |
| :--- | :--- |
| Cambio régimen | Purge/materialización según política de datos laborales: **capa 1** recalculada desde fecha efectiva en **V/A** para ese **gdt** |
| **P** habilitado existente | Plan **sigue** gobernando días del plan para agentes **planificados** en **P**; régimen nuevo afecta días **fuera** de celda plan o agentes no planificados |
| **L** | Intacta; si teoría cambia → **⚠️** (Q9-4/5) en días con licencia |
| **GSO** | Puede verse cambio de horarios sin aviso de “plan” si solo cambió **H** → toast materialización (P6) + ⚠️ |

### A3 — **Cerrar** HLg (`fecha_hasta` = D)

| Paso | Impacto |
| :--- | :--- |
| Cierre | **Purge teórico** desde **D+1** inclusive en ese **gdt** ([`PLAN_GRILLA_MULTI_HLG_V2.md`](./PLAN_GRILLA_MULTI_HLG_V2.md) §19 orientativo) |
| **V** | Días ≥ D+1: `no_laborable` / sin `rda_*` por dotación (ej. CHAPARRO junio Sala) |
| **L** | **Preservada** en `eventos[]`; hint 📅 Q3-2 |
| **P** | Si el agente **sigue** en plan habilitado del mes (error de proceso) | Incoherencia: plan dice turno, **V** dice NL → **⚠️** fuerte; corregir **P** (sacar agente o replan) |
| **GSO** | No blanco si **NL** o licencia pintan la celda; **no operar** turno en NL post-cierre |

### A4 — **Eliminar** HLg (baja de asignación a grupo)

| Paso | Impacto |
| :--- | :--- |
| Eliminación | Purge desde **`fecha_inicio`** del HLg eliminado (más amplio que cierre) |
| **V/A** | Rango afectado pierde teoría de ese **gdt** |
| **L** | Sigue visible (histórico licencias del tramo) |
| **P** | Revisar que el agente no figure en plan futuro del **gdt** |

### A5 — **Volver a crear** HLg (reingreso al mismo `gdt` tras cierre)

| Paso | Impacto |
| :--- | :--- |
| Nueva **H** con `fecha_desde` = D2 | Dotación activa desde D2 |
| Tramo D..D2-1 | Sigue **NL** + licencias históricas (📅) |
| Desde D2 | Materialización llena capa 1; si hay **P** habilitado que incluye al agente → alinea a plan |
| **Licencias** en D2+ | Motor valida al solicitar; si teoría cambia después → ⚠️ |

### A6 — Dos HLg **simultáneas** distinto `gdt` (multicargo)

| Impacto |
| :--- |
| Un **`vis_*` por `gdt`**; no fusionar en un solo calendario |
| GSO equipo de Sala **no** muestra teoría de Portería |
| **L** con `grupo_trabajo_id_ancla` → escenario **E** (🔗 otro sector) |

---

## B. Plan mensual (`plt_*`) — turnos “oficiales” del mes

### B1 — **Crear** plan borrador (mes + `gdt`)

| Impacto |
| :--- |
| **P**: `BORRADOR`; **V/A** operativo **no** cambian hasta habilitar |
| **GSO**: sigue teoría del último **P** habilitado o régimen |
| Validación **US-9** (futura): no permitirá habilitar con huecos |

### B2 — **Modificar** celdas en borrador / `EN_REVISION`

| Impacto |
| :--- |
| Solo **P.agentes[].dias** |
| **VER plan** (borrador) muestra cambios; **GSO** operativo **sin** cambio hasta habilitar |
| Licencias ya proyectadas en **V** pueden quedar desalineadas con borrador → normal hasta habilitar |

### B3 — **Habilitar** plan (RRHH)

| Impacto |
| :--- |
| **P** → `HABILITADO`; snapshot **`grilla_aprobada`** |
| **`materializarGrupoMes`** para el `gdt` → **V/A** capa 1 alineada al plan |
| **L**: **no** se borran |
| Si había huecos (hoy permitido en código) | Celdas **blanco** o hueco en GSO → **error** acta; **US-17** remediación |
| Piloto junio Sala OK | `plt_01KT9…` 0 huecos → GSO verde/gris/rosa |

### B4 — **Revertir** plan (`HABILITADO` → `EN_REVISION`)

| Impacto |
| :--- |
| **P** editable; **V/A** **no** se revierten solos al borrador |
| **GSO** sigue mostrando última materialización del plan **habilitado anterior** hasta nueva habilitación |
| Jefe corrige grilla; RRHH habilita de nuevo → **B3** |

### B5 — **Eliminar** plan (`eliminado: true`)

| Impacto |
| :--- |
| Slot grupo+mes liberado para otro `plt_*` |
| Callable intenta **desmaterializar** mes afectado (warnings si falla) |
| **V**: teoría del mes puede quedar vacía o régimen/HLg según worker |
| **L**: permanece |
| Planes históricos junio Sala (`plt_01KSX…`, `plt_01KSSPY…`) | Solo auditoría; vigente `plt_01KT9…` |

### B6 — **Volver a crear** plan mismo mes (tras eliminar anterior)

| Impacto |
| :--- |
| Nuevo `plt_*`; flujo B1→B3 |
| Comparar con acta: **no** huecos; verificar **L** vs nueva teoría (⚠️) |
| Caso real junio 2026 | Tercer plan = vigente correcto |

---

## C. Turno táctico — override / cobertura (GSO)

> Política acta **Q9-1 B**: no sustituye **replan** del mes; solo **urgencias** (definición pendiente en capacitación).

### C1 — **Crear** override (cambio de turno / cobertura)

| Impacto |
| :--- |
| **A**: `overrides_turno[]` append; motivo texto libre (Q9-2 A) |
| Materialización día/rango → **V** con teoría = override |
| **P** y **grilla_aprobada** **no** se reescriben (VER plan distinto de operativo) |
| **L** | Si contradice → ⚠️ + US-14 (bandeja / override / plan) |
| Mes cerrado 🔒 | Bloqueado (P8) |

### C2 — **Modificar** override

| Impacto |
| :--- |
| Según implementación: nuevo registro o invalidar anterior (soft-delete) |
| Re-materializar día; **⚠️** si cambia respecto de **L** |

### C3 — **Eliminar** override (soft-delete)

| Impacto |
| :--- |
| Override `eliminado: true`; auditoría conservada |
| Teoría vuelve a **P** > **H** > régimen tras materializar |
| Puede **aparecer** ⚠️ si licencia se aprobó bajo override y ahora vuelve plan distinto |

### C4 — **Volver a crear** override tras eliminar

| Impacto |
| :--- |
| Igual C1; historial muestra cadena de cambios |

### C5 — Override sobre día **INCOMPLETO** o **blanco** (simulación política)

| Situación | Impacto esperado **post-acta** (objetivo US-16) |
| :--- | :--- |
| Celda **blanca** | **Prohibido** operar; error sistema |
| Celda hueco plan (`laborable` sin turno) | **Prohibido** override de rutina; derivar **B4** replan |
| **As-built hoy** | Si `tieneDatos` false, celda disabled — aún puede haber blanco visual |

---

## D. Matriz cruzada — “¿Qué manda?” en GSO (día D, un `gdt`)

| Orden | Fuente | Cuándo |
| :---: | :--- | :--- |
| 1 | Override activo **A** | Cobertura / cambio puntual C1 |
| 2 | **P** habilitado celda D | Agente en plan planificado |
| 3 | **H** + régimen | Sin celda plan o agente fijo/rotativo |
| 4 | Calendario institucional | Feriado/asueto |
| — | **`eventos[]`** | Siempre visible si existe (**L**); no borrado por purge |

---

## E. Escenarios compuestos (timeline narrativo)

### E1 — Cerrar HLg a mitad de mes con LAO ya aprobada

1. Agente con LAO días 10–20; HLg cerrada día 15.  
2. **Purge** desde 16: **V** = NL; LAO sigue en **eventos**.  
3. **GSO**: días 16–20 LAO + NL + 📅; días 10–15 LAO + turno si plan lo tenía.  
4. **⚠️** si días 16–20 la licencia asumía guardia (Q9-4).  
5. **Acción**: bandeja licencia / ajuste artículo (US-14), no override masivo.

### E2 — Habilitar plan correcto tras mes con huecos (remediación US-17)

1. Plan viejo con huecos → blancos (incidente MOSTO).  
2. Eliminar/revertir; plan nuevo sin huecos; habilitar.  
3. **V** alinea; **L** (64-A) sobre franco día 11.  
4. **GSO**: F + código licencia; sin blanco.  
5. **Sin** obligación de ⚠️ en día 11 si franco fue intención al replan (Q3-1: sin cambio teoría vs licencia conflictiva).

### E3 — Abrir equipo RRHH solo para “mirar” (sin tocar plan)

1. `listarVistaGrillaMesPorGrupo` → `materializarGrupoMes`.  
2. Corrige **V** desactualizada (ej. feriado nuevo).  
3. Agente con licencia antigua → **⚠️** (Q9-5 A) + toast (P6).  
4. No es error si la teoría **realmente** cambió.

### E4 — Modificar HLg régimen + mismo mes plan ya habilitado (agente planificado)

1. Cambio régimen en **H**.  
2. Días del **plan** siguen mandando para celdas planificadas.  
3. Días sin celda o fuera de vigencia plan → nuevo régimen.  
4. Revisar **L** en días afectados fuera de plan.

### E5 — CHAPARRO: eliminar del plan + HLg ya inactiva

1. No está en `plt_01KT9…`.  
2. **V** junio = `no_laborable`.  
3. No debe aparecer en tabla equipo (o solo NL si listado por **V** huérfano).  
4. No confundir con hueco de plan.

---

## F. Impactos en pantallas (checklist RRHH / jefe)

| Pantalla | HLg crear/modificar | HLg cerrar/eliminar | Plan habilitar | Override |
| :--- | :--- | :--- | :--- | :--- |
| **Calendario licencias equipo** | Nuevas filas / horarios tras mat | NL + 📅 + **L** | Cambio masivo teoría mes | Cambio puntual día |
| **VER plan** | No | No | Foto **P** | No refleja override |
| **Editor plan** | Incorporar agente | Quitar agente del mes | Grilla completa US-9 | N/A |
| **Modal día GSO** | Teoría post-mat | Hint purge | Enlace replan (US-14.3) | Cambio / cobertura |
| **Titular** | Su `vis_*` por cargo | Igual por **gdt** | Igual | Si política rol |

---

## G. Brechas as-built que amplifican impactos

Ver [`ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md`](./ANALISIS_APP_VS_CRITERIOS_GSO_CONFLICTOS_V2.md):

| Si ocurre… | Sin US-9 / US-1 / US-3 |
| :--- | :--- |
| Habilitar plan con huecos | Blancos operables (error acta) |
| Purge HLg + licencia | Licencia visible pero sin ⚠️ ni 📅 unificado |
| Teoría cambia al abrir equipo | Toast parcial; sin ⚠️ en celda |
| Jefe usa override para “arreglar mes” | Permitido en código; **prohibido** en acta Q9-1 B |

---

## H. Orden recomendado de operación (RRHH / jefe)

1. **Dotación:** HLg alta/cierre (purge consciente de fechas).  
2. **Plan:** borrador completo → enviar → habilitar (sin huecos).  
3. **Excepción del día:** override solo urgencia.  
4. **Licencias:** bandeja; si ⚠️ → US-14 (no tapar con override estructural).  
5. **Verificación:** abrir GSO equipo → confirmar **sin blancos** + licencias visibles.

---

**Fin del documento**
