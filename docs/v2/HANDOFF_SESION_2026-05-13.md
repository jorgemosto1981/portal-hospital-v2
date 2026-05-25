# Handoff de sesión — 13 de mayo de 2026

**Rama:** `feature/articulos-v2-triple-layer`
**Objetivo:** Refactorización UX/UI completa del Configurador de Artículos ("RRHH-First").
**Regla de oro:** NO tocar lógica de validación ni servicios. Solo JSX, labels y documentación. Excepción explícita: se agregaron 3 campos nuevos al schema Zod por decisión de producto.

---

## Resumen ejecutivo

Se transformó el panel técnico del configurador de artículos en una herramienta pensada para administrativos de RRHH. Los cambios abarcan reorganización de pestañas, humanización de labels, ayuda contextual dinámica, campos nuevos de cupos/frecuencia y documentación de decisiones de producto.

---

## Cambios realizados

### 1) Extracción de componentes (Oleada 1)

- **`web/src/features/configuracion/articulos/fieldWidgets.jsx`** (NUEVO):
  - `FieldText`, `FieldNumber`, `FieldCheck`, `FieldSelect` extraídos de `ArticuloConfigTabs.jsx`.
  - `RequiredBadge` — indicador visual de obligatoriedad (`*` rojo / `(Opcional)`).
  - `FieldColor` — selector visual de color con paleta institucional predefinida + picker personalizado.
  - `FieldSelect` con HelpText dinámico: prioriza `EXPLICACIONES_OPCIONES[value]`, luego `option.descripcion` de Firestore, luego `helpText` estático.

- **`web/src/features/configuracion/articulos/articuloLabels.js`** (NUEVO):
  - `LABELS` — diccionario completo de labels humanos para todos los campos del formulario.
  - `PALETA_COLORES` — 8 colores institucionales para `FieldColor`.
  - `EXPLICACIONES_OPCIONES` — "machete humano" hardcodeado para opciones críticas de catálogos (`cfg_regla_computo_dias`, `cfg_reinicio_ciclo_cuota`, `cfg_origen_saldo`, `cfg_accion_saldo`, `cfg_tipo_caducidad`, `cfg_ambito_consumo`).

- **`web/src/features/configuracion/articulos/MatrizAntiguedadEditor.jsx`** (NUEVO):
  - Matriz de antigüedad LAO extraída como componente independiente.
  - Condicional a `es_lao_anual`.

### 2) Reorganización de pestañas (Oleada 2)

`ArticuloConfigTabs.jsx` — el array `TABS` pasó de 8 pestañas técnicas a 3 humanas:

| Pestaña | Contenido |
|---------|-----------|
| **Configuración Principal** | Versión/meta, identidad, naturaleza, checks de impacto, elegibilidad, Matriz LAO (condicional) |
| **Impacto y Saldo** | Impacto económico, cómputo de días, ciclo y saldo, **límites y cupos** (nuevo) |
| **Avanzado** | Caducidad y arrastre, workflow y preaviso, documentación |

### 3) Embellecimiento visual (Oleada 3)

- Cards con `rounded-xl border shadow-sm` para cada sección.
- `space-y-6` entre tarjetas.
- Grillas de 2 columnas para checks relacionados.
- Header técnico reemplazado por texto orientativo.

### 4) Banner de deshabilitado + Reactivar (Oleada 4)

`web/src/pages/ArticuloConfiguracion.jsx`:
- Banner rojo prominente cuando `activo === false`.
- Botón "Reactivar artículo" con `setDoc` merge: `{ activo: true }`, limpiando `motivo_deshabilitado` y `fecha_deshabilitado`.
- Estado `reactivando` para feedback visual.

### 5) Humanización y ayuda contextual

- **HelpTexts en checkboxes de identidad:** `es_sancion`, `es_inasistencia`, `es_sin_goce` con descripciones de impacto operativo.
- **Párrafos introductorios** (`text-xs italic text-slate-500`) en 6 bloques: Impacto económico, Cómputo de días, Ciclo y saldo, Caducidad y arrastre, Workflow y preaviso, Documentación.
- **HelpTexts por campo** en todos los bloques (checks, selects, numbers).
- **Prop `required`** en todos los campos basado en análisis del schema Zod.
- **`requiere_dictamen`** re-labeleado a "¿Requiere validación técnica (Legales / Medicina)?".

### 6) Definición operativa de campos de Workflow

Dos campos que estaban vagamente documentados recibieron definición precisa de producto:

- **`logistica_aviso_habilitada`** → renombrado a "Genera necesidad de cobertura / reemplazo". Identifica artículos que generan vacante crítica (ej. Art. 16-0, Tareas Diferentes). Señal upstream para el futuro módulo de Reemplazos/Contrataciones (Escenario 8).

- **`toma_conocimiento_limitada`** → renombrado a "Toma de conocimiento limitada (burbujeo)". Controla si el acuse de aprobación escala por toda la cadena jerárquica de `grupos_de_trabajo` o se corta según `niveles_burbujeo`.

