# Diccionario — Catálogos y prefijos del dominio Artículos — V2

**Propósito:** inventario de **colecciones `cfg_*`**, **prefijos de id de documento** y **campos núcleo** para configuración de artículos y solicitudes. Complementa [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md).

**Fecha:** 9 de mayo de 2026.

**Estado:** **borrador**.

**Convenciones generales:** alineadas a [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md) (`codigo_interno`, `titulo_ui`, `orden`, `vigente_desde` / `vigente_hasta`, `activo` donde corresponda).

**Contrato canónico (product-first):** [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) — **§1.6** semáforo de estados (`activo`, `estado_articulo_id`, `estado_version_id`), **§1.7** matriz lógica vs **subcolecciones** bajo `versiones` (tamaño de documento y costo de lectura), **§1.8** motor de saldos y despacho por `origen_saldo_id`, **§2.5–2.7** triple capa operativa / contable / vista y archivo frío, **§8** restricciones mandatorias de costo (grilla, saldos sin barrido histórico, RDA, inmutabilidad). La **§2** siguiente unifica catálogos del **schema §3** con los ya listados en planes modulares previos; ante divergencia de semántica, **prima el schema product-first**.

---

## 1. Prefijos de ids de documento

| Prefijo | Colección / uso |
|---------|------------------|
| `art_` | `cfg_articulos` |
| `ver_` | `cfg_articulos/{art_id}/versiones/{ver_id}` (subcolección de parámetros versionados) |
| `car_` | `cfg_articulo_relaciones` |
| `sol_` | `solicitudes_articulo` |
| `sal_` | Documento agregado de saldos por persona y año (capa contable; colección a fijar en implementación, ver schema §2.5) |
| `vis_` | Documento de vista mensual de grilla por persona (capa vista; schema §2.5) |
| `cfg_ta_` | `cfg_tipo_articulo` |
| `cfg_pwa_` | `cfg_paso_workflow_articulo` |
| `cfg_rsr_` | `cfg_regla_split_remanente` |
| `cfg_tev_art_` | Filas nuevas de `cfg_tipo_evento` **exclusivas** del dominio artículos (misma colección global; ids reservados por prefijo) |
| `cfg_cfi_` | `cfg_calendario_feriados_institucional` |
| `cfg_cad_` | `cfg_tipo_caducidad` |
| `cfg_tcp_` | `cfg_tipo_computo_plazo` |

Referencias en documentos de negocio usan sufijo **`*_id`** (singular) o **`*_ids`** (listas).

---

## 2. Colecciones `cfg_*` del dominio (unificado: modular + product-first §3)

Orden alfabético. **PF** = enumerado explícito en [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) §3. **Leg.** = ya previsto en [`MODULO_CONFIGURACION_ARTICULOS_V2.md`](./MODULO_CONFIGURACION_ARTICULOS_V2.md) / flujos de solicitud. Una fila puede cubrir ambos usos.

| Colección | Rol | Origen |
|-----------|-----|--------|
| `cfg_accion_incumplimiento_documental` | Acción ante incumplimiento documental configurado | PF |
| `cfg_accion_saldo` | Semántica de movimiento de saldo (p. ej. descuenta disponible vs acumula uso) | PF |
| `cfg_accion_vencimiento` | Qué hacer ante SLA u omisión según política (incl. plazos documentales) | PF · Leg. |
| `cfg_calendario_feriados_institucional` | Feriados y asuetos con alcance por efector (`cfg_cfi_*`) | Leg. |
| `cfg_circuito_ingreso` | Circuito de ingreso de la solicitud / trámite | PF |
| `cfg_estado_articulo` | Disponibilidad del artículo en portal (`VIGENTE`, `OBSOLETO`, …) | PF |
| `cfg_estado_solicitud_articulo` | Estados del trámite de solicitud | PF · Leg. |
| `cfg_estado_version_articulo` | Ciclo de edición de la versión (`BORRADOR`, `PUBLICADA`) | PF |
| `cfg_fuente_decision_solicitud` | Quién decide en conflicto de solicitud | Leg. |
| `cfg_momento_entrega_documentacion` | Antes / después / mixto (entrega de documentación) | Leg. |
| `cfg_motivo_rechazo_solicitud` | Motivos tipificados de rechazo | Leg. |
| `cfg_nivel_ocupacion_dia` | Ocupación de celda intradía en grilla (exclusivo / parcial / informativo); no sustituye incompatibilidades normativas | PF |
| `cfg_operador_comparacion` | Operadores para reglas de elegibilidad | PF |
| `cfg_origen_alta_solicitud` | Origen del alta (coherente con delegación jefe) | Leg. |
| `cfg_origen_normativo_articulo` | Clase de referencia normativa del artículo | PF |
| `cfg_origen_saldo` | Origen de la bolsa de saldo (interno / externo informado / externo calculado) | PF |
| `cfg_paso_workflow_articulo` | Pasos y responsabilidades del workflow | PF · Leg. |
| `cfg_politica_superposicion` | Políticas de convivencia o resolución entre solicitudes / aportes | Leg. |
| `cfg_prioridad_normativa` | Peso frente a otros aportes / MDC | Leg. |
| `cfg_reinicio_ciclo_cuota` | Reinicio de ciclo de cuota (anual, mensual, diario, nunca, …) | PF |
| `cfg_regla_computo_dias` | Regla de cómputo en días | PF |
| `cfg_regla_computo_horas` | Regla de cómputo en horas | PF |
| `cfg_regla_split_remanente` | Destino del remanente tras aprobación parcial (`cfg_rsr_*`) | Leg. |
| `cfg_rol_aprobador` | Roles habilitados como aprobadores en workflow (referencia operativa; puede alinearse con `cfg_rol` global) | PF |
| `cfg_tipo_acumulacion` | Tipo de acumulación de cuota (anual, rolling, sin acumulación); **no** modela caducidad de bolsa (FK `caducidad_tipo_id` → `cfg_tipo_caducidad`) | PF |
| `cfg_tipo_articulo` | Clase / naturaleza del artículo (`cfg_ta_*`) | PF · Leg. |
| `cfg_tipo_caducidad` | Política de vencimiento de bolsa / saldo (`cfg_cad_*`; Bloque 5 `caducidad_tipo_id`) | PF |
| `cfg_tipo_computo_plazo` | Cómputo de plazo documental (corrido, hábil compuesto, …; `cfg_tcp_*`) | Leg. |
| `cfg_tipo_convivencia_articulo` | Convivencia entre artículos (catálogo de políticas de convivencia) | PF |
| `cfg_tipo_documentacion` | Tipos de exigencia documental | PF |
| `cfg_tipo_evento` | Eventos RRHH; filas de artículos con prefijo `cfg_tev_art_*` | PF · Leg. |
| `cfg_tipo_filtro_elegibilidad` | Ejes o tipos de filtro de elegibilidad | PF |
| `cfg_tipo_fraccionamiento` | Fraccionamiento de uso / tope | PF |
| `cfg_tipo_incompatibilidad_articulo` | Tipificación de incompatibilidad normativa entre artículos | PF |
| `cfg_tipo_relacion_articulo` | Aristas del grafo (`prorroga_de`, `incompatible_con`, …) | PF |
| `cfg_tipo_tope` | Tipos de tope (días, ocurrencias, …) | PF |
| `cfg_unidad_medida_articulo` | Unidad de medida del artículo (días, horas, jornadas, …) | PF · Leg. |
| `cfg_unidad_plazo` | Unidad semántica de plazo en el modelo PF (matriz §4) | PF |

