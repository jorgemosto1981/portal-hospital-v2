# Brechas funcionales — bandeja auditoría médica (épica 1919 P4)

**Propósito:** dejar explícito qué **ya opera en piloto** (motor + callables + MDC) frente a lo que **falta en UI** para que el médico auditor pueda dictaminar sin herramientas paralelas (Firebase Console, scripts).

**Audiencia:** RRHH, medicina laboral, equipo de desarrollo.  
**Estado motor:** validado por smokes `scripts/smoke/med-*.mjs` y UAT de circuito Art. 14 / derivación junta.  
**Estado UI auditor:** P0–P3 + P2b + **P4.3b historial inline** — **UAT VERDE 2026-07-03** · smoke **7/7 PASS**. Handoff: [`HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md`](./HANDOFF_SESION_2026-07-03_SMOKE_INTEGRACION_AUDITOR_MEDICO.md).  
**Backlog productividad:** **C1** ✅ · **C2** ✅ `master` tag `v1919-C2-cie10` — [`HANDOFF_SESION_2026-07-06_CIERRE_C2_CIE10_CLASIFICACION.md`](./HANDOFF_SESION_2026-07-06_CIERRE_C2_CIE10_CLASIFICACION.md).

**Referencias normativas:**

- [`RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md`](./RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md) — §5 (contrato auditor), §5.8 (señales UI), §9 ítem **4** (bandeja pendiente).
- [`ACTA_RRHH_EPICA_1919_P4_V2.md`](./ACTA_RRHH_EPICA_1919_P4_V2.md) — alcance cerrado en motor y bandejas mínimas.
- [`ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md`](./ACTA_RRHH_EPICA_1919_P4_4_LARGAS_V2.md) — metadatos larga en listado; misma brecha de visor/clasificación sustantiva.

---

## 1. Qué sí está entregado (no es brecha)

| Capa | Entregable |
|------|------------|
| **Datos** | `solicitudes_articulo` con `SOL_MED_AVISO_V1`, `ingreso_medico`, adjuntos en Storage |
| **Cola** | `listarSolicitudesBandejaAuditorMedica` + `/portal/medico/solicitudes` |
| **Transiciones** | `clasificarSolicitudMedicaAuditor`, `registrarDictamenJuntaMedica` |
| **MDC** | `mutarEstadoSolicitudMedicaMdc`, proyección LM/LM-P, consolidación post-aprobación |
| **Motor P4** | Tramos Art. 14, episodio larga, acumulador solo en `cfg_esa_aprobada` |
| **Agente** | `/portal/solicitudes/aviso-medico`, incompleta + plazo G3 |

El riesgo actual **no** es integridad de datos ni desborde del motor; es **productividad y escalabilidad** del dictamen en pantalla (ver §backlog productividad).

---

## 1.1 Estado de brechas UI — actualizado P4.3b (2026-07-03)

| Ítem | Estado | Nota |
|------|--------|------|
| **Visor PDF (P0)** | **COMPLETO** | `VisorPDF` en bandeja auditor |
| **Ficha ingreso agente (P1)** | **COMPLETO** | `ficha_ingreso_agente` en listado + `FichaIngresoAgente` |
| **Selector artículo (P2)** | **COMPLETO** | `BandejaAuditorArticuloImputacionSelect` |
| **Fechas editables (P2b)** | **COMPLETO** | Banner + preview en vivo + `fechas_corregidas_por_auditor` |
| **Preview tramos / consumo (P3)** | **COMPLETO** | `BandejaAuditorPreviewTramos` + callable preview |
| **Historial LM preview (P3)** | **COMPLETO** | `historial_consumo_corta` en acordeón del preview |
| **Historial LM inline (P4.3b)** | **COMPLETO** | `HistorialLMCollapse` en ficha; lazy-load; callable `obtenerHistorialLmTitularBandejaAuditor` @ `2704ff2` |
| **Paginación / búsqueda bandeja (C1)** | **COMPLETO** | `solicitudBandejaAuditorPaginacionCore` @ `master` tag `v1919-C1-bandeja-optimizada` |
| **CIE-10 + causal Art. 19 en clasificación (C2)** | **COMPLETO** | `BandejaAuditorCie10Imputacion` + `BandejaAuditorCausalLargaImputacion`; UAT `sol_01KWWKBEAJQ866ATXZGAB275P1` @ tag `v1919-C2-cie10` |

