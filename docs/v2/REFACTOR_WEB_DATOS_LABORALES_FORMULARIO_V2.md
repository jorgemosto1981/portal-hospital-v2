# Refactor — formulario «Datos laborales» en la app web (V2)

**Ámbito:** solo cliente (`web/`). No se modificaron Cloud Functions, Firestore Rules ni contratos de escritura laboral en servidor.

**Objetivo de la sesión:** reducir duplicación de JSX en `DatosLaborales.jsx`, centralizar estilos de controles (Tailwind, mobile-first, foco accesible), corregir coherencia en modo edición y mantener el mismo comportamiento funcional (payloads, validación, llamadas a `guardarRegistroLaboral`).

---

## 1. Corrección funcional (Fase 0)

### 1.1 Registro a editar vs `persona_id`

Al elegir un registro en el combo «Registro a editar», la fila cargada en el formulario debe pertenecer al mismo universo que las opciones del combo (registros filtrados por la persona seleccionada).

- **Antes:** `registrosPorTipo.find(...)` (todos los registros del tipo para toda la BD).
- **Después:** `registrosPorTipoFiltrados.find(...)` (solo registros cuya `persona_id` coincide con el formulario).

**Archivo:** `web/src/pages/DatosLaborales.jsx`.

El checkbox «Editar registro existente» ya tomaba el primer elemento de `registrosPorTipoFiltrados`; no requirió cambio.

---

## 2. Componentes nuevos

### 2.1 `LabeledSelect`

**Ruta:** `web/src/pages/datos-laborales/components/LabeledSelect.jsx`

- Envuelve **etiqueta** + **`<select>`** + texto de ayuda opcional.
- **Opciones:** filas con `id` obligatorio; texto mostrado por defecto: `label` (si existe y es string no vacío) → `nombre` → `id` (misma semántica que los `<option>` manuales previos).
- **`optionLabel`:** callback opcional para etiquetas personalizadas (p. ej. personas con apellido + nombre + id).
- **`bare`:** solo el `<select>` sin etiqueta ni ayuda, con clase **sin `mt-1`** (`SELECT_CLASS_BARE`), para encajar en **filas compactas** (carga por día).

### 2.2 `LabeledTextField`

**Ruta:** `web/src/pages/datos-laborales/components/LabeledTextField.jsx`

- Envuelve etiqueta + **`<input>`** + ayuda opcional.
- Soporta `type`, `placeholder`, `inputMode`, `min` (usado en **fecha_hasta** respecto de **fecha_desde**).
- **`bare`:** solo el input, sin etiqueta (misma idea que el select bare).

---

## 3. Sustituciones en la pantalla (por bloque)

### 3.1 Tipo de alta (HLc vs HLg)

- Constante **`OPCIONES_TIPO_ALTA`** en `DatosLaborales.jsx` con dos filas `{ id, nombre }`.
- Sustituido el `<select>` manual por **`LabeledSelect`**; la etiqueta superior conserva estilo reducido (**mayúsculas / `text-xs`**) mediante `label` como nodo React.

### 3.2 Modo edición

- Combo **«Registro a editar»:** opciones desde **`registrosEdicionDetallados`** (objetos con `id` + `label`); el **`LabeledSelect`** reutiliza el campo `label` vía `formatLabel` por defecto.

### 3.3 Identificación de sujeto y grupo

- **`persona_id`:** `LabeledSelect` + **`optionLabel={labelPersonaOpcion}`** (función auxiliar en `DatosLaborales.jsx`, mismo formato que antes: apellido + nombre + `(id)` o solo id).
- **`grupo_de_trabajo_id`** (solo si `tipoAlta === historial_laboral_grupos`): `LabeledSelect` sobre `opcionesGrupos`.

### 3.4 Bloque HLc (`historial_laboral_cargos`)

Todos los selects de catálogo del cargo y las referencias normativas pasaron a **`LabeledSelect`**.

Campos de texto / fecha / número:

- Referencias normativas (número, fecha, detalle) y **`carga_horaria_total`** → **`LabeledTextField`** (`inputMode` decimal donde aplica).

### 3.5 Bloque HLg (`historial_laboral_grupos`)

- Cargo HLc detallado (`opcionesCargoHlcDetalladas` con `{ id, label }`), régimen, centro de costo, función real → **`LabeledSelect`**.
- **`nivel_jerarquico`** → **`LabeledTextField`** con `inputMode="numeric"`.

### 3.6 Carga por día (`carga_por_dia_semana`)

- Cada fila: **`LabeledSelect` `bare`** (día de semana) + **`LabeledTextField` `bare`** (horas).
- Botones «Agregar día» / «Quitar» con feedback táctil ligero (`active:` / `touch-manipulation` donde corresponde).

### 3.7 Vigencias y causal (pie del formulario)

- **`fecha_desde`** / **`fecha_hasta`:** **`LabeledTextField`** `type="date"`; en **hasta**, **`min={formData.fecha_desde}`** para coherencia de rango.
- **`causal_fin_asignacion_id`:** solo en HLc → **`LabeledSelect`**.

---

## 4. Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `web/src/pages/DatosLaborales.jsx` | Refactor masivo del formulario; constantes `OPCIONES_TIPO_ALTA`, `labelPersonaOpcion`; fix `registrosPorTipoFiltrados` en edición. |
| `web/src/pages/datos-laborales/components/LabeledSelect.jsx` | Nuevo; soporte `bare`, `optionLabel`. |
| `web/src/pages/datos-laborales/components/LabeledTextField.jsx` | Nuevo; soporte `bare`, `min`. |

---

## 5. Verificación

- **`npm run build:web`** ejecutado con éxito tras los cambios.

---

## 6. Pendientes sugeridos (no realizados en esta sesión)

- Extraer subcomponentes **`LaboralFormHlcFields`** / **`LaboralFormHlgFields`** / shell del formulario para acercar `DatosLaborales.jsx` a la guía de tamaño de archivo del proyecto (~100 líneas por módulo orientativo).
- Partir `web/src/pages/datos-laborales/utils.js` por dominio (timeline / integridad / helpers de formulario).
- Alinear **`web/src/constants/datosLaboralesSchema.js`** (lista de campos documentales) con los nombres reales en Firestore y payloads (`fecha_desde` vs `fecha_inicio`, etc.).
- Opcional: prop **`labelClassName`** en `LabeledSelect` si se quiere separar por completo el estilo del título «Nivel de registro» sin anidar spans.

---

## 7. Referencias de producto

- Contrato laboral V2: [`MODULO_DATOS_LABORALES_V2.md`](./MODULO_DATOS_LABORALES_V2.md).
- Convenciones web del repo: `.cursor/rules/portal-hospital-v2-web.mdc`, modo atómico mobile-first.
