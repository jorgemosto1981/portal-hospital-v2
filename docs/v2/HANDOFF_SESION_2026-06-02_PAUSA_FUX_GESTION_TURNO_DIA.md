# Handoff — F-UX Gestión turno del día (A/B/C)

**Fecha pausa inicial:** 2026-06-02  
**Spec cerrada:** 2026-06-03 (sesión aclaraciones A/B/C + §9)  
**Pausa frontend outbox:** 2026-06-03 (tarjetas grupo×mes, labels embebidos, QA banner)  
**Rama:** `feat/epic-multi-hlg-fase1-execution`  
**Estado:** F-UX.3 **frontend cerrado** — outbox v2 legible + banner por tarjeta · **backend Fase 6 pendiente**  
**RFC payloads:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md)  
**Retomar:** implementar [`RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md`](./RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md) · luego Fase 6 batch  

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
| `adicional` | **Horas adicionales** | 1 agente; **agrega** turno extra; trámite RRHH → jefe superior |

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
| **C** | **No** exige turno calculado → wizard muestra **solo C**. Con turno calculado → A/B/C. |

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
- Outbox → `cobertura_parcial` · **RFC:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) §3.1 (amendment 2026-06-03: A-N1…A-N5, A-REG, A-TIPO, A-BATCH). **UI + outbox + QA navegador ✅**; batch **A-BATCH** diferido (§3.1.4 RFC).

---

## 5. Flujo B — Cambio de turno propio

- **Un agente**, **mismo mes**.
- **Origen:** quita segmento(s) elegidos (compuesto: uno / otro / ambos; no fraccionar horas dentro del segmento).
- **Destino:** cualquier día del mes (incl. **mismo día** — corrimiento intra-día B-N5); **incorpora** sin pisar tramos ya presentes.
  - Cantidad destino = cantidad origen; combinación **libre** entre simples del régimen (M+T, T+N, M+N… — **sin exigir contigüidad** B-N6).
  - Destino **M+T**, llega **M** → solo puede agregar **N** (no M ni T) → ej. **M+T+N**.
  - Destino ya tiene **T**, no puede agregar **T**; sí **M** o **N**.
  - Destino **franco / no laborable** → pasa a laborable con turno imputado.
  - Destino **feriado** → **sigue feriado** (color celda + flag en registro).
- **Origen tras op:** **franco total** si se quitaron todos los tramos; **saldo parcial** si no (ej. M+T+N → quitar N → saldo M+T); auditoría **motivo + id op** (B-N4).
- Encadenable con otras B/A/C (preview acumulado, tope 24 h).

**Contrato cerrado:** outbox `reemplazo` según [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) §3.2 (amendment 2026-06-03: B-N5…B-N7). UI + outbox ✅; batch `B-BATCH-1` diferido hasta consolidar con Flujo A (§2 RFC).

---

## 6. Flujo C — Horas adicionales

- **Solo agrega** turno adicional; aplica en franco, feriado, no laborable y laborable.
- **Campos jefe (C-N1):** turno régimen + motivo. **Sin** horas tipeadas.
- **C-SNAPSHOT:** outbox incluye `estado_previo` (foto del día). Sin horas extra declaradas por el jefe (**C-FICHADAS**).
- **Etapa 1 (registro):** outbox/batch desde grilla (jefe).
- **Etapa 2 (validación):** **RRHH primero** — cruza fichadas, valida turnos, fija/edita horas extra.
- **Etapa 3 (autorización):** **jefe superior** — aprueba o rechaza sobre datos ya validados por RRHH.
- **Etapa 4:** imputación a bolsa de horas (factor simple/doble según naturaleza del día).
- **RFC:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) §3.3 (C-SNAPSHOT, C-FICHADAS, **C-WORKFLOW** 2026-06-03). UI ✅.

---

## 7. Wizard entrada

**Botón:** «Gestionar turno de este día» → paso 1:

| | Título | Subtítulo |
|---|--------|-----------|
| A | Intercambio de guardia | Dos agentes; carga equivalente; pueden ser días distintos |
| B | Cambio de turno propio | Traslado entre días; no pisa lo ya en destino; origen queda franco |
| C | Horas adicionales | Agrega turno extra; RRHH valida fichadas → jefe superior autoriza |

Cancelar no toca outbox. Desaparecen botones legacy y toggle reemplazo/adicional.

### Matriz ayuda in-app

