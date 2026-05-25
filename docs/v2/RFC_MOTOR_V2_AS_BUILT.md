# RFC — Motor V2 As-Built: Especificación Técnica Final

> **Estado:** As-Built (refleja el código en producción)
> **Commit de referencia:** `74a2763` (merge paridad arquitectónica V2)
> **Fecha:** 2026-05-25
> **Alcance:** LAO (Patrón A) + Patrón B sobre orquestador unificado

---

## §1 — Arquitectura de Referencia (V2)

### 1.1 Orquestador Unificado: `runMotorPipeline`

El motor V2 elimina la dualidad de motores independientes. Tanto LAO como
Patrón B ejecutan sobre un único pipeline secuencial con early-return:

```
cfg_articulos_versiones/{ver_id}
        │
        ▼
  ┌─────────────┐
  │ ConfigResolver│ ← resolvePatronBMotorConfig() / resolveLaoMotorConfig()
  └──────┬──────┘
         │  config normalizada (defaults explícitos)
         ▼
  ┌─────────────────┐
  │ runMotorPipeline │ ← motorSolicitudOrquestador.js
  │                  │
  │  ┌── fase 1 ──┐ │   motorCheck("P", ..., "ok"|"bloqueante", detalle)
  │  ├── fase 2 ──┤ │   motorCheck("C", ...)
  │  ├── fase N ──┤ │   ... early-return si nivel === "bloqueante"
  │  └────────────┘ │
  └──────┬──────────┘
         │  { eligible, checks[], warnings[], fase_corte, ctx }
         ▼
  ┌──────────────────┐
  │ buildMotorSnapshot│ ← laoMotorAuditoriaSnapshot.js
  └──────┬───────────┘
         │  motor_snapshot (SSoT inmutable)
         ▼
  Firestore: solicitudes_articulo/{sol_id}.motor_snapshot
             solicitudes_articulo/{sol_id}.config_usada
```

### 1.2 Fases por Patrón

| Fase | Patrón B (`patronBAltaMotorV2.js`) | LAO (`laoAltaMotorCompleto.js`) |
|------|-------------------------------------|----------------------------------|
| P/A  | Validar patrón saldo = B            | Asignación core (TSE + matriz)   |
| C    | Validar fechas artículo             | Config LAO (resolver + assert)   |
| E    | Elegibilidad laboral (HLC)          | Elegibilidad laboral (HLC)       |
| W    | Preaviso (advertencias)             | Preaviso (advertencias)          |
| F    | Frecuencia mensual                  | —                                |
| T    | Tope días por evento (<=)           | —                                |
| S    | Saldo ciclo                         | Saldo ciclo LAO                  |
| G    | Grilla horaria                      | —                                |
| L    | —                                   | Superposición fechas LAO         |

### 1.3 Flujo de Inyección de Configuración

```
Firestore: cfg_articulos/{art_id}/versiones/{ver_id}
    │
    │  versionData (7 bloques Zod-validados)
    ▼
ConfigResolver (por patrón)
    │
    │  config plana con defaults explícitos (~70 campos)
    ▼
Fases del pipeline leen config → producen checks
    │
    ▼
buildMotorSnapshot() + build[Patron]ConfigUsada()
    │
    ▼
Persistencia: motor_snapshot + config_usada en solicitud
```

---

## §2 — Contrato de Datos: Mapa de Integridad Semántica

> Generado por `scripts/auditar-campos-patron-b-resolver.mjs` — **0 huérfanos**.

