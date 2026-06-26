# RFC — Ticketera slice médico: Caja Negra (ingreso agente + bandeja auditor)

**Estado:** **Aprobado para diseño** + **addendum Licencia Incompleta** (workshop manual RRHH — **pausa código** hasta cerrar §0.2)  
**Épica:** Licencias médicas Decreto 1919 — **Fase 5 ticketera** + **Paquete P4 motor**  
**Rama:** `feat/1919-p4-licencias-medicas`  
**Relacionados:**

| Documento | Rol |
|-----------|-----|
| [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) §4.3 | Visión producto original |
| [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) Fase 5 | Roadmap bandeja médico |
| [`RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md`](./RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md) | Motor normativo (S_MED, junta, tramos) — **Modo B** |
| [`PLAN_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md`](./PLAN_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md) | Plan de paquete |
| Código **`licenciaMedicaTramosCore.js`** (P4.1) | Matemática 35/70 — **reutilizable sin cambios** |

---

## 0. Premisa RRHH (narrativa operativa)

**El agente no es experto en leyes laborales; es un paciente o un familiar que necesita avisar.**

No se le pide elegir entre Art. 14, 16 o 23 en el primer pantallazo. Solo:

1. **Aviso de enfermedad** — ¿es para **vos** o para un **familiar**?
2. **Certificado médico** — **obligatorio en aviso completo**; en **licencia incompleta** (manual operativo) el agente avisa **sin** certificado y lo carga después **sobre el mismo `solicitud_id`** (§0.2).
3. **Datos mínimos** — fecha estimada de inicio del reposo / contacto (sin tramos de sueldo ni topes).

**El Médico Auditor** (o la **Junta Médica** si supera 15 días) es la **única autoridad** que otorga o rechaza el reposo. **El jefe y RRHH no pueden vetar** una licencia médica: solo **visualizan** el trámite y registran **toma de conocimiento** (cobertura / liquidación). El motor de tramos (35/70) corre al pasar a **`APROBADA`**, estado que solo la medicina puede fijar.

### 0.1 Decisión workshop — competencia y acumulador (cerrada)

| Tema | Decisión |
|------|----------|
| **Quién aprueba la licencia** | Solo **Médico Auditor** (≤15 días continuos) o **Junta** (dictamen favorable si >15). |
| **Jefe / RRHH** | **Toma de conocimiento** (lectura + “marcar visto”); **sin** transición a `RECHAZADA` ni modificación de fechas/tramos. |
| **Acumulador anual (Fase S_MED)** | Solo solicitudes en **`cfg_esa_aprobada`**. Como `APROBADA` es exclusivamente decisión médica, el histórico para 35/70 es **seguro y no incluye** avisos pendientes ni rechazos del auditor. |
| **Cuándo persistir tramos** | Al entrar en **`APROBADA`** (mismo momento que el consumo para el acumulador). En clasificación con destino Junta, los tramos se **calculan en preview** para el auditor; persistencia definitiva al **aprobar** (Junta o auditor según tramo). |

### 0.2 Licencia incompleta → completa (manual operativo RRHH — diseño cerrado documentalmente)

**Problema:** el aviso dentro de las **~2 horas** de obligación puede existir **sin certificado**. El mismo trámite debe **evolucionar** en un único documento; **no** crear un segundo `sol_*` al subir el PDF.

