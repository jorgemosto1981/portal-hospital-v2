# Diccionario — Catálogos y prefijos del dominio Artículos — V2

**Propósito:** inventario de **colecciones `cfg_*`**, **prefijos de id de documento** y **campos núcleo** para configuración de artículos y solicitudes. Complementa [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md).

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador**.

**Convenciones generales:** alineadas a [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) (`codigo_interno`, `titulo_ui`, `orden`, `vigente_desde` / `vigente_hasta`, `activo` donde corresponda).

---

## 1. Prefijos de ids de documento

| Prefijo | Colección / uso |
|---------|------------------|
| `art_` | `cfg_articulos` |
| `sol_` | `solicitudes_articulo` |
| `cfg_ta_` | `cfg_tipo_articulo` |
| `cfg_pwa_` | `cfg_paso_workflow_articulo` |
| `cfg_rsr_` | `cfg_regla_split_remanente` |
| `cfg_tev_art_` | Filas nuevas de `cfg_tipo_evento` **exclusivas** del dominio artículos (misma colección global; ids reservados por prefijo) |
| `cfg_cfi_` | `cfg_calendario_feriados_institucional` |
| `cfg_tcp_` | `cfg_tipo_computo_plazo` |

Referencias en documentos de negocio usan sufijo **`*_id`** (singular) o **`*_ids`** (listas).

---

## 2. Colecciones `cfg_*` del dominio (lista cerrada del plan)

| Colección | Rol |
|-----------|-----|
| `cfg_tipo_articulo` | Clase / naturaleza del artículo |
| `cfg_unidad_medida_articulo` | Días, horas, jornadas, etc. |
| `cfg_estado_solicitud_articulo` | Estados del trámite |
| `cfg_paso_workflow_articulo` | Pasos y responsabilidades |
| `cfg_accion_vencimiento` | Qué hacer ante SLA vencido (también puede referenciarse en plazos documentales si política no default) |
| `cfg_origen_alta_solicitud` | Origen del alta (coherente con delegación jefe) |
| `cfg_prioridad_normativa` | Peso frente a otros aportes / MDC |
| `cfg_politica_superposicion` | Convivencia, rechazo, derivación RRHH, etc. |
| `cfg_regla_split_remanente` | Destino del remanente tras aprobación parcial |
| `cfg_momento_entrega_documentacion` | Antes / después / mixto |
| `cfg_fuente_decision_solicitud` | Quién decide en conflicto |
| `cfg_motivo_rechazo_solicitud` | Motivos tipificados |
| `cfg_tipo_computo_plazo` | Cómputo de plazo documental (corrido, hábil compuesto, extensiones futuras por filas) |
| `cfg_calendario_feriados_institucional` | Feriados y asuetos con alcance por efector |

---

## 3. Campos núcleo sugeridos — `cfg_articulos`

Incluye (lista no exhaustiva para implementación; definitivos en schema y RFC):

- Identidad: **`variantes_sarh[]` (obligatorio, mínimo 1 elemento; no hay `codigo_sarh` en raíz)**, `norma_principal_tipo_id`, `norma_principal_referencia`, `inciso_normativo`, `titulo`, `descripcion_operativa`
- Clasificación: `tipo_articulo_id`, `unidad_medida_id`
- Vigencia: `activo`, `vigente_desde`, `vigente_hasta`
- Alta y autorización: `permite_alta_iniciada_por_jefe_grupo`, `requiere_autorizacion_jefe`, `origen_alta_id_default`
- Split: `permite_aprobacion_parcial`, `regla_split_remanente_id`, `permite_remanente_sin_articulo`, `permite_nueva_solicitud_remanente`, `requiere_decision_rrhh_para_remanente`, `requiere_auditoria_medica`, …
- Documentación: `documentacion_diferida_habilitada`, `momento_entrega_documentacion_id`, `plazo_documental_post_inicio_dias`, `plazo_documental_tipo_dias_id` → `cfg_tcp_*`, `accion_vencimiento_documental_id`
- Impacto y conflictos: `admite_reemplazo`, `dispara_evento_contrataciones`, `prioridad_normativa_id`, `politica_superposicion_id`, `articulos_incompatibles_ids`, `filtros_elegibilidad`, `metadata`

