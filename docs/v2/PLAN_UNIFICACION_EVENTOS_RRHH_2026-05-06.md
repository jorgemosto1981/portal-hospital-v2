# Plan de unificacion de eventos (RRHH) - 2026-05-06

## Contexto y decisiones cerradas

- Entorno de trabajo: pruebas con conexion directa a BD real.
- No se requiere compatibilidad hacia atras para eventos.
- No se requieren eventos historicos previos; se puede limpiar `eventos_ticket`.
- No usar seeds de datos ficticios ni mocks.
- Eventos inmutables: append-only, sin reevaluacion posterior.
- Objetivo UX: eventos legibles para RRHH en menos de 3 segundos.

---

## Objetivo general

Unificar el criterio de todos los eventos de la app en un contrato unico, con:

1. Trazabilidad tecnica completa (ids, actor, accion, timestamps, cambios).
2. Comprension textual inmediata para RRHH (`payload.ui`).
3. Inmutabilidad y no retroactividad.

---

## Estado actual validado

- Pre-alta RRHH ya no debe capturar grupo/nivel; grupo/nivel quedan para HLg (posterior).
- Eventos actuales identificados en:
  - `functions/modules/login.js`
  - `functions/modules/onboarding.js`
  - `functions/modules/rrhh.js`
  - `functions/modules/catalogosPersonales.js`
  - `functions/modules/shared/ddjjGrupoFamiliarService.js`
- `catalogosLaborales.js` valida/persiste HLc-HLd-HLg pero requiere emision de eventos estandarizados.

---

## Contrato unico de eventos (nuevo)

### Campos top-level obligatorios

- `id`
- `tipo_evento_id`
- `tipo_evento_cfg_id`
- `modulo_origen`
- `accion`
- `persona_id` (cuando aplique)
- `actor_uid` y/o `actor_persona_id` (cuando aplique)
- `ocurrido_en`
- `schema_version`

### `payload.ui` (obligatorio en eventos nuevos)

- `titulo`
- `resumen`
- `entidad`
- `persona_afectada_label`
- `actor_label`

### `payload.contexto`

Ids tecnicos relacionados (`cuenta_id`, `hlc_id`, `hld_id`, `hlg_id`, etc.).

### `payload.cambios`

Lista normalizada de cambios:

- `campo`
- `label`
- `antes`
- `despues`
- `antes_label`
- `despues_label`
- `tipo` (ej. `string`, `number`, `date`, `catalog_id`, `hours_weekly_breakdown`)

---

## Politica de inmutabilidad (cerrada)

1. Solo append en `eventos_ticket`.
2. Snapshot del momento (no rehidratacion retroactiva).
3. Cambios futuros no alteran eventos historicos.
4. Correcciones mediante nuevo evento compensatorio.
5. Todo evento nuevo incluye capa `payload.ui` legible RRHH.

---

## Etapas consecutivas de implementacion

### Etapa 0 - Corte operativo

- Confirmar entorno de pruebas.
- Limpiar `eventos_ticket`.
- Confirmar que no se preserva historial previo.

### Etapa 1 - Especificacion final del contrato

- Congelar esquema unico (top-level + `payload.ui` + `payload.contexto` + `payload.cambios`).
- Congelar diccionario de titulos/resumenes por modulo.

### Etapa 2 - Helper transversal de eventos

- Crear helper comun en `functions/modules/shared/` para:
  - construir evento,
  - resolver labels actor/afectado,
  - normalizar cambios,
  - aplicar formato RRHH.

### Etapa 3 - Migracion emisores core

- `functions/modules/rrhh.js`
- `functions/modules/onboarding.js`
- `functions/modules/login.js`

### Etapa 4 - Migracion Datos Personales

- `functions/modules/catalogosPersonales.js`
- `functions/modules/shared/ddjjGrupoFamiliarService.js`

### Etapa 5 - Migracion Datos Laborales

- `functions/modules/catalogosLaborales.js`
- Emision en alta/actualizacion/cierre para:
  - HLc
  - HLd
  - HLg

### Etapa 6 - Lectura UI RRHH

- Renderizar `payload.ui` como capa principal.
- Sin fallback legacy (por decision de corte limpio).

### Etapa 7 - QA funcional con BD real

Flujos minimos:

1. Login/vinculacion
2. Onboarding
3. RRHH administrativo
4. Datos personales
5. Datos laborales (HLc -> HLg)

Validar en cada flujo:

- evento creado,
- actor y afectado visibles,
- cambios comprensibles,
- inmutabilidad respetada.

### Etapa 8 - Cierre documental

- Registrar fecha de corte del formato.
- Registrar modulos cubiertos.
- Registrar politica de inmutabilidad y contrato final.

---

## Checklist QA resumido

- [ ] `eventos_ticket` limpio antes del inicio.
- [ ] Todos los eventos nuevos tienen `payload.ui`.
- [ ] Todos los eventos nuevos incluyen actor y afectado legibles.
- [ ] Todos los eventos nuevos muestran cambios con labels RRHH.
- [ ] No hay update/delete sobre eventos emitidos.
- [ ] No se usaron seeds ni mocks.

---

## Notas operativas

- Este plan aplica "hacia adelante" y no migra eventos historicos.
- La prioridad de lectura RRHH es: claridad > detalle tecnico.
- El detalle tecnico se conserva en `payload.contexto` y `payload.cambios`.