| Principio | Decisión |
|-----------|----------|
| **Identidad** | Un solo **`solicitud_id`** desde el aviso incompleto hasta clasificación / cierre. |
| **Estado Firestore** | Permanece **`cfg_esa_pendiente_clasificacion_medica`** en aviso incompleto, al completar certificado y hasta que el auditor resuelva. |
| **Flag** | `ingreso_medico.es_licencia_incompleta`: `true` al create incompleto → `false` al completar (callable §5.6). |
| **Plazo certificado** | **`vencimiento_plazo_certificado`** (Timestamp Firestore), calculado en create/complete: `creado_en` + **N horas** leídas de **`cfg_parametros_sistema`** (§2.5). **Sin hardcode** de 24/48/72 en código. |
| **Registro del aviso** | `ingreso_medico.timestamp_aviso_incompleto` (ISO o Timestamp) al create incompleto. |
| **Motor S_MED** | **No** corre en aviso incompleto ni al completar certificado; solo al **`APROBADA`** (§6). |
| **Auditoría incompleta** | Aviso de **inasistencia / cobertura** para RRHH; el auditor **no clasifica** mientras `es_licencia_incompleta === true` **o** `adjuntos` vacíos (bloqueo callable §5.3). |
| **Vencimiento plazo** | Si `now() > vencimiento_plazo_certificado` y sigue incompleta → transición automática o job a **`cfg_esa_rechazada`** con motivo documental configurable (§5.7). Manual: invalida la licencia por falta de documentación. |
| **Completar** | Único entry point: callable **`actualizarAvisoMedicoIncompleto`** (§5.6), no un create nuevo. |
| **Anti-duplicado UI** | Si existe aviso **`PENDIENTE_CLASIFICACION_MEDICA`** + incompleta + no vencida para el titular → UI ofrece **“Completar solicitud existente”** en lugar de **“Nueva solicitud completa”**. |
| **Notificación agente** | UI (y mail futuro) recordando carácter provisorio y fecha límite de **`vencimiento_plazo_certificado`**. |

**Delta as-built (P4.3 en rama):** hoy el create cliente exige **adjunto obligatorio** (Zod + Rules). Tras aprobar este addendum, alinear `solicitudArticulo.schema.js`, Rules y `AvisoMedicoForm` con ramas **completa / incompleta**.

---

## 1. Dos modos de producto (coexistencia)

| Modo | Usuario | Cuándo | Motor S_MED |
|------|---------|--------|-------------|
| **A — Caja Negra (canónico)** | Agente → Auditor → (Junta) → TC jefe/RRHH | Producción licencias médicas | Al pasar a **`APROBADA`** (solo medicina) |
| **B — Artículo conocido (piloto / técnico)** | Agente elige `art_*` en ticketera | Pruebas P4.1, RRHH avanzado, regresión motor | En **previsualizar** Patrón B (implementado hoy) |

**Decisión de pausa:** no extender Modo B como flujo principal de agentes. El Modo B permanece como herramienta de laboratorio hasta que Modo A esté operativo.

---

## 2. Entidad de datos: ¿`solicitudes_articulo` o colección aparte?

### 2.1 Decisión recomendada

**Usar la misma colección `solicitudes_articulo`** con un **perfil de ingreso médico genérico**, sin crear `avisos_medicos` separada.

**Motivos:**

- Una sola trazabilidad para bandejas (jefe, RRHH, grilla MDC, historial agente).
- Mismos `evt_*` y convención `sol_*`.
- El motor y las rules ya pivotan en `solicitudes_articulo`.

### 2.2 Perfil documento — fase aviso (antes de clasificar)

Campos lógicos (contrato Zod/Rules en implementación futura):

| Campo | Fase aviso | Fase post-clasificación |
|-------|------------|-------------------------|
| `schema_version` | `SOL_MED_AVISO_V1` | `SOL_PATRON_B_V1` / `SOL_PATRON_C_V1` según artículo |
| `ingreso_medico` | Ver §2.2.1 | Conservado como historial |
| `vencimiento_plazo_certificado` | Timestamp; solo si incompleta o hasta completar | Conservado (auditoría) |
| `articulo_id` | **`null`** | `art_*` obligatorio |
| `version_id_aplicada` | **`null`** | `ver_*` obligatorio |
| `fecha_desde` / `fecha_hasta` | Opcional o **estimada** | Definitivas (auditor) |
| `dias_solicitados` | Ausente | Entero motor |
| `estado_solicitud_id` | `cfg_esa_pendiente_clasificacion_medica` | Según §3 |
| `patron_saldo` | `MEDICO_AVISO` | `B` / `C` según versión |
| `licencia_medica` | Ausente | Snapshot RFC P4 |