**`variantes_sarh[]`:** obligatorio; arreglo de uno o más objetos `{ codigo_sarh, etiqueta_ui, afecta_sueldo_porcentaje, activo }`. Un solo código SARH = array de longitud 1.

---

## 4. Campos núcleo sugeridos — `solicitudes_articulo`

- `articulo_id`, `titular_persona_id`, `actor_alta_persona_id`, `origen_alta_id`
- `estado_solicitud_id`, `paso_actual_workflow_id`
- `ocurrido_en`, `resuelto_en`, `vencimiento_en`
- `fuente_decision_id`, `motivo_rechazo_id`, `requiere_toma_conocimiento`
- `version_aplicada`
- `sarh_variante_codigo` (opcional, si el artículo define variantes)
- Control de estado: `estado_actualizado_en`, `estado_actualizado_por_persona_id`, `motivo_transicion_id`, `transicion_origen_id`
- SLA: `sla_horas_objetivo`, `sla_estado`, `escalamientos_aplicados`, …
- Superposición: `superposicion_detectada`, `superposicion_con_solicitud_ids`, `resolucion_superposicion_id`, …
- Documentación diferida: `ultimo_dia_licencia_en`, `inicio_plazo_documental_en`, `documentacion_vence_en`, `documentacion_entregada_en`, `adjuntos_documentacion_ids`

---

## 5. Eventos MVP (`cfg_tipo_evento`, `codigo_interno`)

Prefijo documento: **`cfg_tev_art_<ULID>`**. `modulo_origen`: **`articulos`**.

| Orden sugerido | codigo_interno |
|----------------|----------------|
| 1 | `ART_SOLICITUD_CREADA` |
| 2 | `ART_SOLICITUD_ESTADO_CAMBIADO` |
| 3 | `ART_SLA_VENCIDO` |
| 4 | `ART_SUPERPOSICION_DETECTADA` |
| 5 | `ART_DOCUMENTACION_VENCIDA` |
| 6 | `ART_DOCUMENTACION_RECIBIDA` |
| 7 | `ART_ESCALAMIENTO_APLICADO` |
| 8 | `ART_SPLIT_APROBACION_PARCIAL_APLICADO` |
| 9 | `ART_SUPERPOSICION_RESUELTA` |

Campos mínimos por fila sugeridos: `codigo_interno`, `titulo_ui`, `descripcion_ui`, `modulo_origen`, `activo`, `orden`.

---

## 6. Catálogo institucional y cómputo

- **`cfg_calendario_feriados_institucional` (`cfg_cfi_*`):** **un documento por fecha exacta** (sin rangos `fecha_inicio`/`fecha_fin`). Varias fechas consecutivas (puente) = varios documentos. Campos mínimos: `fecha`, `tipo`, `alcance_efector_id`, `activo` (más campos comunes de `cfg_*` según MODULO_CONFIGURACION). Consultas típicas: filtro por fecha(s) concretas (p. ej. `in` sobre lista de fechas).
- **`cfg_tipo_computo_plazo` (`cfg_tcp_*`):** define si el plazo documental usa días corridos, hábil compuesto u otras semánticas según filas del catálogo (sin hardcode en motor).

## 6.1 Stub Asistencia/MDC (contrato acordado para validación futura)

- **Callable:** `getDiasLaborablesAgente`
- **Entrada:** `{ persona_id, fecha_inicio, cantidad_dias_buscados }`
- **Salida:** array de strings con fechas **ISO `YYYY-MM-DD`** (días laborables del agente según RDA/plantilla).

---

## 7. Referencias

- [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)
- [`PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md`](./PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md)
- [`ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md`](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md)