```
¿Dos agentes, mismo mes/grupo, intercambian carga equivalente
   (turno + fichada esperada en ambos días)?
  SÍ → A

¿Un agente traslada turno(s) a otro día sin pisar segmentos en destino?
  SÍ → B

¿Agregar turno extra (RRHH valida fichadas, jefe superior autoriza después)?
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
| C10 | Circuito C: registro jefe → **RRHH** (fichadas, validación, horas) → **jefe superior** (autorización final) → bolsa horas. **No** superior antes de RRHH. |
| 11 | Materializar **por celda** |
| 12 | Selector día móvil + tap PC |

### Ejemplos validados (usuario 2026-06-03)

| Caso | Comportamiento esperado |
|------|-------------------------|
| **B-N1** | Día 10 tiene **M**. Borrador 1: trae **T** del día 5 → preview día 10 = **M+T**. Borrador 2: agregar **N** solo si no choca con preview (**M+T** → **N** permitido). |
| **C** | Día 8 teórico **M**; jefe registra adicional **N** + motivo «Refuerzo»; **sin** hs en formulario. RRHH cruza fichadas y fija horas; jefe superior autoriza con ese expediente. |
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

## 10. Entregables implementación

| # | Entregable | Estado |
|---|------------|--------|
| 1 | Shell modal + capabilities + gate + materializar celda | ✅ |
| 2 | Wizard paso 1 (A/B/C) + ayuda in-app | ✅ |
| 3 | Flujo **B** (preview + outbox RFC §3.2) | ✅ UI · batch diferido |
| 4 | Flujo **A** (emparejamiento + dos fechas + outbox §3.1) | ✅ UI + QA navegador · batch diferido |
| 5 | Flujo **C** (turno + motivo + snapshot + solo-C sin turno calc.) | ✅ UI + QA navegador · batch diferido |
| 6 | Banner outbox etiquetas legibles A/B/C v2 | ✅ |
| 7 | `helpContent.js` gestión turno A/B/C | ✅ |
| 8 | QA combinaciones (A, B, C, C sin materializar) | ✅ |
| 9 | Banner: título función (no badge A/B/C), quitar/limpiar/enviar con confirmación | ✅ |
| 10 | Banner: tarjeta por **grupo × mes/año** + labels persona/grupo embebidos en op | ✅ QA |

**Próximo bloque (orden):** §12 visualización grilla → Fase 6 backend A-BATCH + B-BATCH-1 + C-BATCH (`cambiosTurno.js`).

---

## 11. Cierre sesiones

| Ítem | Estado |
|------|--------|
| Spec producto A/B/C + §9 | ✅ 2026-06-03 |
| RFC F4 ampliado payloads | ✅ [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) |
| Entregable 1 shell + gate + materializar celda | ✅ Código (deploy callable pendiente) |
| Entregable 2 wizard A/B/C | ✅ UI paso 1 + enlace modales |
| Entregable 5 flujo C (UI/outbox §3.3 + gate solo-C) | ✅ QA navegador |
| Entregable 6–7 outbox labels + helpContent | ✅ commit `19b411e` |
| Entregable 9–10 banner outbox (función, tarjeta, labels) | ✅ 2026-06-03 · QA OK |
| F4 batch en rama | ✅ legacy · v2 batch Fase 6 pendiente |
| Visualización grilla post-aplicar A/B/C | ⏳ **Antes de backend** — §12 |
| PR → master | ⏸️ Paralelo |

**Próximo paso:** §12 → Fase 6 backend (A-BATCH, B-BATCH-1, C-BATCH) — ver RFC §3 y §5.

---

## 12. Visualización en grilla — spec cerrada (ANTES del backend)

> **Gate de producto:** spec visual y consulta ligera **cerrados** 2026-06-04. Implementar UI según amendment antes de confiar en paridad total con batch v2.

**Documento canónico:** [`RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md`](./RFC_F4_AMENDMENT_VISUAL_GRILLA_GESTION_TURNO.md)

| Tema | Decisión cerrada |
|------|------------------|
| Preview | Tres estados; sin iconos en celda; `proyectarDiaConOpsPendientes` en grilla; borde ámbar + diff ± + F:2\* |
| Post-batch | Celda limpia; `capa_teorica` + F:n como materializado; C unificado en grilla; trámite horas RRHH fuera de celda |
| Reconocimiento | Modal «Cambios de turno en este día» + Anexo A; append `consultas_gestion_turno` en `asi_*` al abrir (solo si hay overrides) |

### Siguiente paso (implementación)

1. Wire grilla mes equipo + modal detalle (amendment §7).
2. Fase 6 backend (`cambiosTurno.js` A-BATCH, B-BATCH-1, C-BATCH) alineado al amendment §3.5 y §4.

### Arranque otra PC

```bash
git pull origin feat/epic-multi-hlg-fase1-execution
npm install
```

Leer este handoff §12 + [`PENDIENTES_PROXIMA_SESION.md`](./PENDIENTES_PROXIMA_SESION.md) bloque F-UX.
