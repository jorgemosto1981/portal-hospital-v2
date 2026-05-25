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

## Escalabilidad futura (criterio incorporado)

Para evitar degradacion de consultas a medida que crezca el volumen (miles o decenas de miles de eventos), se adopta un esquema de 3 niveles:

1. **Nivel operativo (Firestore):**
   - `eventos_ticket` como log central inmutable (append-only).
   - Vistas derivadas para lectura rapida de UI (ej. por persona, por modulo, por bandeja RRHH).
2. **Nivel de auditoria funcional (Firestore):**
   - Conserva trazabilidad completa para inspeccion y control.
   - Accesos mas restringidos y consultas menos frecuentes.
3. **Nivel historico analitico (BigQuery/Storage):**
   - Export periodico para historico de largo plazo, BI y analitica.
   - Permite reducir costo operativo sobre Firestore.

### Decision estructural

- Se mantiene una sola fuente de verdad para escritura: `eventos_ticket`.
- Las pantallas operativas deben consultar preferentemente vistas derivadas/materializadas.
- El log global se reserva para auditoria, debug y reprocesos.

### Campos de soporte de escala (obligatorios en nuevos eventos)

- `ocurrido_en` (timestamp canonico de orden temporal)
- `modulo_origen`
- `accion`
- `persona_id` (cuando aplique)
- `actor_persona_id` (cuando aplique)
- `schema_version`
- `periodo_yyyymm` (particion logica recomendada para consultas y agregados)

### Politica de retencion (lineamiento)

- Firestore operativo: ventana caliente (recomendado 6-12 meses segun uso real).
- Firestore auditoria: segun politica institucional y normativa vigente.
- Historico completo: fuera de la capa operativa (BigQuery/Storage).

Referencia operativa: ver `docs/v2/ANEXO_OPERATIVO_ESCALABILIDAD_EVENTOS_V2.md`.

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
- `modulo_origen`
- `accion`
- `persona_id` (cuando aplique)
- `actor_uid` y/o `actor_persona_id` (cuando aplique)
- `ocurrido_en`
- `schema_version`
- `periodo_yyyymm`

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

## Sintaxis canonica propuesta (sin compatibilidad retroactiva)

Dado que se realizo limpieza de eventos historicos y no se requiere compatibilidad hacia atras, se define este contrato canonico para todos los emisores nuevos:

```json
{
  "id": "evt_01K...",
  "tipo_evento_id": "cfg_tev_...",
  "modulo_origen": "rrhh",
  "accion": "actualizar_estado_cuenta_acceso",
  "persona_id": "per_01K...",
  "actor_uid": "uid_firebase_opcional",
  "actor_persona_id": "per_01K..._actor",
  "ocurrido_en": "serverTimestamp",
  "periodo_yyyymm": "2026-05",
  "schema_version": "eventos_v2_1",
  "payload": {
    "ui": {
      "titulo": "Estado de acceso actualizado",
      "resumen": "RRHH cambio el estado de acceso de la cuenta",
      "entidad": "usuarios_cuenta",
      "persona_afectada_label": "APELLIDO, Nombre · DNI 12345678",
      "actor_label": "APELLIDO, Nombre (RRHH)"
    },
    "contexto": {
      "cuenta_id": "usr_01K...",
      "estado_anterior_id": "cfg_eca_pend_reg",
      "estado_nuevo_id": "cfg_eca_activo"
    },
    "cambios": [
      {
        "campo": "estado_acceso_id",
        "label": "Estado de acceso",
        "antes": "cfg_eca_pend_reg",
        "despues": "cfg_eca_activo",
        "antes_label": "Pendiente de registro",
        "despues_label": "Activo",
        "tipo": "catalog_id"
      }
    ]
  }
}
```

### Reglas de sintaxis

1. Se usa `tipo_evento_id` como unica referencia al catalogo de tipo de evento.
2. `schema_version` fija para este corte: `eventos_v2_1`.
3. `ocurrido_en` siempre desde servidor (no cliente).
4. `periodo_yyyymm` obligatorio para filtrado e indices.
5. `payload.ui` obligatorio en todos los eventos operativos.
6. `payload.cambios` puede ser arreglo vacio en eventos sin diff explicito.

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

## Plan de implementacion ejecutable (E1-E6)

### E1 - Congelar contrato y diccionario

- Confirmar `schema_version = eventos_v2_1`.
- Publicar diccionario de `accion` y `tipo_evento_id` por modulo.
- Validar formato unico de labels RRHH (`persona_afectada_label`, `actor_label`).

**Done E1:**
- Contrato firmado en este documento.
- Sin campos duplicados/ambiguos.

### E2 - Helper transversal unico

- Implementar helper comun en `functions/modules/shared/` para:
  - crear envelope de evento,
  - completar `periodo_yyyymm`,
  - normalizar `payload.cambios`,
  - estandarizar `payload.ui`.
- El helper debe ser idempotente por `id` de evento.

**Done E2:**
- Todos los emisores nuevos usan helper.
- Prohibida construccion manual de eventos en modulos.

### E3 - Migracion emisores core

- Migrar primero:
  - `functions/modules/rrhh.js`
  - `functions/modules/onboarding.js`
  - `functions/modules/login.js`
- Reemplazar payload legacy por sintaxis canonica.

**Done E3:**
- 100% de eventos core en `schema_version eventos_v2_1`.
- UI RRHH ya puede leer `payload.ui` sin fallback.

### E4 - Migracion personales/laborales

- Migrar:
  - `functions/modules/catalogosPersonales.js`
  - `functions/modules/shared/ddjjGrupoFamiliarService.js`
  - `functions/modules/catalogosLaborales.js`
- Cubrir alta, actualizacion y cierre de HLc/HLd/HLg.

**Done E4:**
- No quedan emisores legacy.
- Todos los cambios relevantes se registran en `payload.cambios`.

### E5 - Read models operativos

- Implementar primero `eventos_bandeja_rrhh`.
- Luego `eventos_por_persona` y `eventos_por_modulo`.
- Crear indices minimos segun `ANEXO_OPERATIVO_ESCALABILIDAD_EVENTOS_V2`.

**Done E5:**
- Consultas de UI no leen directo `eventos_ticket`.
- Tiempos de respuesta dentro de objetivo UX.

### E6 - QA y cierre de corte

- Ejecutar QA funcional con BD real en flujos:
  - login/vinculacion,
  - onboarding,
  - RRHH administrativo,
  - datos personales,
  - datos laborales.
- Verificar inmutabilidad, legibilidad y consistencia de campos.

**Done E6:**
- Checklist QA completo sin criticos.
- Corte formalizado como "sin compatibilidad retroactiva".

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
- Implementacion bajo lineamiento estricto: sin mocks, sin datos ficticios y con conexion directa a BD real.
- Matriz de ejecucion por archivo/callable: ver `docs/v2/MATRIZ_MIGRACION_EVENTOS_V2_1.md`.