**Backlog productividad (Opción C — post-cierre P4):** ~~paginación~~ · ~~CIE-10/causal clasificación~~ · señales §5.8 · modal historial completo.

## 2. Matriz brecha — actual vs objetivo RFC

| Función | P4 actual (UI + listado) | Objetivo RFC / producto |
|---------|--------------------------|-------------------------|
| **Visor clínico** | **P0 + P1 entregados** (`VisorPDF` + `FichaIngresoAgente`) | PDF + ficha `ingreso_medico` |
| **Adjuntos** | Listado + visor en bandeja (Storage `getDownloadURL`) | Callable de lectura solo si Rules se endurecen |
| **Diagnóstico CIE-10** | **C2 COMPLETO** — editable en bandeja; larga obligatorio; `listarCie10BandejaAuditor` | Lectura/edición en bandeja; larga: obligatorio antes de clasificar |
| **Clasificación sustantiva** | **P2 + P2b + C2** — artículo, fechas, CIE-10, causal Art. 19 (larga) | Causal Art. 19 editable si larga |
| **Preview tramos / consumo** | **P3** — `previsualizarClasificacionMedicaAuditor` + `BandejaAuditorPreviewTramos` | Mismo motor; copy validado en piloto |
| **Historial** | **P3 preview** + **P4.3b inline** en ficha (últimos 5 LM con outcome; lazy-load) | Modal historial completo si >25 eventos (**backlog**) |
| **Señales §5.8** | Filtros completas/provisorias | **Brecha** — countdown incompleta, badges críticos |
| **Bandeja junta** | Misma familia: metadatos + dictamen | Mismas brechas de certificado y contexto de consumo |

**Implementación UI relevante hoy:** `web/src/pages/BandejaAuditorSolicitudes.jsx`, `BandejaAuditorSolicitudDetalle.jsx`, `bandejaSolicitudExpandDatos.js`.  
**Listado backend:** `solicitudBandejaAuditorMedicaCore.js` — DTO ampliado P1 (`ficha_ingreso_agente`, adjuntos); scan en memoria límite 400 (**brecha escalabilidad**).

---

## 4. Priorización sugerida — backlog productividad (post-cierre P4)

Orden recomendado tras validación RRHH 2026-07-03:

| Prioridad | Ítem | Justificación |
|-----------|------|----------------|
| **C1** | Paginación + búsqueda DNI/nombre en bandeja | ✅ `master` |
| **C2** | CIE-10 + causal Art. 19 en clasificación | ✅ UAT 2026-07-06 |
| **C3** | Señales §5.8 (countdown incompleta, alertas) | Operación mesa sin sorpresas |
| **C4** | Modal historial completo (>25 eventos) | Complemento P4.3b sin saturar la ficha |

### Histórico oleadas UI (cerradas)

| Oleada | Ítem | Estado |
|--------|------|--------|
| P0 | Visor certificado | ✅ |
| P1 | Detalle aviso / ficha agente | ✅ @ `72e5a87` |
| P2 | Selector artículo | ✅ |
| P2b | Fechas editables + trazabilidad | ✅ @ `ac2adba` |
| P3 | Preview tramos/consumo | ✅ |
| P4.3b | Historial LM inline en ficha | ✅ @ `2704ff2` |

---

## 3. Mitigación operativa (soporte piloto)

| Herramienta | Uso |
|-------------|-----|
| **`scripts/inspect-solicitud.mjs`** | Back-office: leer `sol_*`, rutas de adjuntos, estados, fechas estimadas |
| **Firebase Console** | Storage (`avisos-med/…`) + documento `solicitudes_articulo` |
| **Smokes** | Reproducir clasificación/junta sin depender de la bandeja |

Recomendación de gobernanza: tratar `inspect-solicitud.mjs` como **interfaz de soporte oficial** en piloto hasta oleada UI Fase 4.

---

## 4.1 Priorización histórica (oleadas P0–P4.3b — cerradas)

Las oleadas P0–P4.3b están **cerradas** (ver §1.1). La priorización activa es el **backlog productividad** §4 (C1–C4).

**Fuera de alcance explícito (salvo nueva definición RRHH):** historia clínica ambulatoria, interoperabilidad HC, OCR de certificados.

---

## 5. Decisiones para comité RRHH (cerradas en validación 2026-07-03)

Antes de estimar la oleada, conviene cerrar:

1. ¿El **visor PDF** basta en V1 o se exige descarga/archivo en expediente?
2. ¿El auditor **debe** poder cambiar fechas respecto al reposo estimado del agente, o solo confirmar?
3. ¿**Historial** = solo días Art. 14 consumidos + listado de `sol_*` aprobadas, o incluye otro reporte institucional?
4. ¿Junta y auditor comparten el **mismo panel de detalle** o dos layouts?
5. ¿Piloto sigue con **auto-resolve Art. 14** hasta tener selector, o se bloquea clasificación sin elección explícita?

---

## 6. Criterios de “cerrado” para la herramienta del médico (propuesta)

- [x] Auditor abre certificado desde la bandeja sin Console. *(P0 — validar en piloto con checklist §6.1)*
- [x] Ve tipo de ingreso, contacto y comentario del agente (lectura). *(P1)*
- [x] Clasificación favorable con artículo y fechas visibles y editables según política RRHH. *(P2 + P2b)*
- [x] Preview de tramos/consumo mostrado cuando el artículo es corta anual (P3).
- [x] Selector de artículo imputado por auditor (P2) + fechas editables (P2b).
- [x] Historial LM reciente en ficha sin abrir preview (P4.3b).
- [x] Dictamen desfavorable sin regresiones MDC (smoke rechazo vigente — `sol_01448C1850AA72A73CED4C2C65`).
- [x] Junta reutiliza visor + contexto del tramo derivado (bandeja junta operativa).

### 6.1 Checklist UAT — P0 visor certificado (piloto)

**Evidencia UAT 2026-07-03:** `sol_01KWKTC9BD5BJQ37TMAGADN1XR` — certificado `j.jpg`.

| # | Paso | OK |
|---|------|-----|
| 1 | Ingresar como auditor a `/portal/medico/solicitudes` | [x] |
| 2 | Abrir un aviso **completo** (filtro Completas) con certificado cargado por el agente | [x] |
| 3 | En el detalle, sección **Certificado médico**: carga PDF o imagen sin abrir Firebase Console | [x] |
| 4 | **Abrir en pestaña nueva** funciona si el iframe del navegador falla | [x] |
| 5 | Aviso **provisorio** (incompleta): mensaje “Sin certificado” coherente, sin error de consola | [ ] *(no revalidado en esta sesión)* |

**Hosting piloto:** https://portal-hospital-v2.web.app · **Functions:** `listarSolicitudesBandejaAuditorMedica` con `certificado_adjuntos[]`.

---

## 6.2 Contrato P3 — preview tramos / consumo (diseño)

**Callable:** `previsualizarClasificacionMedicaAuditor` (solo lectura, sin persistir).

**Entrada:**

| Campo | Obligatorio | Notas |
|-------|-------------|--------|
| `solicitud_id` | Sí | `sol_*` en `cfg_esa_pendiente_clasificacion_medica` |
| `fecha_desde` / `fecha_hasta` | No | Default: rango efectivo del aviso (`resolverRangoYmdEfectivoAvisoMedico`) |
| `articulo_id` / `version_id_aplicada` | No | Default: auto-resolve Art. 14 corta (misma regla que clasificación favorable Caja Negra) |

**Salida (`ok: true`):**

| Campo | Descripción |
|-------|-------------|
| `modo_preview` | `corta_anual` \| `larga_episodio` |
| `dias_solicitados` | Corridos inclusive |
| `requiere_junta_medica` | `dias > 15` |
| `articulo_id`, `version_id_aplicada` | Versión usada para el cálculo |
| `preview` | Objeto devuelto por `buildLicenciaMedicaPreviewParaPatronB` (tramos 100/60/0 o episodio larga) |
| `mensaje_ui` | Texto listo para UI (`preview.mensaje_ui`) |
| `solo_informativo` | Siempre `true` — no implica aprobación |

**Motor reutilizado:** `sumarConsumoCortaAnualAprobado` + `buildLicenciaMedicaPreviewCorta` (Art. 14); larga vía `buildLicenciaMedicaPreviewLarga` si artículo 16 + causal/CIE-10 en `sol_*`.

### 6.3 Imputación de artículo por el auditor (P2)

En **Caja Negra** el `sol_*` nace sin `articulo_id`. El auditor **elige** la norma al clasificar:

| Componente | Rol |
|------------|-----|
| `listarArticulosLicenciaMedicaAuditor` | Catálogo `cfg_articulos` con `es_licencia_medica` y versión vigente (corta / larga). |
| UI `BandejaAuditorArticuloImputacionSelect` | Select antes del dictamen; recalcula preview al cambiar. |
| `clasificarSolicitudMedicaAuditor` | Persiste `articulo_id` + `version_id_aplicada` elegidos; auto-resolve Art. 14 solo si el auditor no envía IDs. |
| `mutarEstadoSolicitudMedicaMdc` | Tras `update` del `sol_*`, lee el artículo **nuevo** y encola MDC (`LM` → chip del artículo al consolidar). |