#### 2.2.1 Shape `ingreso_medico` (Caja Negra)

| Campo | Tipo | Reglas |
|-------|------|--------|
| `modo` | `"caja_negra"` | Obligatorio |
| `tipo_ingreso_id` | `cfg_tig_*` | Obligatorio |
| `es_licencia_incompleta` | boolean | `true` = aviso sin certificado; `false` = licencia completa (lista para auditor) |
| `timestamp_aviso_incompleto` | Timestamp / ISO | Obligatorio si `es_licencia_incompleta === true` en create |
| `adjuntos` | array | **Completa:** min 1 en create. **Incompleta:** `[]` permitido en create; min 1 tras §5.6 |
| `comentario_agente` | string opcional | Max 2000 |

**No** usar `cfg_esa_borrador` + trigger onCreate Patrón B para el aviso: el borrador actual **exige** `articulo_id` y dispara motor de saldo ciclo. El aviso es un **create con shape distinto** y **sin** `onSolicitudArticuloPatronBOnCreate` hasta clasificación.

### 2.3 Catálogo — tipo de ingreso agente

Nueva colección o filas en catálogo existente:

| ID propuesto | UI agente |
|--------------|-----------|
| `cfg_tig_enfermedad_propia` | Es para mí (enfermedad propia) |
| `cfg_tig_atencion_familiar` | Atención de familiar enfermo |

RRHH parametriza textos y si familiar exige DDJJ vigente (gate en create).

### 2.4 Parámetros de plazo — `cfg_parametros_sistema`

**Regla:** ningún plazo de licencia incompleta se codifica como literal en Functions/Rules/UI. RRHH mantiene valores en catálogo.

| ID documento (propuesto) | `codigo_interno` | Uso |
|--------------------------|------------------|-----|
| `param_lm_incompleta_plazo_horas` | `LM_INCOMPLETA_PLAZO_HORAS` | Horas desde `creado_en` / aviso incompleto hasta `vencimiento_plazo_certificado` |
| `param_lm_incompleta_aviso_obligacion_horas` | `LM_INCOMPLETA_AVISO_OBLIGACION_HORAS` | *(Opcional UI)* referencia manual “2 hs” para copy; no sustituye plazo certificado |

Ejemplo de fila:

```json
{
  "id": "param_lm_incompleta_plazo_horas",
  "codigo_interno": "LM_INCOMPLETA_PLAZO_HORAS",
  "valor_numerico": 24,
  "unidad": "horas",
  "titulo_ui": "Plazo para completar certificado (licencia incompleta)",
  "activo": true
}
```

**Lectura:** `crearAvisoMedicoCajaNegra` y jobs de vencimiento leen **`valor_numerico`** (fallback documentado en runbook si el parámetro falta en seed — solo entorno dev).

### 2.5 Alternativa descartada (referencia)

`avisos_medicos/{id}` + promoción a `sol_*` al clasificar: duplica estados, complica MDC y consultas de acumulador anual. Solo reconsiderar si Rules no pueden modelar `articulo_id` nullable de forma segura.

---

## 3. Ciclo de vida y transiciones de estado

### 3.1 Estados nuevos en `cfg_estado_solicitud_articulo`

| ID | `codigo_interno` | Titulo UI | Actor principal |
|----|------------------|-----------|-----------------|
| `cfg_esa_pendiente_clasificacion_medica` | `PENDIENTE_CLASIFICACION_MEDICA` | Pendiente de clasificación médica | Agente (alta) → Auditor |
| `cfg_esa_esperando_dictamen_junta` | `ESPERANDO_DICTAMEN_JUNTA` | Esperando dictamen de junta | Junta / medicina provincial |
| `cfg_esa_aprobada` | `APROBADA` | Licencia médica otorgada | **Solo** auditor (≤15 d) o junta (favorable) |
| `cfg_esa_rechazada` | `RECHAZADA` | No otorgada | **Solo** auditor o junta (desfavorable) |