### 2.1 Bloque 1 — Identidad y Naturaleza (16 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `codigo` | `ident.codigo` | Display snapshot |
| `inciso_normativo` | `ident.inciso_normativo` | Display snapshot |
| `nombre` | `ident.nombre` | Display snapshot |
| `normativa_habilitante.decreto` | `normativa.decreto` | Auditoría |
| `normativa_habilitante.resolucion` | `normativa.resolucion` | Auditoría |
| `normativa_habilitante.interno_efector` | `normativa.interno_efector` | Auditoría |
| `es_lao_anual` | `ident.es_lao_anual` | assertPatronSaldoB |
| `es_sancion` | `ident.es_sancion` | Metadatos identidad |
| `es_inasistencia` | `ident.es_inasistencia` | Metadatos identidad |
| `es_sin_goce` | `ident.es_sin_goce` | Metadatos identidad |
| `requiere_dictamen` | `ident.requiere_dictamen` | Metadatos identidad |
| `es_licencia_medica` | `ident.es_licencia_medica` | Metadatos identidad |
| `visualizacion.codigo_grilla` | `vis.codigo_grilla` | Vista grilla |
| `visualizacion.color_ui` | `vis.color_ui` | Vista grilla |
| `fecha_desde` | `ident.fecha_desde` | Vigencia versión |
| `fecha_hasta` | `ident.fecha_hasta` | Vigencia versión |

### 2.2 Bloque 2 — Impacto Económico (6 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `justifica_sueldo_id` | `impacto.justifica_sueldo_id` | Liquidación |
| `suma_para_sac` | `impacto.suma_para_sac` | Liquidación |
| `afecta_presentismo` | `impacto.afecta_presentismo` | Presentismo |
| `acumula_reparto_obra_social` | `impacto.acumula_reparto_obra_social` | Obra social |
| `invalida_reparto_obra_social` | `impacto.invalida_reparto_obra_social` | Obra social |
| `suma_antiguedad_lao` | `impacto.suma_antiguedad_lao` | Antigüedad LAO |

### 2.3 Bloque 3 — Elegibilidad y Filtros (10 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `requiere_declaracion_familiar` | `elegib.requiere_declaracion_familiar` | Gate familiar |
| `edad_limite_familiar` | `elegib.edad_limite_familiar` | Gate familiar |
| `escalafon_ids` | `elegib.escalafon_ids` | Filtro escalafón |
| `agrupamiento_ids` | `elegib.agrupamiento_ids` | Filtro agrupamiento |
| `tipo_vinculo_ids` | `elegib.tipo_vinculo_ids` | Filtro vínculo |
| `cargo_funcional_ids` | `elegib.cargo_funcional_ids` | Filtro cargo |
| `grupo_trabajo_ids` | `elegib.grupo_trabajo_ids` | Filtro grupo |
| `persona_ids` | `elegib.persona_ids` | Filtro persona |
| `genero_ids` | `elegib.genero_ids` | Filtro género |
| `antiguedad_minima_meses` | `elegib.antiguedad_minima_meses` | Gate antigüedad |

### 2.4 Bloque 4 — Topes, Plazos y Cómputo (26 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `regla_computo_dias_id` | `topes.regla_computo_dias_id` | `readModoCalculo` |
| `usa_calendario_institucional` | `topes.usa_calendario_institucional` | Calendario inst. |
| `ambito_consumo_id` | `topes.ambito_consumo_id` | Ámbito consumo |
| `unidad_medida_id` | `topes.unidad_medida_id` | Días vs Horas |
| `unidad_minima_consumo_id` | `topes.unidad_minima_consumo_id` | Fraccionamiento |
| `modulo_fraccionamiento_minutos` | `topes.modulo_fraccionamiento_minutos` | Fraccionamiento |
| `fraccionamiento_habilitado` | `topes.fraccionamiento_habilitado` | Gate fracciones |
| `intervalo_gracia_dias` | `topes.intervalo_gracia_dias` | Gracia saldo |
| `regla_computo_horas_id` | `topes.regla_computo_horas_id` | Modo horas |
| `reinicio_ciclo_id` | `topes.reinicio_ciclo_id` | Patrón saldo |
| `depende_rda` | `topes.depende_rda` | Gate RDA |
| `accion_saldo_id` | `topes.accion_saldo_id` | Acción saldo |
| `multiplicador_valor` | `topes.multiplicador_valor` | Factor horas |
| `origen_saldo_id` | `topes.origen_saldo_id` | Patrón saldo |
| `cupo_dias_por_ciclo` | `topes.cupo_dias_por_ciclo` | Saldo ciclo |
| `tope_frecuencia_mensual` | `topes.tope_frecuencia_mensual` | Fase F |
| `tope_dias_por_evento` | `topes.tope_dias_por_evento` | Fase T (`<=`) |
| `dias_minimos_por_evento` | `topes.dias_minimos_por_evento` | Fase T (mínimo) |
| `nivel_ocupacion_dia_id` | `topes.nivel_ocupacion_dia_id` | Grilla MDC |
| `politica_superposicion_id` | `topes.politica_superposicion_id` | Superposición |
| _`correspondencia_anio`_ | — | **LAO-only** |
| _`fecha_corte_antiguedad`_ | — | **LAO-only** |
| _`matriz_antiguedad_reglas`_ | — | **LAO-only** |
| _`mes_dia_apertura_solicitudes`_ | — | **LAO-only** |
| _`tse_minimo_dias_base`_ | — | **LAO-only** |
| _`permite_calculo_proporcional_tse`_ | — | **LAO-only** |

