---
name: Alerta divergencia plan vs grilla (UX)
status: backlog
prioridad: media
epic_relacionada: "Confianza operativa / lectura plan histórico"
fuera_de_alcance: "Fase 4 HLg inmutable y purga selectiva (backend)"
depende_de:
  - RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md
  - RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md
fecha: 2026-06-05
---

# RFC UX — Alerta de divergencia estructural (plan aprobado vs grilla operativa)

## 1. Propósito

La arquitectura V2 es **correcta** cuando el **plan mensual** (`plt_*`, `grilla_aprobada`) — foto al habilitar — **no coincide** con la **grilla operativa** (`vis_*` / `asi_*`) tras HLg retroactivas, incorporaciones mergeadas fuera del mes consultado, o dotación operativa no reflejada en la foto histórica.

Este RFC define una **alerta UX opcional** para reducir dudas operativas (**Chaparro en grilla de mayo, ausente en plan de mayo**) sin:

- reabrir edición del plan histórico,
- ni avisar por cada licencia u override (fatiga de alertas).

**No modifica** reglas de materialización, merge ni inmutabilidad del plan.

---

## 2. Principios de producto

| Principio | Regla |
|-----------|--------|
| **Dos capas** | Plan = contrato/foto; grilla = motor vivo. La alerta **explica** el desfase, no lo “corrige”. |
| **Solo desvíos estructurales** | Personas/dotación, no diferencias celda a celda por licencias, feriados aplicados después, overrides puntuales. |
| **Carga a demanda** | Por defecto el detalle del plan carga solo la foto (`grilla_aprobada`). El cruce pesado se dispara **solo** bajo trigger explícito (véase §4). |
| **No invasivo** | Banner/caja unificada **dentro** del modal de detalle; no altera tarjetas duales ni la grilla del modal. |
| **Audiencia** | Primaria: **RRHH**. Secundaria: **jefe** en mes histórico o habilitado (solo lectura). |

---

## 3. Umbrales — qué dispara alerta y qué no

### 3.1 Dispara alerta (`divergencia_estructural: true`)

Al menos una condición en el par **`grupo_id` + `periodo`** del plan abierto:

| Código | Condición | Ejemplo |
|--------|-----------|---------|
| **`DOTACION_EXTRA_OPERATIVA`** | Existe `persona_id` con HLg **activa** y vigente en algún día del mes en ese `gdt`, con régimen **planificado** (o con fila teórica materializada en el mes), que **no** figura en `grilla_aprobada.agentes[]` ni en `plan.agentes[]` de la foto. | Chaparro con HLg desde mayo; plan de mayo aprobado sin Chaparro. |
| **`DOTACION_FANTASMA_EN_FOTO`** | Inversa: persona en la foto del plan pero **sin** HLg vigente en ese `gdt` en todo el mes (asignación deshabilitada / corte retroactivo). | Agente en foto; HLg cerrada o purgada en el mes. |

**Opcional v2 (no bloqueante v1):** `CONTEO_DOTACION` — diferencia de cardinalidad entre conjunto operativo mínimo y conjunto de la foto, con listado de ids (máx. 10 en UI).

### 3.2 No dispara alerta (explícito)

| Situación | Motivo |
|-----------|--------|
| Licencia / LAO / 64-A / MDC en días concretos | Cambio esperado en grilla operativa; no es desvío de dotación. |
| Feriado o calendario institucional posterior a la aprobación | Capa 3 / lectura GSO; no estructural en sentido plan. |
| Override de turno en días puntuales | Gestión operativa; no lista de agentes. |
| Diferencia turno vs celda sin cambio de conjunto de personas | Fuera de alcance v1 (evitar diff masivo). |
| Plan en `BORRADOR` / `ENVIADO` / `plt_inc` activo | La UI dual ya orienta; alerta solo en **principal** `HABILITADO` o **histórico** (`CERRADO` / mes anterior). |

---

## 4. Triggers y rendimiento

### 4.1 Flujo por defecto (sin costo extra)

1. Usuario abre **Ver plan operativo** / detalle histórico.
2. Se muestra `grilla_aprobada` como hoy + texto fijo **“Referencia de lectura”** (educativo, siempre visible en planes habilitados/cerrados).

### 4.2 Flujo con detección (on-demand)

| Trigger | Actor | Acción |
|---------|--------|--------|
| **T1** | RRHH | Botón/link **“Verificar coherencia con grilla operativa”** en el modal de detalle. |
| **T2** | RRHH (opcional config) | Auto-ejecutar T1 al abrir detalle si `claims` incluye rol RRHH y plan `estado ∈ { HABILITADO, CERRADO }`. **Desactivado por defecto** en piloto. |
| **T3** | Jefe | No auto (solo T1 si se expone el botón a jefe en mes histórico). |

### 4.3 Contrato backend sugerido (futuro)

Callable dedicado o extensión de `obtenerVistaPlanTurnoServicio`:

```text
evaluarDivergenciaPlanGrilla({
  plan_id: string,
  modo: "estructural_v1"
}) → {
  divergencia_estructural: boolean,
  codigos: ("DOTACION_EXTRA_OPERATIVA" | "DOTACION_FANTASMA_EN_FOTO")[],
  personas_extra_operativas: { persona_id, persona_label?, hlg_id? }[],  // cap 20
  personas_solo_en_foto: { persona_id, persona_label? }[],               // cap 20
  periodo, grupo_id,
  mensaje_ui_key: string
}
```

**Implementación eficiente:**

- Reutilizar contexto ya existente: personas del grupo en el mes (`listarContextoPlanGrupo` / HLg vigentes), **sin** leer 30×N celdas `vis_*` en v1.
- Comparar **conjuntos** `persona_id`: foto vs HLg+planificado materializable en el mes.
- Timeout / límite: si > 200 personas en grupo, muestrear o devolver solo conteo + “ver grilla”.