**No aplica en slice médico:** `cfg_esa_en_revision_jefe` (circuito licencias ordinarias / Patrón B no médico).

**Política timeout:** para aviso **completo** en `PENDIENTE_CLASIFICACION_MEDICA` no hay SLA automático de cierre (handoff ticketera). Para aviso **incompleta**, sí aplica **`vencimiento_plazo_certificado`** (§0.2, §5.7) según parámetro §2.4.

### 3.2 Diagrama (Modo A — Caja Negra)

```mermaid
stateDiagram-v2
  direction TB
  [*] --> PendienteClasificacion: Agente aviso (completo o incompleto)
  PendienteClasificacion --> PendienteClasificacion: Agente completa certificado (mismo sol_id)
  PendienteClasificacion --> Rechazada: Plazo certificado vencido (job §5.7)
  PendienteClasificacion --> Rechazada: Auditor rechaza
  PendienteClasificacion --> ClasificadaMotor: Auditor clasifica (solo licencia completa)
  ClasificadaMotor --> EsperandoJunta: días continuos > 15
  ClasificadaMotor --> Aprobada: días continuos <= 15
  EsperandoJunta --> Rechazada: Dictamen junta desfavorable
  EsperandoJunta --> Aprobada: Dictamen junta favorable
  Aprobada --> [*]
  Rechazada --> [*]

  state PendienteClasificacion {
    [*] --> cfg_esa_pendiente_clasificacion_medica
  }
```

**Incompleta:** mismo estado `PENDIENTE_CLASIFICACION`; distingue `ingreso_medico.es_licencia_incompleta` y presencia de `adjuntos`. **Completa:** transición “completar” vía §5.6 sin cambiar `estado_solicitud_id`.

### 3.4 Flujo operativo — incompleta → completa → auditoría

| Etapa | Acción | `estado_solicitud_id` | ¿S_MED? |
|-------|--------|------------------------|---------|
| 1 | Agente aviso **incompleto** (sin adjunto) | `PENDIENTE_CLASIFICACION` | No |
| 2 | Sistema fija `vencimiento_plazo_certificado` (param §2.4) | Idem | No |
| 3 | Agente **`actualizarAvisoMedicoIncompleto`** (mismo `sol_id`) | Idem; `es_licencia_incompleta → false` | No |
| 4 | Auditor **`clasificarSolicitudMedicaAuditor`** | `APROBADA` o `ESPERANDO_JUNTA` | Sí al `APROBADA` |
| *alt* | Vencimiento sin certificado | `RECHAZADA` (motivo documental) | No |

RRHH ve etapas 1–2 como **aviso de inasistencia**; etapa 4 es el circuito médico pleno.

### 3.3 Matriz de transiciones (quién puede)

| Desde | Hacia | Rol | Acción |
|-------|-------|-----|--------|
| — | `PENDIENTE_CLASIFICACION` | Agente | Crear aviso **completo** o **incompleto** |
| `PENDIENTE_CLASIFICACION` | *(idem estado)* | Agente (titular) | **`actualizarAvisoMedicoIncompleto`** — adjuntar certificado |
| `PENDIENTE_CLASIFICACION` | `RECHAZADA` | Sistema (job §5.7) | Plazo certificado vencido sin adjunto |
| `PENDIENTE_CLASIFICACION` | `RECHAZADA` | `AUDITOR_MEDICO` | Rechazo médico con motivo |
| `PENDIENTE_CLASIFICACION` | `APROBADA` | `AUDITOR_MEDICO` | Clasificar si **completa** + días ≤ 15 |
| `PENDIENTE_CLASIFICACION` | `ESPERANDO_JUNTA` | `AUDITOR_MEDICO` | Clasificar si **completa** + días > 15 |
| `ESPERANDO_JUNTA` | `RECHAZADA` | Junta / medicina habilitada | Dictamen desfavorable |
| `ESPERANDO_JUNTA` | `APROBADA` | Junta / medicina habilitada | Dictamen favorable → **S_MED** + tramos |
| `APROBADA` | *(sin cambio de estado)* | Jefe | **Toma de conocimiento** (solo lectura + acuse) |
| `APROBADA` | *(sin cambio de estado)* | RRHH | **Toma de conocimiento** + check-in / SARH |