> Los 6 campos LAO-only son consumidos por `laoMotorConfigResolver.js`.
> El script CI los documenta como skip explícito.

### 2.5 Bloque 5 — Acumulación y Sucesión (5 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `caducidad_tipo_id` | `acum.caducidad_tipo_id` | Vencimiento bolsa |
| `caducidad_limite_meses` | `acum.caducidad_limite_meses` | Límite caducidad |
| `permite_prorroga` | `acum.permite_prorroga` | Gate prórroga |
| `prorroga_articulo_relacion_id` | `acum.prorroga_articulo_relacion_id` | Relación prórroga |
| `meses_arrastre` | `acum.meses_arrastre` | Arrastre mensual |

### 2.6 Bloque 6 — Workflow y SLA (7 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `circuito_ingreso_ids` | `workflow.circuito_ingreso_ids` | Circuito ingreso |
| `plazo_preaviso_normativa_dias` | `workflow.plazo_preaviso_normativa_dias` | Fase W (warning) |
| `plazo_preaviso_interno_dias` | `workflow.plazo_preaviso_interno_dias` | Fase W (warning) |
| `logistica_aviso_habilitada` | `workflow.logistica_aviso_habilitada` | Logística |
| `toma_conocimiento_limitada` | `workflow.toma_conocimiento_limitada` | Workflow |
| `permite_retroactividad` | `workflow.permite_retroactividad` | Gate retroactividad |
| `requiere_toma_conocimiento_superior` | `workflow.requiere_toma_conocimiento_superior` | Workflow |

### 2.7 Bloque 7 — Documentación y Convivencia (6 campos)

| Campo Schema | Consumidor Resolver | Gate/Validación |
|---|---|---|
| `requiere_adjunto_obligatorio` | `docs.requiere_adjunto_obligatorio` | Gate adjunto |
| `requiere_doc_previa` | `docs.requiere_doc_previa` | Gate doc previa |
| `plazo_doc_previa_dias` | `docs.plazo_doc_previa_dias` | Plazo doc |
| `requiere_doc_posterior` | `docs.requiere_doc_posterior` | Gate doc posterior |
| `plazo_doc_posterior_dias` | `docs.plazo_doc_posterior_dias` | Plazo doc |
| `accion_incumplimiento_doc_id` | `docs.accion_incumplimiento_doc_id` | Acción incumpl. |

### 2.8 Totales

| Métrica | Valor |
|---|---|
| Total campos schema | 76 |
| Consumidos por resolver | 70 |
| LAO-only (skip documentado) | 6 |
| **Huérfanos** | **0** |

---

## §3 — Trazabilidad: `motor_snapshot` como SSoT

### 3.1 Estructura del Snapshot

Cada solicitud persiste un `motor_snapshot` inmutable en el momento de la
evaluación. La UI **nunca infiere** la decisión del motor; solo visualiza
lo que el snapshot ya decidió.

