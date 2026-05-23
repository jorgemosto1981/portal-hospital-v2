# RFC — Cableado configuración LAO ↔ motor de solicitudes (V2)

**Estado:** Implementación avanzada (Fases 3, 1, 2 cerradas en código y prod). Pendiente: CI R5 (§12), cierre doc §15–§16, checklist BD §13.  
**Plan:** [`HANDOFF_SESION_2026-05-23_LAO_MOTOR_WIRING_PAUSA.md`](./HANDOFF_SESION_2026-05-23_LAO_MOTOR_WIRING_PAUSA.md) · Contrato producto: [`MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md`](./MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md) §4.1  
**Relacionados:** [`RFC_LAO_SOLICITUD_VERSION_FIFO_V2.md`](./RFC_LAO_SOLICITUD_VERSION_FIFO_V2.md), [`RFC_TICKETERA_LAO_WIZARD_V2.md`](./RFC_TICKETERA_LAO_WIZARD_V2.md), [`PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md`](./PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md)

---

## 1. Objetivo

Pasar de un **formulario digital** LAO a un **motor de reglas de negocio** donde:

1. Todo campo escalar del configurador de versión tiene **consumidor explícito** (Mapa de Integridad Semántica).
2. Preview y trigger comparten **un orquestador** (`runLaoAltaMotorCompleto`).
3. La UI del agente y la auditoría RRHH leen **`motor_snapshot`** como SSoT (no infieren config cruda).

**Principio producto:** Cero semántica muerta + auditoría total. No todo bloquea; todo está mapeado.

---

## 2. Decisiones cerradas (RRHH / arquitectura)

| Tema | Decisión |
|------|----------|
| Apertura temporada | `mes_dia_apertura_solicitudes` (default `07-01`); comparar **MM-DD de `fecha_desde`**; solo camino proporcional / año en curso |
| TSE | `tse_minimo_dias_base` (default 180); ventana hasta **`fecha_hasta`**; huecos HLC (R1) |
| Proporcional | `permite_calculo_proporcional_tse`; solo si `anio_imputado === anio_actual` |
| Corte matriz | `31/12` del `anio_imputado` o `fecha_corte_antiguedad` explícita |
| Elegibilidad | `resolverElegibilidadSolicitud` + `circuito_ingreso_ids` — **bloqueante** |
| Mínimo días (R3) | Si `disponible >= min_config` → `dias >= min_config`; si `disponible < min_config` → `dias === disponible` |
| Superposición | Igual 64-A — **bloqueante** |
| Preaviso (R4) | Normativo (ej. 15 d) → **advertencia**; institucional → copy; **permite** continuar |
| Retroactividad | Permitida con advertencia en snapshot |
| Snapshot | Embebido en `sol_*` — atómico (R6) |
| Versión aplicada | Congelada al confirmar; config futura no retroactiva (R7) |

---

## 3. Políticas transversales (blindaje RFC)

### 3.1 R5 — Semántica muerta

| Regla | Detalle |
|-------|---------|
| Campo en schema **sin fila** en Mapa §4 | **Ignorado** por el motor de alta LAO |
| CI `scripts/auditar-campos-version-consumidos-lao.mjs` | Falla si hay huérfanos no documentados |
| RRHH ante alerta | Formalizar en mapa o eliminar del schema |
| Excepciones válidas | `N/A LAO`, `Fuera motor` — documentadas en §4 |

### 3.2 R6 — Transaccionalidad del snapshot

- `motor_snapshot` y `config_usada` viven **en el documento** `solicitudes_articulo/{sol_id}`.
- **No** subcolección ni colección externa para auditoría motor (MVP).
- Trigger persiste snapshot en la misma escritura que valida invariantes (o rechazo con snapshot parcial en el mismo doc).
- `simularLaoPreview` devuelve el mismo shape; no persiste hasta envío agente.

### 3.3 R7 — Inmutabilidad de versión

1. **Resolución:** versión PUBLICADA vigente para `fecha_desde` + `correspondencia_anio` = `anio_origen_bolsa`.
2. **Congelación:** al confirmar solicitud → `version_aplicada_id`, `motor_snapshot`, `config_usada` inmutables en `sol_*`.
3. **RRHH:** ediciones posteriores en configurador no alteran solicitudes ya originadas.
4. **Soporte:** mensaje tipo *"No cumple [x] según versión [ver_id] capturada en snapshot"*.