**No permitido:** Jefe o RRHH transicionan licencia médica a `RECHAZADA` o editan `fecha_desde` / `fecha_hasta` / `licencia_medica.tramos_haberes`.

---

## 4. Responsabilidades por actor (sin jerga técnica)

| Paso | Quién | Qué hace | Qué **no** hace |
|------|-------|----------|-----------------|
| 1 Aviso | Agente | Completo: motivo + certificado. Incompleto: motivo **sin** certificado (plazo §2.4) | Elegir artículo; ver tramos |
| 2 Clasificación / otorgamiento | Médico auditor | Artículo, fechas, causal; **otorga** si ≤15 días | Rechazar reposo por criterio organizativo |
| 3 Junta (si >15 d) | Reconocimientos médicos | Dictamen → `APROBADA` o `RECHAZADA` | Gestionar turnos del servicio |
| 4 Motor | Sistema | Al **`APROBADA`**: tramos 35/70 y consumo acumulador | Liquidar en SARH |
| 5 Jefe | Jefe de unidad | Ve solicitud **ya aprobada**; **toma de conocimiento** | Aprobar, rechazar o modificar licencia |
| 6 RRHH | Recursos Humanos | Ve estados y tramos; **toma de conocimiento**; check-in / export | Vetar reposo médico |

---

## 5. Contrato bandeja — Clasificar y aprobar (auditor)

Callable propuesto: **`clasificarSolicitudMedicaAuditor`** (nombre tentativo).

### 5.1 Autorización

- Rol: `AUDITOR_MEDICO` en `roles_hlc_vigentes` **o** claim equivalente + política RRHH.
- Documento en `cfg_esa_pendiente_clasificacion_medica`.
- **Precondición:** `ingreso_medico.es_licencia_incompleta === false` y `adjuntos.length >= 1` (licencia **completa**).
- Titular = persona del aviso (no delegación salvo RFC delegación jefe).

### 5.2 Request

```json
{
  "solicitud_id": "sol_01K…",
  "articulo_id": "art_01K…",
  "version_id_aplicada": "ver_01K…",
  "fecha_desde": "2026-06-10",
  "fecha_hasta": "2026-06-12",
  "dias_solicitados": 3,
  "causal_larga_duracion_id": null,
  "patologia_catalogo_id": "cfg_pat_…",
  "grupo_trabajo_id_ancla": "gdt_01K…",
  "observacion_auditor": "Reposo 72hs según certificado efector X",
  "dictamen_favorable": true
}
```

| Campo | Reglas |
|-------|--------|
| `articulo_id` + `version_id_aplicada` | Versión publicada; `es_licencia_medica === true` |
| `fecha_desde` / `fecha_hasta` | YMD; `dias_solicitados` coherente con cómputo versión (servidor recalcula y puede corregir) |
| `causal_larga_duracion_id` | Obligatorio si `modo_licencia_medica_id === cfg_mlm_larga_episodio` |
| `patologia_catalogo_id` | Opcional V2; catálogo Art. 19 futuro |
| `dictamen_favorable` | `false` → transición a `RECHAZADA` sin motor consumo |

### 5.3 Procesamiento servidor (orden fijo)