```
motor_snapshot: {
  motor_version: "patron-b-v2" | "lao-v2-motor",
  evaluado_en: "2026-05-25T15:30:00.000Z",
  version_aplicada_id: "ver_01KRNY...",
  eligible: true | false,
  checks: [
    { fase: "P", codigo: "PATRON_SALDO_B", nivel: "ok", detalle: "..." },
    { fase: "E", codigo: "ELEGIBILIDAD_OK", nivel: "ok", detalle: "..." },
    ...
  ],
  warnings: [
    { codigo: "PREAVISO_NORMATIVA", copy: "...", campos_origen: [...] }
  ],
  asignacion: { ... },                // bloque de cálculo (si eligible)
  contexto_auditoria: {
    display: { codigo, nombre, inciso_normativo, normativa_habilitante },
    metadatos_identidad: { es_sancion, es_inasistencia, ... },
    impacto: { justifica_sueldo_id, afecta_presentismo, ... },
    workflow: { logistica_aviso_habilitada, ... }
  },
  config_usada: {
    version_aplicada_id: "ver_01KRNY...",
    motor_tipo: "patron-b-v2",
    tope_dias_por_evento: 3,
    regla_computo_dias_id: "cfg_rcd_corridos",
    ...
  }
}
```

### 3.2 Propiedades del Snapshot

1. **Inmutable:** Se escribe una vez al evaluar la solicitud. No se modifica.
2. **Auto-contenido:** Incluye la versión de configuración usada, los checks
   evaluados, y el contexto de auditoría. No requiere join a la versión
   original para entender la decisión.
3. **Desacoplado de la UI:** La bandeja de RRHH lee `motor_snapshot.eligible`,
   `motor_snapshot.checks[]` y `motor_snapshot.warnings[]` directamente.
   Si el configurador cambia mañana, las solicitudes existentes conservan
   su snapshot original.

### 3.3 Desacoplamiento UI ↔ Motor

```
ANTES (V1):                           AHORA (V2):
┌──────┐    inferir    ┌──────┐       ┌──────┐   leer   ┌──────────────┐
│  UI  │──────────────>│Config│       │  UI  │────────>│motor_snapshot│
└──────┘  en runtime   └──────┘       └──────┘          └──────────────┘
                                                              ▲
                                                    escribe una vez
                                                              │
                                                      ┌──────────────┐
                                                      │runMotorPipeline│
                                                      └──────────────┘
```

---

## §4 — Reglas de Negocio Parametrizadas

Las siguientes reglas que en V1 estaban hardcodeadas ahora residen como
datos configurables en `cfg_articulos_versiones`:

### 4.1 LAO (Patrón A)

| Regla | Campo Configurador | Default | Descripción |
|---|---|---|---|
| Apertura temporada | `mes_dia_apertura_solicitudes` | `"07-01"` | Fecha desde la cual se acepta solicitudes LAO |
| TSE mínimo | `tse_minimo_dias_base` | `180` | Días mínimos de servicio para elegibilidad |
| Proporcional TSE | `permite_calculo_proporcional_tse` | `false` | Cupo proporcional si TSE insuficiente |
| Mínimo días por pedido | `dias_minimos_por_evento` | `5` | Piso de días por solicitud |
| Correspondencia año | `correspondencia_anio` | — | Ejercicio fiscal del derecho |
| Corte antigüedad | `fecha_corte_antiguedad` | — | Fecha de corte para cálculo TSE |
| Matriz antigüedad | `matriz_antiguedad_reglas[]` | — | Escala TSE → días otorgados (Ley 1919/89) |

### 4.2 Patrón B

| Regla | Campo Configurador | Default | Decisión V2 |
|---|---|---|---|
| Tope días por evento | `tope_dias_por_evento` | `null` | `<=` (no igualdad estricta) |
| Frecuencia mensual | `tope_frecuencia_mensual` | `null` | Gate por mes calendario |
| Cupo ciclo | `cupo_dias_por_ciclo` | `null` | Saldo total del ciclo |
| Mínimo días | `dias_minimos_por_evento` | `null` | Piso por solicitud |
| Cómputo días | `regla_computo_dias_id` | — | CORRIDOS multi-día desbloqueado |
| Superposición | `politica_superposicion_id` | `null` | Validación entre solicitudes |

### 4.3 Decisiones V2 vs V1

