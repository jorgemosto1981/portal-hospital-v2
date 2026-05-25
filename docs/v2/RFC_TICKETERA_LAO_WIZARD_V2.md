# RFC — Wizard LAO en ticketera (documento definitivo F3a)

**Estado:** acordado producto · **Última revisión:** 2026-05-22  
**Relación:** [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) F3a · [`MODULO_CALENDARIO_INSTITUCIONAL.md`](./MODULO_CALENDARIO_INSTITUCIONAL.md) · [`readModoCalculo`](../../shared/utils/modoComputoCalendario.js).

**Principio:** LAO opera con **calendario institucional** según lo que RRHH definió en el **configurador** (`regla_computo_dias_id`). No se asume el modo en código del wizard; se **lee** de la versión publicada del ejercicio.

---

## 1. Modelo mental

| Quién | Hace qué |
|--------|-----------|
| Usuario | Elige **rango** `fecha_desde` / `fecha_hasta`. |
| Sistema | Calcula **resumen_computo** y fija **`dias_consumo`** (= `dias_solicitados` en payload). |
| RRHH | Define **corridos / hábiles simple / hábiles compuesto** en configurador. |

No hay input editable de “cantidad de días”. Manipular el payload en consola debe fallar con `INCONSISTENCIA_DIAS_*`.

---

## 2. Wizard — pasos

| Paso | Nombre | Contenido |
|------|--------|-----------|
| **1** | Disponibilidad | Bolsa LAO antes de fechas (§3). |
| **2** | Rango + cómputo reactivo | Solo fechas; resumen en vivo (§4–§5). |
| **3** | Preview derecho | Motor LAO (`eligible`, proporcional/stock, guardas) (§7). |
| **4** | Confirmar | `crearSolicitudArticuloLaoBorrador` + trigger (§6). |

**Multigrupo (ancla + snapshot):** paso selector de grupo cuando N>1; copy y checklist backend en [`RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md`](./RFC_SOLICITUD_GRUPOS_TRABAJO_INVOLUCRADOS_V2.md).

---

## 3. Paso 1 — Pantalla “Disponibilidad”

Objetivo: evitar solicitudes infructuosas y orientar al agente **antes** del rango de fechas.

### 3.1 UI implementada (F3a.1 — 2026-05-22)

- Botón primario **«Iniciar solicitud»** arriba del bloque informativo.
- Título **«Disponibles:»** — listado por bolsa (`bolsas_resumen`), **sin selector** de bolsa (consumo = FIFO en backend).
- Por cada bolsa:
  - `Año LAO = {anio_origen}`
  - `- Total = {cantidad_inicial} Días`
  - `- Disponibles = {disponible}` numérico, **excepto** si `anio_origen` = año calendario de la `fecha` del trámite (ej. 2026) → `- Disponibles = proporcional` (sin cálculo en paso 1).
- Aviso FIFO si `debe_respetar_fifo`.

### 3.2 Callable `obtenerContextoBolsaLaoAgente` (F3a.1)

**Entrada**

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `articulo_id` | sí | `art_*` LAO |
| `anio_origen_bolsa` | no | Si se omite, se usa FIFO (`anio_origen_bolsa_sugerido`) |
| `persona_id` | RRHH / OPEN_ACCESS | Agente: token `persona_id` |