1. Validar transición y permisos (`AUDITOR_MEDICO`).
2. Cargar versión; resolver patrón B/C; ejecutar **motor de elegibilidad** (superposición, fechas, gates larga, etc.) **sin** contar aún en acumulador anual.
3. Calcular **preview** de tramos (`calcularTramosLicenciaMedicaCorta` + `sumarConsumoCortaAnualAprobado` solo sobre **`APROBADA`** previas) para mostrar al auditor antes de confirmar.
4. Si `dictamen_favorable === false` → `cfg_esa_rechazada`; fin (sin `licencia_medica` definitiva).
5. **Destino tras clasificación favorable:** si `dias_solicitados > 15` (continuos) → `estado_solicitud_id = cfg_esa_esperando_dictamen_junta`; si no → **`estado_solicitud_id = cfg_esa_aprobada`** (en este acto `aplicarLicenciaMedicaAprobada` / `sumarConsumoCortaAnualAprobado`).
6. En **`cfg_esa_esperando_dictamen_junta`:** persistir clasificación (`articulo_id`, fechas, `auditor_medico_clasificacion`); **sin** consumo acumulador hasta dictamen favorable.
7. Callable **`registrarDictamenJuntaMedica`:** favorable → `cfg_esa_aprobada` + `aplicarLicenciaMedicaAprobada`; desfavorable → `cfg_esa_rechazada`.
8. **No** usar `cfg_esa_en_revision_jefe` en este slice. **No** descuento de bolsa ciclo clásica si la ficha corta lo prohíbe (P5/P4).

### 5.4 Response (éxito — otorgamiento directo ≤15 días)

```json
{
  "ok": true,
  "solicitud_id": "sol_01K…",
  "estado_solicitud_id": "cfg_esa_aprobada",
  "fecha_desde": "2026-06-10",
  "fecha_hasta": "2026-06-12",
  "dias_solicitados": 3,
  "licencia_medica": {
    "schema_version": 1,
    "modo_licencia_medica_id": "cfg_mlm_corta_anual",
    "anio_calendario": 2026,
    "dias_acumulados_previos": 34,
    "tramos_haberes": { "100": 1, "60": 2, "0": 0 },
    "dias_solicitud_total": 3,
    "requiere_junta_medica": false
  },
  "mensaje_ui": "Clasificación registrada. Licencia médica aprobada; el jefe y RRHH recibirán el aviso para toma de conocimiento.",
  "motor_snapshot": { }
}
```

Si el destino es **Junta**, `estado_solicitud_id` = `cfg_esa_esperando_dictamen_junta` y `licencia_medica` puede ir solo en bloque `preview_pendiente_junta` (no cuenta para acumulador hasta `APROBADA`).

La UI del auditor muestra **preview** de tramos antes de confirmar; el agente **no** vio esto en el aviso.

### 5.5 Callable agente — Crear aviso

**`crearAvisoMedicoCajaNegra`** (cliente o callable unificado):

```json
{
  "tipo_ingreso_id": "cfg_tig_enfermedad_propia",
  "es_licencia_incompleta": false,
  "fecha_inicio_reposo_estimada": "2026-06-10",
  "adjuntos": [{ "storage_path": "avisos-med/2026/uid/cert.pdf" }],
  "grupo_trabajo_id_ancla": "gdt_01K…",
  "comentario_agente": "Certificado adjunto"
}
```

| Campo | Reglas |
|-------|--------|
| `es_licencia_incompleta` | `true` → `adjuntos` puede ser `[]`; set `timestamp_aviso_incompleto`; calcular **`vencimiento_plazo_certificado`** |
| `es_licencia_incompleta` | `false` → `adjuntos` min 1 |
| Plazo | `vencimiento = creado_en + read(param_lm_incompleta_plazo_horas)` — **no literal en código** |

Response: `solicitud_id`, `estado_solicitud_id`, `vencimiento_plazo_certificado` (si incompleta), mensaje UI según modo.

**Anti-duplicado (pre-create):** consulta avisos del titular en `PENDIENTE_CLASIFICACION` + `es_licencia_incompleta === true` + no vencidos → bloquear segundo create; devolver `solicitud_id` existente para flujo “completar”.