| Aspecto | V1 (Legacy) | V2 (As-Built) |
|---|---|---|
| `tope_dias_por_evento` | Igualdad estricta (`===`) | Menor o igual (`<=`) |
| Multi-día CORRIDOS | `fecha_hasta === fecha_desde` | Rango libre (desbloqueado) |
| Origen de cupo LAO | Hardcodeado en código | `matriz_antiguedad_reglas[]` en config |
| Snapshot de decisión | No existe | `motor_snapshot` inmutable |
| Config usada | No se persiste | `config_usada` en solicitud |
| Motores independientes | 2 codebases separadas | 1 `runMotorPipeline` + N configuraciones |

---

## §5 — Coordinación Transversal: Checklist de Arranque

Matriz de validación para habilitar un nuevo artículo sobre Motor V2:

### 5.1 Pre-requisitos

| # | Verificación | Responsable | Artefacto |
|---|---|---|---|
| 1 | Versión publicada con 7 bloques completos | RRHH Config | `cfg_articulos_versiones/{ver_id}` |
| 2 | Patrón de saldo resuelve correctamente | Motor | `resolvePatronSaldo()` → A o B |
| 3 | ConfigResolver cablea todos los campos | CI | `auditar-campos-patron-b-resolver.mjs` |
| 4 | Tests unitarios pasan (23/23) | CI | `laoAltaMotorCompleto.test.js` |
| 5 | Agente piloto tiene HLC vigente | Datos | `historial_laboral_cargos` |
| 6 | Bolsa de saldo existe para el ciclo | Datos | `saldos_articulo_agente/{doc}` |

### 5.2 Smoke Test E2E

| # | Paso | Validación |
|---|---|---|
| 1 | Crear solicitud (trigger o preview) | No explota |
| 2 | Verificar `motor_snapshot` en Firestore | `eligible`, `checks[]`, `warnings[]` presentes |
| 3 | Verificar `config_usada` en Firestore | `version_aplicada_id`, campos decisionales |
| 4 | Verificar snapshot inmutable | Re-leer después de 5 min, mismo contenido |

### 5.3 Scripts de Soporte

| Script | Propósito |
|---|---|
| `scripts/auditar-campos-patron-b-resolver.mjs` | CI: 0 huérfanos en resolver |
| `scripts/smoke-patron-b-motor-v2.mjs` | E2E: solicitud Patrón B en prod |
| `scripts/smoke-acreditar-lao-bolsa-motor.mjs` | E2E: acreditación LAO en prod |

---

## §6 — Archivos del Sistema

| Archivo | Responsabilidad |
|---|---|
| `motorSolicitudOrquestador.js` | Pipeline genérico, `motorCheck`, `mergeMotivosFromChecks` |
| `patronBAltaMotorV2.js` | 8 fases Patrón B (P/C/E/W/F/T/S/G) |
| `patronBMotorConfigResolver.js` | Resolver 7 bloques → config plana + `buildPatronBConfigUsada` |
| `laoAltaMotorCompleto.js` | 6 fases LAO (A/C/E/W/L/S) sobre `runMotorPipeline` |
| `laoMotorConfigResolver.js` | Resolver LAO-específico |
| `laoMotorAuditoriaSnapshot.js` | `buildMotorSnapshot`, `ensamblarContextoDeAuditoria` |
| `solicitudElegibilidadLaboral.js` | Elegibilidad HLC compartida |
| `validarFechasArticuloRuntime.js` | Validación fechas compartida |
| `resolvePatronSaldo.js` | Clasificador A/B/C |
| `laoSaldosBolsa.js` | Operaciones de bolsa/saldo |

---

## §7 — Historial de Commits

| Commit | Mensaje | Alcance |
|---|---|---|
| `7fbded0` | feat(lao): cerrar RFC motor wiring | LAO V2 core |
| `d20c98c` | feat: Portal V2 completo | Motor LAO, ticketera, grilla MDC |
| `223e265` | feat(patron-b): migración completa motor V2 | Corte directo, snapshot, E2E prod |
| `f8e3a53` | refactor(motor): unificar LAO sobre runMotorPipeline | Paridad arquitectónica |
| `a69ea35` | ci(audit): script auditar campos | 0 huérfanos, 7 bloques |
| `74a2763` | merge: paridad arquitectónica V2 | Hito consolidado en master |