**Caso `sol_01KWHASRGSX2W154CEGSW57R1Y`:** preview por defecto Art. 14; el auditor puede cambiar a Art. 16 en el select — el preview pasa a episodio larga; dictamen favorable exige CIE-10/causal en el aviso (o Patrón B).

**No requiere** `REVERTIR` por cambio de artículo en pendiente: la grilla previa es proyección `LM` genérica; al clasificar se actualiza metadata y MDC con el `codigo_grilla` del artículo imputado.

### 6.4 Checklist UAT — P2 cambio de artículo (piloto)

**Evidencia UAT 2026-07-03:** `sol_01KWKTC9BD5BJQ37TMAGADN1XR` (32 d, Art. 14, auditor → junta → aprobada).

| # | Verificación | OK |
|---|--------------|-----|
| 1 | Abrir solicitud: selector muestra Art. 14 por defecto; preview `modo_preview=corta_anual` (19 d previos, tramos 16/100+16/60) | [x] |
| 2 | Cambiar select a Art. 16: preview `larga_episodio`; aviso CIE-10 si falta | [x] |
| 3 | Dictamen favorable con Art. 14: Firestore `sol_*` tiene `articulo_id` / `version_id_aplicada` elegidos | [x] |
| 4 | Grilla `vis_*`: chip **14 — ENFERMEDAD DE CORTA DURACION**; GSO multi-sector con banner Oficina PERSONAL | [x] |
| 5 | Libro `asi_*`: aportes normativos alineados al artículo consolidado (smoke post-clasificación) | [ ] *(smoke no re-ejecutado en sesión)* |

**Histórico:** `sol_01KWHASRGSX2W154CEGSW57R1Y` (17 d) — ya consolidada antes del UAT de cierre.

---

## 7. Enlaces técnicos rápidos

| Recurso | Ruta |
|---------|------|
| Ruta auditor | `/portal/medico/solicitudes` |
| Callable clasificar | `clasificarSolicitudMedicaAuditor` |
| Callable listado | `listarSolicitudesBandejaAuditorMedica` |
| Callable preview P3 | `previsualizarClasificacionMedicaAuditor` |
| Callable catálogo LM auditor | `listarArticulosLicenciaMedicaAuditor` |
| Callable catálogo CIE-10 auditor (C2) | `listarCie10BandejaAuditor` |
| Callable catálogo causal Art. 19 (C2) | `listarCausalLargaBandejaAuditor` |
| Storage certificados | `web/src/services/avisosMedicoStorage.js` (patrón de subida agente) |
| Callable historial P4.3b | `obtenerHistorialLmTitularBandejaAuditor` |

---

## Changelog documento

| Fecha | Cambio |
|-------|--------|
| 2026-07-06 | **C2 COMPLETO** — UAT VERDE `sol_01KWWKBEAJQ866ATXZGAB275P1`; tag `v1919-C2-cie10` |
| 2026-07-03 | **C1 en master** — paginación bandeja; tag `v1919-C1-bandeja-optimizada` |
| 2026-07-03 | **Cierre P4 bandeja auditor** — §1.1 estado brechas; P4.3b inline COMPLETO; backlog C1–C4; criterios §6 cerrados |
| 2026-07-03 | **P4.3b historial LM inline** — `HistorialLMCollapse` + callable; UAT flash MOSTO |
| 2026-07-03 | **P4 historial LM preview** — acordeón preview auditor; UAT `sol_01KWKVW4SED7ETGKPDMB61ES8Q` |
| 2026-07-03 | **UAT VERDE** — §6.1/§6.4 con `sol_01KWKTC9BD5BJQ37TMAGADN1XR`; fix selector LM (sin 64-A) |
| 2026-07-02 | **PAUSA** — handoff sesión bandeja auditor; estado UI + matriz P2/P3 hecho |
| 2026-07-02 | P2 imputación artículo §6.3–6.4; P3 preview checklist |
| 2026-07-02 | P0 visor + checklist §6.1; diseño DTO P3 §6.2 |
| 2026-07-02 | Borrador inicial — brechas post-UAT piloto bandeja auditor (P4 + P4.4 motor) |