### 5.6 Callable agente — Completar aviso incompleto

**`actualizarAvisoMedicoIncompleto`** (Admin SDK o callable autenticado titular):

```json
{
  "solicitud_id": "sol_01K…",
  "adjuntos": [{ "storage_path": "avisos-med/2026/uid/cert.pdf", "content_type": "application/pdf" }]
}
```

**Validaciones (orden):**

1. Titular = `request.auth` / persona del doc.
2. `estado_solicitud_id === cfg_esa_pendiente_clasificacion_medica`.
3. `ingreso_medico.es_licencia_incompleta === true` **o** doc nació incompleto y aún sin adjuntos válidos.
4. `now() < vencimiento_plazo_certificado` — si no, **no** actualizar; respuesta `LICENCIA_INCOMPLETA_VENCIDA` → UI deriva a estado rechazado o mesa RRHH (política §5.7).
5. Merge: `adjuntos`, `es_licencia_incompleta: false`, opcional `completado_en` timestamp; **mismo `solicitud_id`**.

**UI:** el botón “Nueva solicitud completa” del manual = **completar** el `sol_*` pendiente, no un formulario vacío.

### 5.7 Vencimiento de plazo certificado (invalidación automática)

| Elemento | Diseño |
|----------|--------|
| **Disparador** | Cloud Scheduler + callable `procesarVencimientosLicenciaIncompleta` **o** chequeo al abrir bandeja auditor/RRHH |
| **Criterio** | `PENDIENTE_CLASIFICACION` + `es_licencia_incompleta === true` + `now() > vencimiento_plazo_certificado` |
| **Transición** | `cfg_esa_rechazada` + `motivo_rechazo_id` / texto desde catálogo (`cfg_motivo_rechazo_solicitud`) |
| **Parámetro** | Solo compara contra **`vencimiento_plazo_certificado`** ya calculado con §2.4 (re-lectura param opcional en job para auditoría) |
| **Excepción RRHH** | Fuera de scope V1; mesa manual si normativa lo exige |

### 5.8 Bandeja auditor — señales UI

- Filtro principal: `PENDIENTE_CLASIFICACION` + **`es_licencia_incompleta === false`** (cola clasificable).
- Vista RRHH ampliada: incluir incompletas con badge **“Provisoria”** y countdown hasta `vencimiento_plazo_certificado`.
- Incompletas vencidas: ocultar de “completar” agente; mostrar en panel incumplimientos.

---

## 6. Reutilización del motor P4.1 (sin reescribir matemática)

| Componente | Uso en Caja Negra |
|------------|-------------------|
| `licenciaMedicaTramosCore.js` | Cálculo de tramos (preview y al `APROBADA`) |
| `sumarConsumoCortaAnualAprobado` | **Solo** solicitudes `cfg_esa_aprobada` (histórico para preview del auditor) |
| `previsualizarSolicitudPatronB` + `licencia_medica_preview` | **Solo Modo B** (piloto) |

**Acumulador anual (cerrado):** el consumo de la bolsa 35/70 se materializa **únicamente** cuando el documento entra en **`cfg_esa_aprobada`**, lo cual en Caja Negra solo ocurre por **auditor** (≤15 días) o **junta favorable**. El jefe **no** interviene en esa transición. Las consultas históricas de `sumarConsumoCortaAnualAprobado` permanecen filtradas por `APROBADA`.

**Función orquestadora propuesta:** `aplicarLicenciaMedicaAprobada(db, solId)` — motor patrón + S_MED + persistencia tramos + fan-out MDC (cuando corresponda).

---

## 6.1 Toma de conocimiento — Jefe y RRHH

Reutilizar el patrón de [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md):

| Actor | Bandeja | Filtro | Acción UI |
|-------|---------|--------|-----------|
| Jefe | Solicitudes del equipo | `estado_solicitud_id === APROBADA` + `es_licencia_medica` + subordinados | Ver tramos, fechas, certificado; **“Tomar conocimiento”** |
| RRHH | Bandeja institucional | Ídem + visibilidad global | Ídem + check-in |