**Salida — `resumen_disponibilidad_lao`**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ok` | boolean | `false` solo ante error duro (artículo sin versión publicada para el año activo) |
| `persona_id` | string | |
| `articulo_id` | string | |
| `articulo_nombre` | string? | Núcleo `cfg_articulos` |
| `articulo_codigo` | string? | |
| `version_aplicada_id` | string | `ver_*` publicada (`correspondencia_anio` = año activo de bolsa) |
| `correspondencia_anio` | int | Ejercicio LAO de la versión |
| `ejercicio_label` | string | UI paso 1 (nombre + año) |
| `anio_origen_bolsa_sugerido` | int \| null | Menor `anio_origen` con `disponible` > 0 (FIFO) |
| `anio_origen_bolsa_activo` | int \| null | Entrada o sugerido |
| `bolsa_seleccionada` | object \| null | Bolsa del año activo |
| `bolsa_seleccionada.bolsa_id` | string | |
| `bolsa_seleccionada.anio_origen` | int | |
| `bolsa_seleccionada.disponible` | number | Stock para el wizard |
| `bolsa_seleccionada.consumido` | number | |
| `bolsa_seleccionada.cantidad_inicial` | number | |
| `bolsa_seleccionada.es_arrastre` | boolean | |
| `bolsa_seleccionada.fecha_vencimiento` | string \| null | |
| `bolsa_seleccionada.codigo_grilla` | string? | |
| `bolsas_resumen` | array | Todas las bolsas del artículo, orden `anio_origen` asc |
| `bolsas_resumen[].requiere_fifo_antes` | boolean | Hay saldo en un año anterior |
| `fifo` | object | `{ anio_mas_antiguo_con_saldo, debe_respetar_fifo }` |
| `mensajes` | string[] | Sin bolsa, FIFO, sin versión, etc. |

El wizard **no** llama a `simularLaoPreview` en paso 1.

---

## 4. DTO `resumen_computo` (contrato único FE / BE)

Lenguaje común entre Wizard paso 2, `calcularResumenComputo`, `validarFechasArticuloEnMotor` y **`simularLaoPreview`** (tras alineación §7).

| Campo | Origen | Propósito |
|-------|--------|-----------|
| `fecha_desde` | Usuario | Inicio inclusive (`YYYY-MM-DD`). |
| `fecha_hasta` | Usuario | Fin inclusive. |
| `modo_computo` | `readModoCalculo` | `CORRIDOS` \| `HABILES`. |
| `regla_computo_dias_id` | Versión | `cfg_rcd_*` (selector configurador). |
| `usa_calendario_institucional` | Derivado | `true` si hábil. |
| `incluye_feriados_institucionales` | Derivado | `true` solo en `cfg_rcd_habiles_compuesto`. |
| `dias_corridos` | `calendarService` / core | Total días civiles en el rango. |
| `dias_habiles` | `calendarService` / core | Días hábiles reales (lun–vie o + feriados según regla). |
| **`dias_consumo`** | **Regla §4.1** | **Canónico → `dias_solicitados` en payload.** |
| `multiplicador` | `calendarService` | Factor informativo (§4.2); en compuesto, típ. máximo en días del rango con evento. |
| `ok` | Validación | `false` si C1, C2, C4 o rango inválido. |
| `codigos` | Validación | `CRUCE_ANIO_CALENDARIO`, `HORIZONTE_TEMPORAL`, `INCONSISTENCIA_DIAS_*`, … |
| `mensajes` | Validación | Texto para UI. |

### 4.1 Regla `dias_consumo`

```
si modo_computo === "CORRIDOS":
  dias_consumo = dias_corridos
si no:  // HABILES (simple o compuesto)
  dias_consumo = dias_habiles