- **`niveles_burbujeo`** (NUEVO, UI-only): campo numérico condicional (visible solo si `toma_conocimiento_limitada === true`). Define cuántos niveles de grupo padre reciben el acuse. Eliminado del payload Zod con `delete` para no romper `.strict()`. Se incorporará al schema cuando se implemente el módulo de Tomas de Conocimiento.

### 7) Corrección de `ambito_consumo_id` y campos de Límites/Cupos

**Corrección conceptual:** el helpText decía "por agente, por servicio o global" (incorrecto). El campo define la **ventana temporal** del contador de días: año calendario, año laboral/ciclo institucional o mes corriente.

**3 campos nuevos en schema Zod** (`bloqueTopesPlazosComputoSchema`), todos `nullable().optional()`:

| Campo | Tipo | Significado |
|-------|------|-------------|
| `cupo_dias_por_ciclo` | number >= 0 | Cupo fijo para artículos no-LAO (en LAO el cupo sale de la Matriz) |
| `tope_frecuencia_mensual` | number >= 0 | Máximo de solicitudes aprobables en un mes calendario |
| `tope_dias_por_evento` | number >= 0 | Máximo de días en una sola solicitud |

**Gating visual:** `cupo_dias_por_ciclo` solo visible cuando `es_lao_anual === false`.

**Nuevo bloque UI** "Límites y cupos" en Pestaña 2, después de "Ciclo y saldo".

**Ejemplo de configuración Art. 64a:** ámbito = año calendario, cupo = 6, frecuencia = 1/mes, evento = 1 día.

**Pseudocódigo del motor** documentado en `MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md` sección 4.0.

---

## Archivos modificados

| Archivo | Tipo de cambio |
|---------|----------------|
| `web/src/features/configuracion/articulos/ArticuloConfigTabs.jsx` | Refactorización mayor: 3 pestañas, imports nuevos, helpTexts, bloques, campos nuevos |
| `web/src/features/configuracion/articulos/fieldWidgets.jsx` | **NUEVO** — widgets de formulario + RequiredBadge + FieldColor |
| `web/src/features/configuracion/articulos/articuloLabels.js` | **NUEVO** — labels, paleta, explicaciones |
| `web/src/features/configuracion/articulos/MatrizAntiguedadEditor.jsx` | **NUEVO** — matriz LAO extraída |
| `web/src/pages/ArticuloConfiguracion.jsx` | Banner deshabilitado + botón Reactivar |
| `web/src/schemas/articulo.schema.js` | 3 campos nuevos + 3 campos UI: cupo, frecuencia, evento |
| `docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md` | Tabla Bloque 4 + Bloque 6 + secciones semánticas 4.0 y 6.x |
| `docs/v2/DICCIONARIO_CFG_ARTICULOS_V2.md` | Líneas de inventario: workflow/burbujeo + límites/cupos |
| `docs/v2/BACKLOG_MODULOS_PARALELOS_ARTICULOS_V2.md` | Filas ampliadas: Tomas de Conocimiento + Reemplazos |

---

## Decisiones de producto registradas

1. **Sin presets "LAO Estándar"**: se eliminó del alcance por decisión del usuario.
2. **Sin seed de catálogos**: los catálogos ya están poblados o se gestionan por pantalla de configuración RRHH.
3. **`niveles_burbujeo` es UI-only** hasta que se implemente el módulo de Tomas de Conocimiento. Se elimina del payload Zod con `delete`.
4. **`cupo_dias_por_ciclo`, `tope_frecuencia_mensual`, `tope_dias_por_evento` sí se persistieron en schema Zod y Firestore** por decisión explícita del usuario (excepción a la regla de oro).
5. **`ambito_consumo_id`** es ventana temporal, no nivel organizacional.

---

## Pendientes y próximos pasos

- [ ] **Prueba en navegador**: validar que las 3 pestañas renderizan correctamente con datos reales.
- [ ] **Módulo Tomas de Conocimiento**: incorporar `niveles_burbujeo` al schema Zod cuando se implemente la Cloud Function de burbujeo.
- [ ] **Módulo Reemplazos/Contrataciones (Escenario 8)**: consumir `logistica_aviso_habilitada` como señal upstream.
- [ ] **Motor de validación (Fase 7)**: implementar pseudocódigo de sección 4.0 en Cloud Functions usando `ambito_consumo_id` + cupos + frecuencia.
- [ ] **`cfg_ambito_consumo`**: homologar colección en diccionario (nota pendiente en seed).

---

## Commit de esta sesión

```
feat(articulos-v2): refactorización UX/UI RRHH-First del configurador

- 3 pestañas humanas (Principal, Impacto y Saldo, Avanzado)
- Widgets extraídos, labels humanos, ayuda contextual dinámica
- Banner de deshabilitado con Reactivar
- Campos nuevos: cupo_dias_por_ciclo, tope_frecuencia_mensual, tope_dias_por_evento
- Campo UI-only: niveles_burbujeo (burbujeo de toma de conocimiento)
- Corrección semántica de ambito_consumo_id
- Documentación: secciones 4.0 y 6.x, diccionario, backlog
```
