# Contrato de configuración — Art. CAMBIO-DIA (Etapa 1)

**Estado:** contrato de producto · rama `feat/etapa1-cambio-dia` · 2026-07-08  
**Principio:** *configurável* en ABM artículos (`cfg_articulos` + versión publicada). **Prohibido** hardcodear reglas de negocio en el wizard React.

Relacionados: [`ETAPA1_GO_LIVE_V2.md`](../ETAPA1_GO_LIVE_V2.md) · [`ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md`](../ACTA_RRHH_ETAPA1_VIDA_REAL_V2.md) · schema [`web/src/schemas/articulo.schema.js`](../../web/src/schemas/articulo.schema.js)

---

## 1. Decisiones de producto (cerradas)

| Regla | Valor |
|-------|--------|
| Nombre / código | **Cambio de día (traslado propio)** / `CAMBIO-DIA` |
| Autorización jefe | **Sí** → alta en `cfg_esa_en_revision_jefe` (bandeja jefe) |
| Descuenta saldo / cupo | **No** (`cupo_dias_por_ciclo: null`, sin Fase S de bolsa) |
| Límite de uso anual/mensual | **Ninguno** (`tope_frecuencia_mensual: null`) |
| Retroactivo | **No** (`permite_retroactividad: false`) |
| Anticipación mínima | **2 días** — `plazo_preaviso_interno_dias: 2` (editable en ABM / workflow) |
| Wizard UI | `fecha_origen`, `fecha_destino`, `motivo` |
| Aplicación al aprobar | Server reutiliza **B-BATCH** traslado propio; fallo → estado remediación RRHH |
| Filtros elegibilidad grilla | Origen laborable/con turno; destino franco/apto; mismos régimen/cargo GDT ancla; tope movimientos vigente |

---

## 2. Por qué no el JSON “plano” propuesto

El ejemplo con `configuracion: { requiere_autorizacion_jefe, filtros_elegibilidad, … }` es **válido como lenguaje de producto**, pero el runtime V2 ya tiene contrato de **7 bloques** + subcolecciones. RRHH edita por ABM; el motor lee `version_id`.

Mapeo:

| Idea de producto | Campo / bloque real V2 |
|------------------|-------------------------|
| `codigo_operativo` / nombre | Core `codigo`, `nombre` + identidad `visualizacion.codigo_grilla` |
| `requiere_autorizacion_jefe: true` | Flujo ticketera estándar (alta → `en_revision_jefe`); circuito `CFG_USUARIO`…; **no** auto-aprueba |
| `descuenta_saldo: false` / sin límite | `bloque_topes_plazos_computo.cupo_dias_por_ciclo = null`, `tope_frecuencia_mensual = null`, `accion_saldo_id` neutro o sin materializar bolsa |
| `retroactivo.permitido: false` | `bloque_workflow_sla_cobertura.permite_retroactividad = false` |
| Anticipación mínima N días | `bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias = N` (null = solo “≥ hoy”) |
| Campos wizard | Extensión versión `cambio_dia_solicitud` (abajo) — paralelo a `opciones_consumo_solicitud` del 63.j |
| Filtros origen/destino | Misma extensión + validación en Functions (preview/alta/aprobación) contra grilla/`vis_*` |

**IDs:** se generan `art_<ULID>` / `ver_<ULID>` al seed (como oleada 63), **no** `art_CAMBIODIA_001`.

---

## 3. Shape de versión (seed / ABM)

### 3.1 Core `cfg_articulos`

```json
{
  "codigo": "CAMBIO-DIA",
  "inciso_normativo": "Operativo GSO — traslado propio (Etapa 1)",
  "nombre": "Cambio de día (traslado propio)",
  "origen_normativo_id": "cfg_ona_resolucion_institucional",
  "activo": true,
  "estado_articulo_id": "cfg_est_art_vigente",
  "es_sancion": false,
  "es_inasistencia": false,
  "es_sin_goce": false,
  "requiere_dictamen": false
}
```

*(Si `cfg_ona_interno_efector` no existe en seeds, usar el origen normativo interno vigente del hospital o alta previa en catálogo.)*

### 3.2 Bloques clave de la versión publicada

