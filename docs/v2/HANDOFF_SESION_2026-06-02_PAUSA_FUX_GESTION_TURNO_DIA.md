# Handoff — F-UX Gestión turno del día (A/B/C)

**Fecha pausa inicial:** 2026-06-02  
**Spec cerrada:** 2026-06-03 (sesión aclaraciones A/B/C + §9)  
**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**Estado:** producto/UI **cerrado** — **sin implementar** hasta OK explícito F-UX.3  
**Retomar:** OK implementación → RFC F4 ampliado (A dos fechas, B origen/destino) → §5 entregables  

**Relación:** F4 [`RFC_CACHE_LOCAL_ASISTENCIA_V2.md`](./RFC_CACHE_LOCAL_ASISTENCIA_V2.md) · segmentos [`CAPA_TEORICA_SEGMENTOS_V2.md`](./CAPA_TEORICA_SEGMENTOS_V2.md) · pendientes [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md)

---

## 1. Contexto (por qué replanteamos)

- F3 cerrada · F4 outbox/batch parcial en rama.
- UI legacy (dos botones + toggle reemplazo/adicional) probada con problemas: sin materializar, error `internal`, UX móvil pobre.
- **Decisión:** menú dinámico por **celda día** sobre **caché front** + **Aplicar cambios** (mínimas lecturas/escrituras). Plantilla para futuras acciones GSO.
- **Roles etapa 1:** RRHH y **jefe** con mismas capabilities; etapa 2 = restringir por acción sin reescribir flujos.

---

## 2. Términos UI ↔ backend

| Tipo backend | Nombre UI | Actores |
|--------------|-----------|---------|
| `cobertura_parcial` | **Intercambio de guardia** | 2 agentes; swap segmentos equivalentes (pueden ser **días distintos**, mismo mes) |
| `reemplazo` | **Cambio de turno propio** | 1 agente; traslada segmentos origen → destino sin pisar destino; origen → franco auditado |
| `adicional` | **Horas adicionales** | 1 agente; **agrega** turno extra; trámite RRHH posterior |

**No confundir:** A ≠ B (dos personas vs uno). B ≠ C (incorpora/traslada vs **solo suma**). C no pisa teórico; B no borra segmentos inmutables en destino.

---

## 3. Marco transversal

### 3.1 Celda día = unidad mínima

- Resumen de datos (actual) + menú **«Gestionar turno de este día»** → wizard A/B/C.
- **Materializar por celda involucrada** (no recargar mes): CTA «Calcular turno de este día» → actualizar solo esa celda en caché.
- **Outbox:** Agregar a cambios → preview acumulado → Aplicar cambios (batch F4).

### 3.2 Precondición «tiene teórico»

| Acción | Requisito en la celda |
|--------|------------------------|
| **A** Intercambio | Turno **laborable** materializado + **fichada esperada**. **No** franco. **No** no laborable. Feriado: **solo si** cumple turno + fichada (guardia en feriado). |
| **B** | Origen y destino materializables; destino franco/no lab = sin colisión de turnos previos |
| **C** | Materialización según necesidad de leer base del día |

### 3.3 Gate común

| Estado | UX |
|--------|-----|
| Sin materializar (celda involucrada) | Bloqueo + materializar **esa** celda |
| Período cerrado / solo lectura | Sin formulario |
| Error carga | Mensaje operativo (nunca `internal`) |

**Cabecera fija:** agente, fecha, nombre cargo, teórico resumido (ej. «M+T 06–22 · F:2»).

### 3.4 Selección segundo día / destino (UX)

| Entorno | Control |
|---------|---------|
| **Móvil** | Selector **día del mes** del agente + resumen teórico |
| **PC** | Tap celda en grilla + mismo selector alternativo |

### 3.5 Combinaciones A / B / C

- Ops **independientes**, **cualquier orden** en el mismo mes.
- **B-N1:** al «Agregar a cambios», validar contra **grilla + borradores pendientes** (preview acumulado).
- **B-N2:** tope **24 h por día** (al agregar o al aplicar).

### 3.6 Feriado en celda (B-N3)

- **Celda:** fondo/color feriado institucional; **sin texto** extra en celda.
- **Registro persistido** (`asi_*` / override / detalle): debe quedar identificado **feriado** + turno imputado.

---

## 4. Flujo A — Intercambio de guardia

- **Mismo mes estricto**, mismo `gdt`, dos `persona_id` distintos.
- **Días distintos permitidos** (ej. XX día 5 ↔ YY día 12).
- **Swap bilateral** por segmentos; **igualdad de carga horaria** (emparejamiento parcial).
- Ej.: XX **M+T**, YY **T** → en XX elegir **M o T** para emparejar con **T** de YY.
- **Compensación:** default operativo `cfg_tcc_*` (ej. «Intercambio interno»); jefe no elige siempre.
- **Materializar** día XX y día YY si falta.
- Outbox → `cobertura_parcial` · **RFC pendiente:** dos fechas + swap (contrato actual una fecha).

---

## 5. Flujo B — Cambio de turno propio

