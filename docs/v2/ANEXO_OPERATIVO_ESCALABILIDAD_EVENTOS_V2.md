# Anexo operativo - Escalabilidad de eventos V2

## Objetivo

Definir una implementacion concreta de lectura escalable para eventos, manteniendo `eventos_ticket` como fuente unica de verdad (append-only) y agregando vistas derivadas para UI operativa.

---

## 1) Capas de almacenamiento

1. **Event store central (escritura):**
   - Coleccion: `eventos_ticket`
   - Uso: auditoria, debug, reproceso, trazabilidad completa.
   - Regla: no se consulta directo desde pantallas operativas salvo casos excepcionales.

2. **Read models operativos (lectura rapida):**
   - Colecciones sugeridas:
     - `eventos_por_persona`
     - `eventos_por_modulo`
     - `eventos_bandeja_rrhh`
   - Uso: tablas/listados de UI con filtros frecuentes.

3. **Historico analitico (largo plazo):**
   - Destino sugerido: BigQuery y/o Cloud Storage.
   - Uso: BI, estadistica, auditoria historica de gran volumen.

---

## 2) Contrato minimo para read models

Cada documento derivado debe incluir, como minimo:

- `evento_id` (referencia a `eventos_ticket.id`)
- `ocurrido_en`
- `modulo_origen`
- `accion`
- `tipo_evento_id`
- `persona_id` (si aplica)
- `actor_persona_id` (si aplica)
- `periodo_yyyymm`
- `ui_titulo`
- `ui_resumen`

Opcional recomendado:

- `estado_bandeja_rrhh_id`
- `entidad_tipo`
- `entidad_id`
- `prioridad_ui`

---

## 3) Diseño sugerido por coleccion

### 3.1 `eventos_por_persona`

- Documento sugerido: `${persona_id}_${evento_id}`
- Campos de filtro:
  - `persona_id`
  - `ocurrido_en`
  - `modulo_origen`
  - `periodo_yyyymm`
- Consulta objetivo:
  - historial de una persona, ordenado por fecha descendente.

### 3.2 `eventos_por_modulo`

- Documento sugerido: `${modulo_origen}_${evento_id}`
- Campos de filtro:
  - `modulo_origen`
  - `ocurrido_en`
  - `tipo_evento_id`
  - `periodo_yyyymm`
- Consulta objetivo:
  - timeline operativo por modulo (RRHH, onboarding, login, personales, laborales).

### 3.3 `eventos_bandeja_rrhh`

- Documento sugerido: `${periodo_yyyymm}_${evento_id}`
- Campos de filtro:
  - `estado_bandeja_rrhh_id`
  - `ocurrido_en`
  - `modulo_origen`
  - `periodo_yyyymm`
  - `persona_id`
- Consulta objetivo:
  - bandeja RRHH con filtros combinados (estado + periodo + modulo/persona).

---

## 4) Indices recomendados (Firestore)

Crear inicialmente solo los indices de consultas reales de UI:

1. `eventos_por_persona`:
   - `(persona_id ASC, ocurrido_en DESC)`
   - `(persona_id ASC, periodo_yyyymm ASC, ocurrido_en DESC)`

2. `eventos_por_modulo`:
   - `(modulo_origen ASC, ocurrido_en DESC)`
   - `(modulo_origen ASC, tipo_evento_id ASC, ocurrido_en DESC)`

3. `eventos_bandeja_rrhh`:
   - `(estado_bandeja_rrhh_id ASC, ocurrido_en DESC)`
   - `(periodo_yyyymm ASC, estado_bandeja_rrhh_id ASC, ocurrido_en DESC)`
   - `(periodo_yyyymm ASC, modulo_origen ASC, ocurrido_en DESC)`

Nota: evitar sobreindexar. Agregar nuevos indices solo al validar consultas reales de pantalla.

---

## 5) Flujo de escritura recomendado

1. Se escribe el evento canonico en `eventos_ticket`.
2. En la misma operacion de backend (o en una funcion de proyeccion), se escriben documentos derivados en read models.
3. Si falla la proyeccion:
   - reintento idempotente por `evento_id`,
   - nunca modificar evento canonico ya emitido.

---

## 6) Retencion y costo

- Operativo (read models): mantener ventana caliente de 6-12 meses (ajustable por demanda real).
- Event store central: segun necesidad de auditoria institucional.
- Historico largo: mover/replicar periodicamente fuera de la capa operativa (BigQuery/Storage).

---

## 7) Orden de adopcion sugerido

1. Implementar primero `eventos_bandeja_rrhh` (impacto directo en UX RRHH).
2. Incorporar `eventos_por_persona`.
3. Incorporar `eventos_por_modulo`.
4. Definir export historico programado.

Este orden minimiza riesgo y maximiza mejora de performance visible.