**Equivalencias a cerrar en RFC:** `cfg_unidad_plazo` (PF) vs `cfg_tipo_computo_plazo` (`cfg_tcp_*`, plazo documental en plan modular). Hasta definir un solo concepto o FK dual documentado, no mezclar filas entre colecciones.

**Catálogo implícito en matriz PF (Bloque 2):** `justifica_sueldo_id` referencia filas tipo `cfg_js_*`; nombre de colección a fijar en seed (p. ej. `cfg_justifica_sueldo`) y prefijo en diccionario cuando exista.

---

## 3. Campos núcleo sugeridos — `cfg_articulos`

Incluye (lista no exhaustiva para implementación; definitivos en schema y RFC):

- Identidad: `codigo_sarh`, `variantes_sarh[]`, `norma_principal_tipo_id`, `norma_principal_referencia`, `inciso_normativo`, `titulo`, `descripcion_operativa`
- Clasificación: `tipo_articulo_id`, `unidad_medida_id`
- Vigencia: `activo`, `vigente_desde`, `vigente_hasta`
- Alta y autorización: `permite_alta_iniciada_por_jefe_grupo`, `requiere_autorizacion_jefe`, `origen_alta_id_default`
- Split: `permite_aprobacion_parcial`, `regla_split_remanente_id`, `permite_remanente_sin_articulo`, `permite_nueva_solicitud_remanente`, `requiere_decision_rrhh_para_remanente`, `requiere_auditoria_medica`, …
- Documentación: `documentacion_diferida_habilitada`, `momento_entrega_documentacion_id`, `plazo_documental_post_inicio_dias`, `plazo_documental_tipo_dias_id` → `cfg_tcp_*`, `accion_vencimiento_documental_id`
- Impacto y conflictos: `admite_reemplazo`, `dispara_evento_contrataciones`, `prioridad_normativa_id`, `politica_superposicion_id`, `articulos_incompatibles_ids`, `filtros_elegibilidad`, `metadata`
- Workflow / burbujeo: `logistica_aviso_habilitada` (señal de cobertura/reemplazo), `toma_conocimiento_limitada` (corta burbujeo de acuse), `niveles_burbujeo` (tope de niveles de grupo para el acuse; UI-only hasta módulo Tomas de Conocimiento)
- Límites y cupos: `ambito_consumo_id` (ventana temporal del contador: año civil, ciclo laboral o mes), `cupo_dias_por_ciclo` (tope fijo para no-LAO), `tope_frecuencia_mensual` (max solicitudes/mes), `tope_dias_por_evento` (max días por solicitud)

**`variantes_sarh[]`:** arreglo de objetos `{ codigo_sarh, etiqueta_ui, afecta_sueldo_porcentaje, activo }`.

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

- **`cfg_calendario_feriados_institucional` (`cfg_cfi_*`):** campos mínimos acordados en plan: `fecha`, `tipo`, `alcance_efector_id`, `activo` (más campos comunes de `cfg_*` según MODULO_CONFIGURACION).
- **`cfg_tipo_computo_plazo` (`cfg_tcp_*`):** define si el plazo documental usa días corridos, hábil compuesto u otras semánticas según filas del catálogo (sin hardcode en motor).

---

## 7. Referencias

- [`PROTOCOLO_SEGURIDAD_REVERSION_ARTICULOS_V2.md`](./PROTOCOLO_SEGURIDAD_REVERSION_ARTICULOS_V2.md) (tag Git, export Firestore, rollback antes de código de estructura)
- [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) (§1.6–1.8, matriz §4, catálogos §3)
- [`MODULO_CONFIGURACION_V2.md`](./MODULO_CONFIGURACION_V2.md)
- [`PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md`](./PLAN_UNIFICACION_EVENTOS_RRHH_2026-05-06.md)
- [`ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md`](./ARQUITECTURA_MAESTRA_SIGAL_V2_MODULO_OPERATIVO_ASISTENCIA.md)