---

## 4. Mapa de Integridad Semántica

Leyenda **Gate:** `B` bloqueante · `A` advertencia · `I` informativo · `N/A` · `FM` fuera motor.

### 4.1 Identidad y metadatos

| Campo | Fase | Gate | Consumidor |
|-------|------|------|------------|
| `es_lao_anual` | A | B | Assert artículo LAO |
| `codigo`, `nombre`, `inciso_normativo` | I | I | Display + `contexto_auditoria.display` |
| `normativa_habilitante.*` | I | I | Snapshot display |
| `fecha_desde`, `fecha_hasta` (versión) | A | B | Resolución versión vigente |
| `es_sancion`, `es_inasistencia`, `es_sin_goce`, `es_licencia_medica`, `requiere_dictamen` | I | I | Metadato auditoría |
| `visualizacion.codigo_grilla`, `color_ui` | M/I | I | MDC + UI |
| `version_semantica`, `estado_version_id`, `publicada_*` | — | FM | Ciclo publicación |

### 4.2 Impacto económico

| Campo | Fase | Gate | Consumidor |
|-------|------|------|------------|
| `justifica_sueldo_id`, `suma_para_sac`, `afecta_presentismo` | I | I | `motor_snapshot.impacto.nomina` |
| `acumula_reparto_obra_social`, `invalida_reparto_obra_social` | I | I | Idem |
| `suma_antiguedad_lao` | L | — | Exclusiones TSE otras solicitudes |

### 4.3 Elegibilidad

| Campo | Fase | Gate | Consumidor |
|-------|------|------|------------|
| `escalafon_ids`, `agrupamiento_ids`, `tipo_vinculo_ids`, `cargo_funcional_ids`, `grupo_trabajo_ids`, `persona_ids`, `genero_ids` | E | B | `resolverElegibilidadSolicitud` |
| `antiguedad_minima_meses` | E | B | Idem |
| `requiere_declaracion_familiar`, `edad_limite_familiar` | E | B | Check DDJJ / edad |
| Filtros §1.7 subdocs | — | FM | Fase posterior |

### 4.4 Topes, plazos y cómputo

| Campo | Fase | Gate | Consumidor |
|-------|------|------|------------|
| `regla_computo_dias_id`, `usa_calendario_institucional` | C/E | B | `validarFechasArticulo` |
| `unidad_medida_id`, `unidad_minima_consumo_id` | A/C | B | LAO = días |
| `regla_computo_horas_id` | — | N/A | Null en LAO |
| `fraccionamiento_*`, `modulo_fraccionamiento_minutos` | — | N/A | Unidad días |
| `intervalo_gracia_dias` | C | B | Validación rango |
| `multiplicador_valor` | C | I | Snapshot si ≠ 1 |
| `reinicio_ciclo_id`, `origen_saldo_id`, `accion_saldo_id` | A | B | Patrón A |
| `depende_rda` | E | B | Grilla MDC |
| `cupo_dias_por_ciclo` | L | B | Tope superior si cargado |
| `tope_dias_por_evento` | C/E | B | Máximo por evento |
| `dias_minimos_por_evento` | C/S | B | R3 condicional saldo |
| `tope_frecuencia_mensual`, `ambito_consumo_id` | E | B | Conteo mes Patrón B |
| `correspondencia_anio` | A/S | B | Invariante versión/bolsa |
| `fecha_corte_antiguedad` | L | B | Corte matriz |
| `matriz_antiguedad_reglas` | L | B | Escalón + días base |
| `mes_dia_apertura_solicitudes` | L | B | Gate apertura proporcional |
| `tse_minimo_dias_base` | L | B | Gate TSE |
| `permite_calculo_proporcional_tse` | L | B | Gate 3 |
| `nivel_ocupacion_dia_id` | M | I | Payload MDC |
| `politica_superposicion_id` | E | B | `validarSuperposicionFechasPatronB` |

### 4.5 Acumulación y workflow