---

## 5. Diseño visual (UI)

- **Ubicación:** debajo del título del modal, **encima** de la tabla `grilla_aprobada`, o inmediatamente debajo del aviso ámbar existente de referencia de lectura.
- **Patrón:** una **caja unificada** (borde ámbar suave, fondo `amber-50`), icono ⚠️ opcional, **una** frase principal + lista corta (máx. 5 nombres) + acciones.
- **Acciones:**
  - **Primaria:** “Abrir grilla operativa (mes y grupo)” → ruta RRHH grilla con `gdt` + `periodo` precargados.
  - **Secundaria:** “Entendido” / colapsar (persistencia local opcional por `plan_id`).
- **Mobile:** mismo bloque en columna; sin popover ni segunda modal.
- **Sin alerta:** no mostrar caja vacía ni badge en tarjetas “Planes del período”.

---

## 6. Textos sugeridos (es-AR)

### 6.1 Banner educativo (siempre, sin cruce)

> **Referencia de lectura** — Foto histórica del plan al momento de la aprobación. Puede no coincidir con la grilla operativa vigente si hubo licencias, cambios de asignación o altas posteriores.

### 6.2 Alerta estructural (tras T1/T2 positivo)

**Título:** Coherencia dotación — plan vs operativo

**Cuerpo (DOTACION_EXTRA_OPERATIVA):**

> Hay **{n} agente(s)** con asignación vigente en este grupo y mes que **no figuran** en la foto aprobada del plan. La grilla operativa puede mostrarlos; este documento no se modifica automáticamente.

**Cuerpo (DOTACION_FANTASMA_EN_FOTO):**

> Hay **{n} agente(s)** en la foto del plan que **ya no tienen** asignación vigente en este grupo para el mes. Revisá la grilla operativa o el historial de HLg.

**Pie:** Para incorporar agentes planificados en un mes ya habilitado, usá el flujo **Incorporación** (plan paralelo), no la edición de esta foto.

### 6.3 Negativo (tras T1, sin divergencia)

> No se detectaron diferencias de **dotación** entre la foto del plan y las asignaciones vigentes del mes. Las diferencias día a día por licencias u overrides son normales y no se listan aquí.

---

## 7. Criterios de aceptación

```gherkin
Feature: Alerta divergencia estructural plan vs grilla

  Background:
    Given un plan principal mensual en estado HABILITADO o CERRADO
    And el usuario abre el modal "Detalle del plan"

  Scenario: Sin cruce por defecto para jefe
    Given el usuario es jefe de sala sin rol RRHH
    When abre el detalle del plan
    Then ve la grilla aprobada y el texto de referencia de lectura
    And no se ejecuta evaluación de divergencia automáticamente
    And no ve la caja de alerta estructural hasta pulsar verificar si el botón está habilitado

  Scenario: Licencia no dispara alerta estructural
    Given la grilla operativa difiere en días con licencia LAO
    And el conjunto de persona_id vigentes en el mes es igual al de la foto
    When RRHH ejecuta verificar coherencia
    Then divergencia_estructural es false
    And se muestra el mensaje de negativo §6.3

  Scenario: HLg retroactiva dispara DOTACION_EXTRA
    Given persona P con HLg vigente en el mes y gdt del plan
    And P no está en grilla_aprobada del plan
    When RRHH ejecuta verificar coherencia
    Then divergencia_estructural es true
    And codigos incluye DOTACION_EXTRA_OPERATIVA
    And la UI lista a P hasta el límite de 5 y ofrece enlace a grilla operativa

  Scenario: No edición del plan desde la alerta
    When se muestra la alerta estructural
    Then no hay botón "Editar plan" ni CTA de incorporación sobre el principal habilitado
    And el enlace primario navega a grilla operativa

  Scenario: Rendimiento acotado
    When se invoca evaluarDivergenciaPlanGrilla
    Then la respuesta no requiere leer todas las celdas vis del mes en v1
    And el tiempo p95 objetivo es menor a 3s en grupos piloto (< 120 personas)
```

---

## 8. Fuera de alcance de este RFC

- Reescritura retroactiva de `plt_*` o `grilla_aprobada`.
- Sincronización automática plan ← grilla.
- Alertas en **Calendario licencias** por cada conflicto GSO (cubierto por [`CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md`](./CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md)).
- Fase 4 HLg: inmutabilidad, purga, `VAL-HLG-IMM` ([`RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md`](./RFC_PLAN_PARALELO_INCORPORACION_Y_HLG_V2.md) § Eje B).

---

## 9. Priorización sugerida

| Orden | Entrega |
|-------|---------|
| 1 | Callable `evaluarDivergenciaPlanGrilla` (conjuntos, v1) |
| 2 | Botón T1 + caja §5 en `PlanTurnoServicioPage` modal detalle |
| 3 | Enlace profundo a grilla RRHH |
| 4 | T2 auto RRHH (flag feature) |

**Estimación:** 1–2 iteraciones frontend + 1 callable, independiente del merge Fase 4 backend.

---

## 10. Referencias

- [`RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md`](./RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md) — snapshot vs operativo.
- [`SIMULACION_IMPACTOS_HLG_PLAN_TURNO_GSO_V2.md`](./SIMULACION_IMPACTOS_HLG_PLAN_TURNO_GSO_V2.md) — impactos HLg.
- [`GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md`](./GSO_MATERIALIZACION_AL_ABRIR_EQUIPO_OPERACIONES_V2.md) — por qué la grilla “se mueve”.
- Piloto narrativo: acta junio Sala — [`HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md`](./HANDOFF_ACTA_GSO_RECONCILIACION_JUNIO_2026_SALA_V2.md).
