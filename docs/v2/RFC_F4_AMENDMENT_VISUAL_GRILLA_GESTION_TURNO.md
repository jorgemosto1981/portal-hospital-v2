# Amendment RFC F4 — Visualización grilla y consulta ligera (F-UX.3)

**Registro documental:** [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md) · **Estado implementación:** 2026-06-04 (`73d58cd`, prod hosting).

**Estado:** aprobado producto 2026-06-04  
**Relación:** [`RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md`](./RFC_F4_AMPLIADO_FUX_GESTION_TURNO_V2.md) §3 (A/B/C) · [`HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md`](./HANDOFF_SESION_2026-06-02_PAUSA_FUX_GESTION_TURNO_DIA.md) §12 · motor `proyectarDiaConOpsPendientes` (`grillaCambioTurnoPropioPreview.js`)  
**Alcance UI:** grilla mes equipo (mismo `periodo` + `gdt` que outbox del editor)

## Objetivo

Estandarizar tres estados de celda-día (teórico confirmado → preview outbox → post-batch), **sin iconos en celda**, con paridad preview = modales, y resumen al abrir detalle para reconocer turnos movidos por gestión (consulta ligera Opción A).

---

## 1. Estados

| Estado | Fuente | Celda en grilla |
|--------|--------|-----------------|
| Teórico confirmado | `vis_*` / caché | Compuesto + F:n + licencias (comportamiento actual) |
| Preview outbox | `proyectarDiaConOpsPendientes` + ops del envelope | §2 tokens + §3 por flujo |
| Post-batch | Overrides en `asi_*` + materialización (`post_batch`) | Igual que teórico nativo; sin tokens preview |

---

## 2. Tokens visuales (sin iconos)

Aplicar solo si `opAfectaDia(op, personaId, fechaYmd)` en el outbox del editor actual.

| Token nominal | Uso |
|---------------|-----|
| `border-status-pending` | Borde discontinuo 2px ámbar. Celda en cola. |
| `text-celda-principal` | Etiqueta compuesta **proyectada** (post-swap / resto / additivo). |
| `text-diff-out` | Línea o fragmento `− [tramos que salen]` (semántica danger). |
| `text-diff-in` | `+ [tramos que entran]` (semántica success). |
| `text-teorico-base-muted` | Opacidad ~70 % del teórico anterior (flujo C línea 1). |
| `badge-f2-preview` | Chip F:n con sufijo `*`; tooltip: *Fichadas esperadas (vista previa — aplicar cambios)*. |
| `tooltip-flujo-pendiente` | Nombre de función UI + contraparte/fechas (§3). **Sin** iconos ni emoji en esquina. |

**Intercambio de guardia:** celdas pareadas (origen/destino) comparten el mismo borde ámbar; cada tooltip nombra contraparte y fecha del otro lado.

**Prioridad:** el borde pendiente no oculta código de licencia ni marcadores de fin de semana.

---

## 3. Preview outbox por flujo

### 3.1 Intercambio de guardia (`cobertura_parcial`)

- **Celdas:** (persona origen, fecha origen) y (persona destino, fecha destino).
- **Texto principal:** compuesto post-swap; sin segmentos → **FR**.
- **Diff:** `− [cedidos]` · `+ [recibidos]` (labels de turno).
- **F:2\*** en ambas celdas (misma regla que modal / A-N2).

### 3.2 Cambio de turno propio (`reemplazo`) — origen

- **Texto principal:** turno resto; vacío → **FR**.
- **Diff:** `− [trasladados]`.
- **F:2\***.

### 3.3 Cambio de turno propio — destino

- **Texto principal:** compuesto **additivo** (base destino + incorporados; no pisar segmentos inmutables en destino).
- **Diff:** `+ [incorporados]`.
- **F:2\***.

### 3.4 Horas adicionales (`adicional`)

- **Línea 1:** teórico base atenuado (`text-teorico-base-muted`).
- **Línea 2:** prefijo fijo `Extra:` + label del turno adicional.
- **Diff:** solo en L2: `+ [adicional]`.
- **F:2\*** con bloques del extra en la proyección.

### 3.5 Paridad con batch backend

Con **A-BATCH**, **B-BATCH-1** y **C-BATCH** desplegados (2026-06-04), preview y batch v2 están alineados para A/B/C. Validar en prod tras cada deploy; ver [`REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md`](./REGISTRO_FASE_DOCUMENTAL_FUX_GESTION_TURNO_V3.md).

---

## 4. Post-batch (celda)

- Remover todos los tokens §2.
- **C:** display **unificado** en grilla (un compuesto coherente con segmentos en `capa_teorica`); la lista de segmentos en datos es la fuente de verdad.
- **No** mostrar en la celda principal trámite RRHH de horas imputadas (etapas 2–4 RFC §3.3); solo teórico + F:n + licencias.

**Paridad de datos:** post-batch, `capa_teorica` y `fichadas_esperadas` deben ser equivalentes a un día materializado de forma nativa (todo proceso posterior cuelga de esa base).