| Campo | Fase | Gate | Consumidor |
|-------|------|------|------------|
| `caducidad_tipo_id`, `caducidad_limite_meses` | S | B | Bolsa no vencida |
| `permite_prorroga`, `prorroga_articulo_relacion_id` | W | I | Snapshot / prórroga posterior |
| `meses_arrastre` | S | I | Check informativo |
| `circuito_ingreso_ids` | E | B | Elegibilidad |
| `plazo_preaviso_normativa_dias` | W | A | R4 |
| `plazo_preaviso_interno_dias` | W | A | Copy institucional |
| `permite_retroactividad` | W | A | Fechas pasadas |
| `logistica_aviso_habilitada`, `toma_conocimiento_*` | W | I | `motor_snapshot.workflow` |
| `pasos_aprobacion`, SLA §1.7 | — | FM | Post-alta |

### 4.6 Documentación

| Campo | Fase | Gate | Consumidor |
|-------|------|------|------------|
| `requiere_adjunto_obligatorio` | D | B | Wizard envío |
| `accion_incumplimiento_doc_id` | D/I | I | Snapshot |
| `requiere_doc_previa`, `requiere_doc_posterior` | W | B | Plazos workflow |
| `plazo_doc_previa_dias`, `plazo_doc_posterior_dias` | W | B | Idem |

### 4.7 Fuera del orquestador de alta

- Subcolecciones §1.7 (`filtros_*` subdocs, `pasos_aprobacion`, `sla_por_paso`).
- Grafo `cfg_articulo_relaciones`.
- Nómina/presentismo en tiempo real (solo snapshot).
- Núcleo `cfg_articulos` (`activo`, `estado_articulo_id`) — capa catálogo.

---

## 5. Schema `motor_snapshot` (SSoT UI)

Persistido en **`solicitudes_articulo/{sol_id}`** junto con `version_aplicada_id` congelada.

```text
motor_snapshot: {
  motor_version: "lao-preview-v2",
  evaluado_en: Timestamp,
  version_aplicada_id: "ver_*",          // congelado R7
  config_usada: {                         // subset decisión, no doc completo
    tse_minimo_dias_base,
    mes_dia_apertura_solicitudes,
    permite_calculo_proporcional_tse,
  },
  checks: [{
    fase: "A"|"E"|"W"|"L"|"S"|"D"|"I",
    codigo: string,
    nivel: "bloqueante"|"advertencia"|"ok",
    detalle: string,
  }],
  warnings: [{
    codigo: "PREAVISO_FUERA_NORMA" | ...,
    copy: string,
    campos_origen: string[],
  }],
  asignacion: {
    camino: "stock"|"proporcional"|"pleno"|"rechazado",
    dias_tse,
    tse_minimo_aplicado,
    dias_base_matriz,
    dias_proporcionales,
    fecha_corte_aplicada,
    inicio_tramo_anio_imputado,
  },
  contexto_auditoria: {
    display: { codigo, nombre, inciso, normativa_habilitante },
    metadatos_identidad: { es_sancion, ... },
    impacto: { justifica_sueldo_id, obra_social_flags, ... },
    workflow: { logistica_aviso, toma_conocimiento_* },
  },
  eligible: boolean,
}
```

**Frontend:** paso 3 wizard y bandeja RRHH **solo renderizan** este objeto.

**Función:** `ensamblarContextoDeAuditoria(versionData)` — invocada siempre (éxito o early return).

---

## 6. Orquestador — pipeline

Entrypoint único: `runLaoAltaMotorCompleto` (`functions/modules/shared/laoAltaMotorCompleto.js`).

```text
A (artículo/versión/patrón A)
  → E (elegibilidad, fechas, topes, superposición, RDA, frecuencia)
  → W (preaviso, retroactividad, doc previa/posterior)
  → L (apertura, TSE, matriz, pleno/proporcional)
  → S (FIFO, caducidad, saldo, R3 mínimo)
  → D/I (adjuntos, ensamblarContextoDeAuditoria, persistir snapshot)
```

| Callable / trigger | Uso |
|--------------------|-----|
| `simularLaoPreview` | Preview; mismo orquestador; no escribe Firestore |
| `validarEntornoOperativo` (rama LAO) | Subconjunto E+W+C en paso 2 wizard |
| `solicitudArticuloLaoOnCreate` | Orquestador completo + snapshot en `sol_*` |

---

## 7. Árbol de decisión asignación (fase L)

**Precondición:** `anio_solicitud` vs `anio_imputado` → `stock` | `proporcional` | `error_ano`.