Campos sugeridos: `jefe_toma_conocimiento_en`, `jefe_toma_conocimiento_persona_id`, `rrhh_toma_conocimiento_*` (ya usados en oleada autorización para otras licencias). **Prohibido** `resolverDecisionJefeSolicitud` con rechazo sobre slice médico Caja Negra.

---

## 7. UI / menú

| Entrada menú | Ruta tentativa | Rol |
|--------------|----------------|-----|
| Aviso de enfermedad | `/portal/solicitudes/aviso-medico` | Agente — ramas **completa** / **incompleta** + **completar pendiente** |
| Bandeja clasificación médica | `/portal/medico/solicitudes` o `/portal/auditor-medico/…` | `AUDITOR_MEDICO` |
| Dictamen junta | Subvista filtro `ESPERANDO_JUNTA` | Junta / medicina habilitada |
| Toma de conocimiento jefe | `/portal/jefe/solicitudes` (filtro médico aprobado) | Jefe con subordinados |
| Toma de conocimiento RRHH | `/portal/rrhh/solicitudes-articulo` | RRHH |

Alineado a [`CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md`](./CONCEPTO_TICKETERA_BANDEJA_DINAMICA_V2.md) §6.

---

## 8. Reglas Firestore (sketch)

- **Create aviso:** solo titular; shape `SOL_MED_AVISO_V1`; estado `PENDIENTE_CLASIFICACION`; sin `articulo_id`; adjuntos opcionales **solo** si `es_licencia_incompleta === true`.
- **Update aviso:** titular vía **`actualizarAvisoMedicoIncompleto`** (callable); whitelist `ingreso_medico.adjuntos`, `es_licencia_incompleta`, `completado_en`; **no** `update` libre desde cliente salvo reglas acotadas equivalentes.
- **Clasificación:** solo vía Callable (Admin SDK) o rol auditor con campos whitelist.
- **Post-aprobación:** inmutabilidad `licencia_medica.tramos_haberes` (RFC P4).

---

## 9. Plan de implementación (post-documentación)

| Orden | Entrega | Dependencia |
|-------|---------|-------------|
| 1 | Seed estados + `cfg_tig_*` + **`cfg_parametros_sistema`** (plazos LM) | Este RFC |
| 2 | Create aviso (completa/incompleta) + Rules | §0.2 |
| 2b | **`actualizarAvisoMedicoIncompleto`** + job vencimiento §5.7 | Param §2.4 |
| 3 | Callable clasificar + enganche P4.1 | Motor existente |
| 4 | UI agente (incompleta/completar) + bandeja auditor | §5.8 |
| 5 | Junta (P4.2) + MDC | Estados |
| 6 | Matriz UAT caja negra | — |

**Congelar** ampliación de preview agente Modo B salvo pruebas internas.

---

## 10. Addendum al RFC P4

El archivo [`RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md`](./RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md) describe el **motor normativo** y el flujo **cuando el artículo ya es conocido** (Modo B). **Este RFC es el source of truth del flujo agente en producción (Modo A).** Ante conflicto de UX, prevalece **Caja Negra**.

---

## 11. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-06-26 | RFC creado; unificación Caja Negra vs P4.1; entidad `solicitudes_articulo`; contrato auditor |
| 2026-06-26 | Workshop: `APROBADA` solo medicina/junta; acumulador en `APROBADA`; jefe/RRHH toma de conocimiento sin veto |
| 2026-06-26 | P4.3 UI agente: `/portal/solicitudes/aviso-medico`, Storage, servicio create (**solo aviso completo** — ver delta §0.2) |
| 2026-06-26 | **Addendum Licencia Incompleta:** mismo `sol_id`, plazos `cfg_parametros_sistema`, §5.6–5.8; pausa código hasta alinear Zod/Rules |