---

## 5. Detalle al seleccionar celda

### 5.1 Bloque «Cambios de turno en este día»

Mostrar si existe ≥1 entrada **activa** en `asistencia_diaria.overrides_turno[]` de tipo `cobertura_parcial` | `reemplazo` | `adicional`, filtrada por el `gdt` del contexto de grilla, que afecte la persona y fecha del modal.

- Tarjetas según **Anexo A** (plantillas de frase).
- Enlace textual opcional: *Ver día de [Apellido] [dd/mm]* (intercambio o traslado propio).
- Si ops del outbox afectan el día y aún no se aplicaron: subbloque **Pendiente en cola** (texto, sin iconos), coherente con el banner outbox.

### 5.2 Consulta ligera (Opción A)

Al **abrir** el detalle del día, **solo** si §5.1 aplica:

Append en el documento `asi_{persona}_{fecha}`, array `consultas_gestion_turno` (conservar como máximo las últimas **20** entradas):

```json
{
  "consultado_en": "ISO-8601",
  "consultado_por_persona_id": "per_*",
  "consultado_por_uid": "uid",
  "override_refs": ["índice o id estable en overrides_turno[]"],
  "op_batch_ids": ["uuid únicos del listado"]
}
```

- No duplica el contenido del cambio (eso vive en cada override).
- No registrar apertura en días **sin** overrides activos de gestión turno.

---

## 6. Criterios de aceptación

1. Día en cola identificable **sin iconos** (borde + texto + diff + F:2\*).
2. Preview de celda = preview de modal para la misma op / persona / fecha.
3. Tras «Aplicar cambios» OK: cero tokens preview en celdas afectadas.
4. Post-batch: teórico + F:n como materializado; C unificado en grilla.
5. Apertura de día con override: resumen Anexo A + append §5.2.
6. Intercambio: el resumen identifica contraparte y fecha sin depender solo del banner.

---

## 7. Orden de implementación sugerido

| # | Entrega |
|---|---------|
| 1 | Wire preview en grilla mes equipo (outbox + proyección + §2–3) |
| 2 | Bloque resumen + Anexo A en modal detalle día |
| 3 | Append `consultas_gestion_turno` al abrir §5.2 |
| 4 | ~~Fase 6 batch A/B/C~~ ✅ 2026-06-04 — paridad preview ↔ persistido validada en prod |

---

## Anexo A — Plantillas de frase (UI)

Sustituir corchetes con labels de turno (`labelTurnoToken` / enriquecimiento) y apellidos embebidos en overrides.

### A. Intercambio de guardia (`cobertura_parcial`)

| Campo | Plantilla |
|-------|-----------|
| En carácter de | Intercambio de guardia |
| Qué pasó | En este día: cedió **[tramos cedidos]** y recibió **[tramos recibidos]**. |
| Con quién / desde dónde | Con **[Apellido contraparte]** (día **[dd/mm contraparte]**). |
| Cuándo / quién | Registrado el **[fecha hora corta]** por **[Apellido editor]**. |
| Referencia | Lote `op_batch_id` (si existe), tipografía secundaria. |

**Variante mismo día:** *Intercambio en el mismo día con [Apellido]: [contraparte] cede [X], vos [Y].*

### B. Cambio de turno propio — celda origen (`reemplazo`)

| Campo | Plantilla |
|-------|-----------|
| En carácter de | Cambio de turno propio |
| Qué pasó | Se trasladó **[tramos]** hacia el **[dd/mm destino]**. |
| Con quién / desde dónde | Destino del movimiento: **[dd/mm destino]** (mismo agente). |
| Cuándo / quién | Registrado el **[fecha hora]** por **[editor]**. |

**Nota post-batch en origen:** si el día origen quedó franco: *El día de origen quedó franco tras el traslado.*

### C. Cambio de turno propio — celda destino

| Campo | Plantilla |
|-------|-----------|
| En carácter de | Cambio de turno propio |
| Qué pasó | Se incorporó **[tramos]** desde el **[dd/mm origen]** (sin reemplazar tramos ya fijados en este día). |
| Con quién / desde dónde | Proveniente del **[dd/mm origen]** (mismo agente). |
| Cuándo / quién | Registrado el **[fecha hora]** por **[editor]**. |

### D. Horas adicionales (`adicional`)

| Campo | Plantilla |
|-------|-----------|
| En carácter de | Horas adicionales |
| Qué pasó | Se agregó el turno **[label adicional]** al teórico del día. |
| Con quién / desde dónde | Sobre el teórico ya calculado de este día (sin contraparte). |
| Cuándo / quién | Registrado el **[fecha hora]** por **[editor]**. |
| Nota | La imputación de horas extra se gestiona en trámite RRHH (fuera de la celda principal). |

### E. Pendiente en cola (al abrir detalle, si aplica)

Una línea por op que afecta el día:

*Pendiente de aplicar: [nombre función] — [frase corta según A/B/C/D].*