- **Un agente**, **mismo mes**.
- **Origen:** quita segmento(s) elegidos (compuesto: uno / otro / ambos; no fraccionar horas dentro del segmento).
- **Destino:** cualquier día del mes; **incorpora** sin pisar `turno_id` ya presente en destino.
  - Destino **M+T**, llega **M** → solo puede agregar **N** (no M ni T) → ej. **M+T+N**.
  - Destino ya tiene **T**, no puede agregar **T**; sí **M** o **N**.
  - Destino **franco / no laborable** → pasa a laborable con turno imputado.
  - Destino **feriado** → **sigue feriado** (color celda + flag en registro).
- **Origen tras op:** **franco explícito**; auditoría **motivo + id op** (B-N4: sin nuevo `cfg_*` motivo franco).
- Encadenable con otras B/A/C (preview acumulado, tope 24 h).

Outbox → `reemplazo` · **RFC pendiente:** `fecha_origen`, `fecha_destino`, segmentos, franco origen.

---

## 6. Flujo C — Horas adicionales

- **Solo agrega** turno adicional; no pisa teórico (si hay teórico, turno adicional **≠** teórico).
- **Campos jefe (C-N1):** **turno régimen obligatorio** + **motivo obligatorio**. **No** campo horas en registro (vendrán de **fichadas reales** para evaluación RRHH).
- **Fase 1:** registro outbox/batch. **Fase 2:** burbujeo jefe superior → RRHH evalúa/imputa (módulo aparte).

---

## 7. Wizard entrada

**Botón:** «Gestionar turno de este día» → paso 1:

| | Título | Subtítulo |
|---|--------|-----------|
| A | Intercambio de guardia | Dos agentes; carga equivalente; pueden ser días distintos |
| B | Cambio de turno propio | Traslado entre días; no pisa lo ya en destino; origen queda franco |
| C | Horas adicionales | Agrega turno extra; evaluación RRHH después |

Cancelar no toca outbox. Desaparecen botones legacy y toggle reemplazo/adicional.

### Matriz ayuda in-app

```
¿Dos agentes, mismo mes/grupo, intercambian carga equivalente
   (turno + fichada esperada en ambos días)?
  SÍ → A

¿Un agente traslada turno(s) a otro día sin pisar segmentos en destino?
  SÍ → B

¿Agregar turno extra para trámite posterior RRHH?
  SÍ → C
```

---

## 8. Decisiones — todas cerradas (2026-06-03)

| ID | Decisión |
|----|----------|
| A1 | Franco / no laborable: **no** en A |
| A1b | Teórico A = turno laborable + fichada esperada |
| A-FER | Feriado en A **solo si** turno + fichada |
| A2 | Emparejamiento **parcial** entre días distintos |
| A3 | Compensación: **default** operativo |
| A4 | **Mismo mes** estricto |
| B5–8 | Destino inmutable; compuesto; franco origen; feriado persiste |
| B-N1 | Preview acumulado al agregar |
| B-N2 | Tope **24 h**/día |
| B-N3 | Color feriado en celda; feriado en **registro** |
| B-N4 | Franco origen: motivo + enlace op; **sin** cfg motivo |
| C-N1 | Turno adicional + motivo; **sin** hs en formulario |
| C10 | Dos fases registro / trámite RRHH |
| 11 | Materializar **por celda** |
| 12 | Selector día móvil + tap PC |

### Ejemplos validados (usuario 2026-06-03)

| Caso | Comportamiento esperado |
|------|-------------------------|
| **B-N1** | Día 10 tiene **M**. Borrador 1: trae **T** del día 5 → preview día 10 = **M+T**. Borrador 2: agregar **N** solo si no choca con preview (**M+T** → **N** permitido). |
| **C** | Día 8 teórico **M**; jefe registra adicional **N** + motivo «Refuerzo»; **sin** hs en formulario; RRHH cruza con fichadas después. |
| **Feriado** | 10/jun: celda con **fondo feriado** + turno **T** visible; en persistencia: flag feriado + turno imputado. |

---

## 9. Gaps RFC / backend (antes de codificar)

| Gap | Necesidad producto |
|-----|-------------------|
| A | Dos fechas + swap bilateral segmentos |
| B | Origen/destino, additivo en destino, franco auditado origen |
| C | Payload adicional sin `horas_efectivas` obligatorias en alta jefe |
| F4 batch | Validar preview-equivalente al aplicar; 24 h/día |

Código existente: `useAsistenciaOutbox.js`, `GrillaMesLicenciasPanel.jsx`, `cambiosTurno.js` — extender, no duplicar batch.

---

## 10. Entregables implementación (orden — tras OK)

1. Shell modal + capabilities RRHH/jefe + gate + materialización celda  
2. Wizard paso 1 (A/B/C)  
3. Flujo **B** (validación colisión + preview)  
4. Flujo **A** (emparejamiento + dos fechas)  
5. Flujo **C** (turno + motivo)  
6. `helpContent.js` + errores legibles capa  
7. Banner outbox etiquetas legibles  
8. QA LOKITO + combinaciones B+B  

---

## 11. Cierre sesiones

| Ítem | Estado |
|------|--------|
| Spec producto A/B/C + §9 | ✅ 2026-06-03 |
| UI wizard F-UX.3 | ⏸️ Pendiente OK explícito |
| F4 batch en rama | ✅ · deploy pendiente |
| RFC F4 ampliado | ⏸️ Con implementación |
| PR → master | ⏸️ Paralelo |

**Próximo paso:** confirmación explícita «implementar F-UX.3» → RFC + §10.
