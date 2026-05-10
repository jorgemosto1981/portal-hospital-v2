# RFC — Parámetros extendidos `cfg_articulos` (1919 / gestión hospitalaria)

**Estado:** adoptado para implementación V2 (mayo 2026).  
**Relaciona:** plan «Parámetros artículos 1919», [`DICCIONARIO_CFG_ARTICULOS_V2.md`](./DICCIONARIO_CFG_ARTICULOS_V2.md), [`web/src/schemas/articulo.schema.js`](../../web/src/schemas/articulo.schema.js).

---

## 1. Objetivo

Modelar en Firestore, sin strings mágicos de negocio, los bloques: **elegibilidad ampliada**, **cadencia/límites**, **evidencia documental**, **interrupción / incompatibilidad** y **workflow por pasos**, con trazabilidad UI ↔ motor.

---

## 2. Nuevos grupos de campos

### 2.1 `reglas_elegibilidad_ampliada` (objeto opcional)

| Campo | Tipo | Descripción |
|--------|------|-------------|
| `antiguedad_minima_meses` | `number` (int ≥ 0) opcional | Carencia mínima expresada en **meses completos** respecto de la antigüedad reconocida en motor (ver §6). |
| `situacion_revista_ids` | `string[]` opcional | Referencias a `cfg_situacion_revista`. Vacío = sin filtro en este eje. |
| `requiere_junta_medica_previa` | `boolean` opcional | Pre-requisito clínico distinto de `requiere_auditoria_medica` (control posterior en workflow). |

**Semántica:** se combinan con `filtros_elegibilidad` existente (**AND** entre ejes activos).

### 2.2 `reglas_cadencia` (objeto opcional)

| Campo | Tipo | Descripción |
|--------|------|-------------|
| `intervalo_minimo_entre_usos_cantidad` | int ≥ 0 opcional | Magnitud del intervalo mínimo entre usos del artículo. |
| `intervalo_minimo_entre_usos_unidad_id` | `string` opcional | FK `cfg_unidad_intervalo_tiempo`. |
| `preaviso_cantidad` | int ≥ 0 opcional | Preaviso antes del inicio solicitado. |
| `preaviso_unidad_id` | `string` opcional | FK `cfg_unidad_intervalo_tiempo`. |
| `duracion_minima_solicitud_cantidad` | int ≥ 0 opcional | Piso de duración en **la misma unidad** que `unidad_medida_id` del artículo (días/horas/etc.). |
| `limite_maximo_periodo_cantidad` | int ≥ 0 opcional | Tope por ventana (ej. máximo anual). |
| `limite_maximo_periodo_unidad_id` | `string` opcional | FK `cfg_unidad_intervalo_tiempo` (ej. año civil, mes). |

**Precedencia motor:** si existen reglas de cadencia parcialmente definidas, el motor solo aplica ejes con **cantidad y unidad** presentes (salvo `duracion_minima_*` que usa la UM del artículo).

### 2.3 Documentación (raíz `cfg_articulos`)

| Campo | Tipo | Descripción |
|--------|------|-------------|
| `documentacion_certificado_obligatorio` | `boolean` opcional | Obligatoriedad explícita de certificado/PDF además de política de plazos. |
| `plazo_documental_post_inicio_horas` | int ≥ 0 opcional | Plazo en **horas** cuando la norma no admite expresión en días enteros (ej. 48 h). |

**Precedencia:** si `plazo_documental_post_inicio_horas` > 0, el motor puede usar horas para el SLA documental; si no, continúa la semántica de `plazo_documental_post_inicio_dias` + `cfg_tipo_computo_plazo`.

### 2.4 Interrupción e incompatibilidad

| Campo | Tipo | Descripción |
|--------|------|-------------|
| `articulos_interrupcion_permitida_ids` | `art_*[]` opcional | Otros artículos que **pueden interrumpir** o prevalecer según política (`cfg_politica_superposicion`). |

Convive con `articulos_incompatibles_ids` (exclusión mutua). La fila nueva de política **`CFG_PS_INTERRUPCION_LISTA_ARTICULO`** habilita interpretación explícita en motor.

### 2.5 Workflow

| Campo | Tipo | Descripción |
|--------|------|-------------|
| `paso_workflow_articulo_ids` | `string[]` opcional | Orden de pasos; cada id → `cfg_paso_workflow_articulo`. |
| `requiere_asesoria_letrada` | `boolean` opcional | Paso institucional adicional (UI + motor). |
| `requiere_dictamen_medicina_laboral` | `boolean` opcional | Distinto de `requiere_auditoria_medica` cuando el hospital separa ML de auditoría clínica. |

Los booleans legacy (`requiere_autorizacion_jefe`, etc.) siguen vigentes; la lista ordenada permite **roadmap** de sustitución gradual por pasos catalogados.

---

## 3. Catálogos `cfg_*` nuevos o ampliados

| Colección | Prefijo id | Uso |
|-----------|------------|-----|
| `cfg_situacion_revista` | `CFG_SREV_*` | Planta / temporario / contrato, según filas sembradas. |
| `cfg_unidad_intervalo_tiempo` | `cfg_uit_*` | Horas, días, meses, años para cadencia y preaviso. |
| `cfg_paso_workflow_articulo` | `cfg_pwa_*` | Pasos atómicos (jefe, RRHH, medicina laboral, asesoría). |
| `cfg_accion_vencimiento` | `CFG_AV_*` | Ampliación: acción tipo falta / regularización documental. |
| `cfg_politica_superposicion` | `CFG_PS_*` | Ampliación: política con lista de interrupción por artículos. |

---

## 4. Matriz campo → pestaña UI → motor

| Bloque | Campos | Pestaña UI | Motor / callable |
|--------|--------|------------|------------------|
| Elegibilidad base | `filtros_elegibilidad` | Elegibilidad | Filtrado por catálogo RRHH |
| Elegibilidad ampliada | `reglas_elegibilidad_ampliada` | Elegibilidad (subsección) | Antigüedad (`calcularAntigüedad`), situación revista (HLc futuro / snapshot), junta previa |
| Cadencia | `reglas_cadencia` | Cadencia | Intervalos, límites por periodo, solapes con historial `solicitudes_articulo` |
| Evidencia | `documentacion_certificado_obligatorio`, plazos documentales | Plazos / Documentación | SLA documental, acciones `cfg_accion_vencimiento` |
| Incompatibilidad | `articulos_incompatibles_ids`, `politica_superposicion_id` | Workflow | Choque de solicitudes activas |
| Interrupción | `articulos_interrupcion_permitida_ids` | Workflow | Prioridad respecto de artículos en lista |
| Workflow | `paso_workflow_articulo_ids`, booleans | Workflow | Orden de hitos en ticket |

---

## 5. Riesgos cerrados en este RFC

- **Unidad temporal documental:** conviven días (`plazo_documental_post_inicio_dias`) y horas (`plazo_documental_post_inicio_horas`) con precedencia explícita en §2.3.
- **Antigüedad:** la regla `antiguedad_minima_meses` se evalúa contra el **desglose total** expresado en meses aproximados en callable (`años×12 + meses + floor(días/30)`), alineado al callable de antigüedad existente hasta que exista campo único de «meses reconocidos» en persona.

---

## 6. Callable `validarReglasArticuloV2`

Entrada mínima: `persona_id`, `articulo_id`.  
Salida: `ok`, `issues[]` con `codigo` y `mensaje`.  
Lee `cfg_articulos`, persona, HLC para filtros; opcionalmente `solicitudes_otras` en payload para incompatibilidad/cadencia cuando el cliente envíe contexto.