```

### 4.2 `multiplicador`

- No reemplaza a `dias_consumo` en F3a.
- Cálculo sugerido: sobre días que cuentan para consumo en el rango, `max(getInfoDia(ymd).multiplicador)`; si no hay eventos, `1` o omitir.

### 4.3 Función pura (implementación F3a.2)

**`calcularResumenComputo({ versionData, fecha_desde, fecha_hasta, indice?, refYmd?, omitirHorizonte? })`**

1. `readModoCalculo(versionData)`.
2. Contar `dias_corridos` / `dias_habiles` (misma core que hoy).
3. Derivar `dias_consumo`.
4. Aplicar C1, C2; si hábil, coherencia interna (siempre ok si `dias_solicitados` se fija server-side al valor calculado).

**`validarFechasArticuloEnMotor`** en confirmación: recalcula `resumen_computo` y exige `payload.dias_solicitados === resumen.dias_consumo`.

> Corrección: la confirmación de solicitud **no** usa `persistirCheckinLaoBolsas`; usa **`simularLaoPreview` / `crearSolicitudArticuloLaoBorrador` / trigger `onSolicitudArticuloLaoMotorValidate`**.

---

## 5. UI — Bloque “Resumen de cómputo” (paso 2)

| `modo_computo` | Qué ve el usuario | `dias_consumo` |
|----------------|-----------------|----------------|
| **`CORRIDOS`** | Solo: **“Días totales de calendario: [dias_corridos]”** | `dias_corridos` |
| **`HABILES`** | **“Días hábiles: [dias_habiles] (según calendario institucional)”** | `dias_habiles` |

Opcional en hábil: línea secundaria “Días de calendario en el rango: X” (informativo).

Línea destacada siempre: **“Este pedido consume: [dias_consumo] día(s)”**.

Si `multiplicador` ≠ 1: **“Multiplicador máximo en el período: Z”** (solo informativo salvo norma futura).

---

## 6. Flujo de validación al confirmar (backend)

```text
1. Resolver versionData (LAO, ver_* publicada, anio_origen_bolsa).
2. resumen = calcularResumenComputo(desde, hasta, versionData)  // o validarFechasArticuloEnMotor con recálculo
3. if (!resumen.ok) → rechazar (codigos)
4. if (payload.dias_solicitados !== resumen.dias_consumo) → INCONSISTENCIA_DIAS_HABILES | INCONSISTENCIA_DIAS_CORRIDOS
5. runLaoPreviewSimulacion(...) con fechas + dias_consumo coherente
6. if (!eligible) → no crear / no confirmar
7. Persistir borrador + trigger (consumo bolsa según motor existente)
```

---

## 7. Alineación `simularLaoPreview`

### 7.1 Entrada — hoy vs objetivo F3a

| Campo | Hoy (AS-IS) | Objetivo F3a |
|-------|-------------|--------------|
| `persona_id` | sí (agente / RRHH) | igual |
| `articulo_id` | sí | igual |
| `version_aplicada_id` | sí | igual |
| `anio_origen_bolsa` | sí | igual |
| `fecha_desde` | sí | sí |
| `fecha_hasta` | **no** | **sí (obligatorio en wizard)** |
| `dias_solicitados` | **no** (motor asume 1 día implícito en contexto) | **sí** (= `dias_consumo` calculado; servidor valida) |

### 7.2 Salida — hoy vs objetivo F3a

| Bloque | Hoy (AS-IS) | Objetivo F3a |
|--------|-------------|--------------|
| `ok`, `eligible`, `motivos_ineligibilidad` | sí | igual (paso 3 wizard) |
| `camino`, `anio_solicitud`, `anio_origen_bolsa`, `fecha_desde` | sí | + `fecha_hasta` |
| `antiguedad`, `guardas`, `matriz`, `proporcional`, `stock` | sí | igual |
| **`resumen_computo`** | **no** | **sí (§4)** — mismo objeto que paso 2 |
| `resumen_disponibilidad_lao` | no | **no** en este callable (callable paso 1 §3) |

### 7.3 Orden de ejecución dentro del callable (objetivo)

1. Cargar contexto (`gatherLaoAltaMotorContext`).
2. **`validarFechasArticuloEnMotor`** o `calcularResumenComputo` con `fecha_desde` + `fecha_hasta`.
3. Si `!resumen.ok` → `HttpsError` con `codigos` (no ejecutar motor LAO).
4. Si `dias_solicitados` en payload ≠ `resumen.dias_consumo` → inconsistencia.
5. **`runLaoPreviewSimulacion`** (ajustar firma si el motor debe usar rango y días de consumo).
6. Respuesta: `{ ...resultadoLao, resumen_computo, persona_id, ... }`.

### 7.4 Frontend — uso por paso

| Paso | Callables |
|------|-----------|
| 1 | `obtenerContextoBolsaLaoAgente` (nuevo) |
| 2 | `calcularResumenComputo` en cliente (subscribe calendario) **o** callable liviano `calcularResumenComputoSolicitud` |
| 3 | `simularLaoPreview` con rango + `dias_solicitados = dias_consumo` |
| 4 | `crearSolicitudArticuloLaoBorrador` + mismos campos |

`useLaoAltaPreview` evoluciona: dependencias `fechaHasta`, `diasSolicitados` derivados de `resumen_computo`, debounce al cerrar rango.

---

## 8. Payload `crearSolicitudArticuloLaoBorrador` (objetivo)

| Campo | Origen |
|-------|--------|
| `fecha_desde`, `fecha_hasta` | Usuario |
| `dias_solicitados` | **`resumen_computo.dias_consumo`** |
| `anio_origen_bolsa`, `version_aplicada_id`, `articulo_id` | Paso 1 |
| Snapshot opcional | `resumen_computo` en doc o subcampo auditoría |

---

## 9. Criterios de aceptación

1. Paso 1 muestra año LAO y días disponibles de bolsa sin pedir fechas.
2. Paso 2 no tiene campo editable de días; resumen reactivo al completar rango.
3. LAO con regla **compuesto** en configurador: feriado RRHH reduce `dias_habiles` y `dias_consumo`.
4. Regla **corridos**: UI simplificada; feriado no altera consumo.
5. `simularLaoPreview` devuelve `resumen_computo` alineado al mostrado en paso 2.
6. Confirmación rechaza `dias_solicitados` tampered.

---

## 10. Fases de implementación

| Fase | Entregable |
|------|------------|
| F3a.0 | Este RFC cerrado |
| F3a.1 | Wizard shell + paso 1 callable disponibilidad + paso 2 UI (resumen FE con `calcularResumenComputo` shared) |
| F3a.2 | `simularLaoPreview` + trigger: `fecha_hasta`, validación, `resumen_computo` en respuesta |
| F3a.3 | DatePicker hábil + polish paso 3 |

---

## 11. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-05-22 | Borrador F3a.0 rango-first. |
| 2026-05-22 | Definitivo: disponibilidad paso 1, UI por modo, `resumen_computo`, tabla `simularLaoPreview`, LAO vía configurador (no asumir). |