```json
{
  "bloque_identidad_naturaleza": {
    "codigo": "CAMBIO-DIA",
    "nombre": "Cambio de día (traslado propio)",
    "es_lao_anual": false,
    "es_licencia_medica": false,
    "visualizacion": { "codigo_grilla": "C-DIA", "color_ui": "#0F766E" }
  },
  "bloque_impacto_economico": {
    "justifica_sueldo_id": "cfg_js_si_completo",
    "suma_para_sac": true,
    "afecta_presentismo": false
  },
  "bloque_elegibilidad_filtros": {
    "escalafon_ids": [],
    "grupo_trabajo_ids": [],
    "antiguedad_minima_meses": 0
  },
  "bloque_topes_plazos_computo": {
    "regla_computo_dias_id": "cfg_rcd_corridos",
    "reinicio_ciclo_id": "cfg_rcc_anual",
    "origen_saldo_id": "cfg_os_interno",
    "accion_saldo_id": "cfg_as_neutro",
    "cupo_dias_por_ciclo": null,
    "tope_frecuencia_mensual": null,
    "tope_dias_por_evento": 1,
    "dias_minimos_por_evento": 1,
    "unidad_medida_id": "cfg_uma_dias",
    "nivel_ocupacion_dia_id": "cfg_nod_exclusivo",
    "depende_rda": true
  },
  "bloque_workflow_sla_cobertura": {
    "circuito_ingreso_ids": ["CFG_USUARIO", "CFG_RRHH", "CFG_MEDICO", "CFG_VISUALIZADOR"],
    "permite_retroactividad": false,
    "plazo_preaviso_interno_dias": 2,
    "plazo_preaviso_normativa_dias": null,
    "toma_conocimiento_limitada": false,
    "requiere_toma_conocimiento_superior": false
  },
  "bloque_documentacion_convivencia": {
    "requiere_adjunto_obligatorio": false,
    "requiere_doc_previa": false,
    "requiere_doc_posterior": false,
    "accion_incumplimiento_doc_id": "cfg_aid_solo_notificacion"
  },
  "cambio_dia_solicitud": {
    "schema": "CAMBIO_DIA_V1",
    "campos_requeridos": ["fecha_origen", "fecha_destino", "motivo"],
    "origen_celdas_ok": ["laborable_con_turno"],
    "destino_celdas_ok": ["franco", "apto_sin_turno_exclusivo"],
    "aplica_batch": "traslado_propio_b_batch",
    "motivo_max_len": 500
  }
}
```

**Notas motor:**

- Sin cupo → no descuenta saldo Patrón B (misma familia operativa que 63.j sin bolsa de ciclo).
- **`reinicio_ciclo_id: cfg_rcc_anual`** aunque no haya cupo: necesario para que `resolvePatronSaldo` clasifique **B** y entre al listado de ticketera. La extensión `cambio_dia_solicitud` distingue el wizard.
- `depende_rda: true` → la verdad de origen/destino se valida contra grilla/RDA al preview y al aprobar.
- Extensión `cambio_dia_solicitud` se edita en pestaña Avanzado del configurador (como opciones 63.j); Zod se amplía en la misma oleada.

### 3.3 Payload `sol_*` (alta)

Además del contrato Patrón B mínimo:

- `fecha_origen`, `fecha_destino` (YYYY-MM-DD)
- `motivo` (string)
- `grupo_trabajo_id_ancla`
- snapshot de tramos origen (opcional pero recomendado al crear)

Estados:

| Momento | `estado_solicitud_id` |
|---------|------------------------|
| Tras alta válida | `cfg_esa_en_revision_jefe` |
| Jefe rechaza | `cfg_esa_rechazada` |
| Jefe aprueba + B-BATCH OK | `cfg_esa_aprobada` (+ TC RRHH) |
| Jefe aprueba + B-BATCH falla | `cfg_esa_aprobada_pendiente_aplicacion` *(alta catálogo si no existe)* — bandeja remediación RRHH |

---

## 4. Anticipación mínima (cerrada)

**Opción C — `plazo_preaviso_interno_dias: 2`.**

- `fecha_origen` y `fecha_destino` deben ser ≥ hoy + 2 días (calendario institucional).
- Editable desde menú configuración de artículos (bloque workflow) sin redeploy.
- Justificación: margen para que el jefe gestione bandeja antes de la fecha origen y no se rompa cobertura.

---

## 5. Entregables de implementación (Paso 4)

1. Spec JSON + builder + `apply-cambio-dia.mjs` (mismo patrón oleada 63).  
2. Extensión Zod/`cambio_dia_solicitud` + labels configurador.  
3. Wizard ticketera (sin UI de saldos).  
4. Callables preview/alta + validaciones retroactividad / elegibilidad celda.  
5. Al aprobar jefe → B-BATCH; remediación si falla.  
6. Agregar `art_*` resultante a `articulo_ids_etapa1` en `cfg_etapa1/runtime`.

---

*Fin contrato.*