| Gate | Condición | Error |
|------|-----------|-------|
| 1 Apertura | Solo proporcional: MM-DD(`fecha_desde`) ≥ `mes_dia_apertura_solicitudes` | `ERROR_APERTURA_TEMPORADA` |
| 2 TSE | `dias_TSE` (huecos HLC, hasta `fecha_hasta`) ≥ `tse_minimo_dias_base` | → Gate 3 |
| 2b Pleno | TSE OK | Matriz al corte |
| 3 Proporcional | TSE NOK ∧ `anio_imputado === anio_actual` ∧ `permite_calculo_proporcional_tse` | Floor meses |
| 3b Rechazo | TSE NOK ∧ no Gate 3 | `ERROR_TSE_INSUFICIENTE` o `ERROR_TSE_INSUFICIENTE_ANIO_VENCIDO` |

### R1 — TSE con huecos HLC

- `dias_TSE` = días con cobertura HLC activa en [01/01 año civil .. `fecha_hasta`], menos exclusiones por licencias con `suma_antiguedad_lao = false` en otras versiones.
- **No** usar solo mínima `fecha_inicio` histórica HLC.
- Helper: `computeDiasTseServicioEfectivo`.

### R3 — Mínimo días

```text
minConfig = dias_minimos_por_evento ?? 0
disp = bolsa.disponible
Si disp >= minConfig → dias_solicitados >= minConfig
Si disp < minConfig  → dias_solicitados === disp
```

---

## 8. Códigos de error (catálogo inicial)

| Código | Fase | Gate |
|--------|------|------|
| `ERROR_NO_LAO` | A | B |
| `ERROR_VERSION_NO_VIGENTE` | A | B |
| `ERROR_PATRON_SALDO_NO_A` | A | B |
| `ERROR_CORRESPONDENCIA_ANIO` | A/S | B |
| `ERROR_ELEGIBILIDAD` | E | B |
| `ERROR_SUPERPOSICION` | E | B |
| `ERROR_RDA_REQUERIDA` | E | B |
| `ERROR_TOPE_FRECUENCIA_MES` | E | B |
| `ERROR_DIAS_MINIMOS` | C/S | B |
| `ERROR_TOPE_DIAS_EVENTO` | C | B |
| `ERROR_APERTURA_TEMPORADA` | L | B |
| `ERROR_TSE_INSUFICIENTE` | L | B |
| `ERROR_TSE_INSUFICIENTE_ANIO_VENCIDO` | L | B |
| `ERROR_SALDO_INSUFICIENTE` | S | B |
| `ERROR_FIFO_ANIO` | S | B |
| `ERROR_BOLSA_CADUCADA` | S | B |
| `ERROR_ADJUNTO_OBLIGATORIO` | D | B |
| `ERROR_DOC_PREVIA_PLAZO` | W | B |
| `PREAVISO_FUERA_NORMA` | W | A |
| `PREAVISO_RETROACTIVIDAD` | W | A |

---

## 9. Flujo operativo RRHH (resumen)

```text
CONFIGURAR versión → PUBLICAR → (check-in < A | acreditación ≥ A)
        ↓
AGENTE wizard: 1 Disponibilidad → 2 Fechas → 3 Derecho (motor_snapshot)
        ↓
ENVÍO → trigger → snapshot embebido en sol_* (R6, R7)
        ↓
RRHH audita motor_snapshot (incluso si rechazo temprano en preview)
```

### Wizard — validaciones por paso

| Paso | Validaciones principales | Gate |
|------|-------------------------|------|
| 1 | Versión LAO, FIFO, filtro bolsas futuras (R2) | B / filtro UI |
| 2 | Grupo ancla, fechas, cómputo días, R3 min/max | B |
| 3 | Orquestador preview → `motor_snapshot` | B + A + I |
| Envío | Adjunto obligatorio, re-trigger motor | B |

---

## 10. Breaking changes (`lao-preview-v1` → `v2`)

| Tema | v1 (hoy) | v2 |
|------|----------|-----|
| TSE umbral | Hardcode 180 | `tse_minimo_dias_base` |
| Apertura | Hardcode 01/07 | `mes_dia_apertura_solicitudes` |
| Horizonte TSE | Hasta `fecha_desde` | Hasta **`fecha_hasta`** |
| Corte matriz | `fecha_desde` solicitud | 31/12 ejercicio o `fecha_corte_antiguedad` |
| Elegibilidad / superposición / preaviso | No cableado | Orquestador |
| UI config | Inferida | Solo `motor_snapshot` |

---

## 11. Nuevos campos configurador (schema)

Solo si `es_lao_anual`; si no LAO → `null`.

| Campo | Default | Uso |
|-------|---------|-----|
| `mes_dia_apertura_solicitudes` | `07-01` | Gate apertura |
| `tse_minimo_dias_base` | `180` | Gate TSE |
| `permite_calculo_proporcional_tse` | `true` | Gate 3 |

Schema: [`web/src/schemas/articulo.schema.js`](../../web/src/schemas/articulo.schema.js).

---

## 12. Script CI — auditoría campos

**Ruta:** `scripts/auditar-campos-version-consumidos-lao.mjs`

1. Extrae hojas de campo de `cfgArticuloVersionSchema` (Zod).
2. Compara con union del Mapa §4 + categorías `N/A LAO` + `Fuera motor`.
3. Exit code ≠ 0 si hay huérfanos → notificación RRHH para formalizar o limpiar.

---

## 13. Migración datos RRHH

| Dato | Acción |
|------|--------|
| `fecha_corte_antiguedad: 2000-12-31` | Corregir a `null` o `YYYY-12-31` del ejercicio |
| `codigo_grilla: null` | Publicar ej. `LAO` |
| Campos motor nuevos ausentes | Resolver defaults en código hasta re-guardado |

---

## 14. Código objetivo (implementación)

| Pieza | Ruta |
|-------|------|
| Orquestador | `functions/modules/shared/laoAltaMotorCompleto.js` |
| Auditoría snapshot | `functions/modules/shared/laoMotorAuditoriaSnapshot.js` |
| Config resolver | `functions/modules/shared/laoMotorConfigResolver.js` |
| Asignación cupo | `functions/modules/shared/laoAsignacionDiasCore.js` |
| Motor común Patrón B | `functions/modules/shared/solicitudMotorComun.js` |
| Preview callable | `functions/onCall/solicitudes/simularLaoPreview.js` |
| Trigger | `functions/triggers/solicitudArticuloLaoOnCreate.js` |
| Wizard | `web/src/pages/LaoWizardTicketera.jsx` |

---

## 15. Criterios de aceptación (extracto)

1. Cambiar `tse_minimo_dias_base` en versión altera preview **sin redeploy**.
2. R3: disp=4, min=5 → exactamente 4 días OK.
3. Superposición bloquea como 64-A.
4. Preaviso &lt; 15 d → advertencia, trámite permitido.
5. Snapshot embebido en `sol_*`; paridad preview/trigger.
6. Rechazo por elegibilidad incluye `contexto_auditoria`.
7. CI campos: 0 huérfanos no documentados.
8. Editar versión post-alta no cambia snapshot de solicitudes existentes.

---

## 16. Pendiente implementación

- [x] Schema + configurador (3 campos motor LAO) — Fase 3 · prod OK
- [x] Orquestador + `ensamblarContextoDeAuditoria` + wizard paso 3 + bandeja RRHH
- [x] Wire callables / trigger (`simularLaoPreview`, `onSolicitudArticuloLaoMotorValidate`)
- [x] Superposición bloqueante fase E (`laoSuperposicionMotor`) — prod OK
- [x] Eliminar `laoPreviewMotor.js` v1; `acreditarLaoBolsaAgente` → motor v2
- [x] Tests R1–R4 + orquestador + date utils (26 tests motor)
- [ ] Script CI auditoría (`scripts/auditar-campos-version-consumidos-lao.mjs`) — **Fase 4**
- [ ] Checklist BD greenfield §13 (operativa RRHH)
- [ ] Actualizar MODULO §4.1 y criterios §15 al cierre — **Fase 6**

**Retomar:** [`HANDOFF_SESION_2026-05-23_LAO_MOTOR_WIRING_PAUSA.md`](./HANDOFF_SESION_2026-05-23_LAO_MOTOR_WIRING_PAUSA.md)

---

## Changelog

| Fecha | Nota |
|-------|------|
| 2026-05-23 | Borrador base: mapa integridad, R5–R7, snapshot SSoT, flujo RRHH |
| 2026-05-23 | Fases 3+1+2 implementadas; v1 eliminado; deploy prod; pausa antes Fase 4 CI |
