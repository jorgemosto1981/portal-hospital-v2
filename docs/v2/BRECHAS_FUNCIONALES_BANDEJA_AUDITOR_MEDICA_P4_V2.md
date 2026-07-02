# Brechas funcionales — bandeja auditoría médica (épica 1919 P4)

**Propósito:** dejar explícito qué **ya opera en piloto** (motor + callables + MDC) frente a lo que **falta en UI** para que el médico auditor pueda dictaminar sin herramientas paralelas (Firebase Console, scripts).

**Audiencia:** RRHH, medicina laboral, equipo de desarrollo.  
**Estado motor:** validado por smokes `scripts/smoke/med-*.mjs` y UAT de circuito Art. 14 / derivación junta.  
**Estado UI auditor:** MVP cola + metadatos + dictamen (no módulo clínico completo).

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

El riesgo actual **no** es integridad de datos ni desborde del motor; es **productividad y sustantividad** del dictamen en pantalla.

---

## 2. Matriz brecha — actual vs objetivo RFC

| Función | P4 actual (UI + listado) | Objetivo RFC / producto |
|---------|--------------------------|-------------------------|
| **Visor clínico** | **P0 entregado** (`VisorPDF`, DTO `certificado_adjuntos`) | PDF certificado + ficha `ingreso_medico` (tipo ingreso, contacto — **P1**) |
| **Adjuntos** | Listado + visor en bandeja (Storage `getDownloadURL`) | Callable de lectura solo si Rules se endurecen |
| **Diagnóstico CIE-10** | Solo si el aviso ya trae `cie10` (Patrón B / larga); Caja Negra pura: vacío | Lectura en bandeja; larga: obligatorio antes de clasificar (backend ya valida) |
| **Clasificación sustantiva** | Dictamen favorable/desfavorable + observación; fechas del ítem de lista | Elegir `articulo_id` / versión, ajustar `fecha_desde`/`fecha_hasta` definitivas, causal Art. 19 si larga |
| **Preview tramos / consumo** | No en UI | `calcularTramosLicenciaMedicaCorta` + consumo anual aprobado **antes** de confirmar (§5.3) |
| **Historial** | No en UI | **Licencias médicas normativas** del agente (aprobadas en el año), no historia clínica EMR |
| **Señales §5.8** | Filtros completas/provisorias | Badge provisoria, countdown plazo, panel incumplimientos RRHH (parcial en roadmap) |
| **Bandeja junta** | Misma familia: metadatos + dictamen | Mismas brechas de certificado y contexto de consumo |

**Implementación UI relevante hoy:** `web/src/pages/BandejaAuditorSolicitudes.jsx`, `BandejaAuditorSolicitudDetalle.jsx`, `bandejaSolicitudExpandDatos.js`.  
**Listado backend:** `solicitudBandejaAuditorMedicaCore.js` (no devuelve adjuntos ni `ingreso_medico` completo al cliente).

---

## 3. Mitigación operativa hasta completar UI

| Herramienta | Uso |
|-------------|-----|
| **`scripts/inspect-solicitud.mjs`** | Back-office: leer `sol_*`, rutas de adjuntos, estados, fechas estimadas |
| **Firebase Console** | Storage (`avisos-med/…`) + documento `solicitudes_articulo` |
| **Smokes** | Reproducir clasificación/junta sin depender de la bandeja |

Recomendación de gobernanza: tratar `inspect-solicitud.mjs` como **interfaz de soporte oficial** en piloto hasta oleada UI Fase 4.

---

## 4. Priorización sugerida (próxima oleada UI — “Fase 4 bandeja”)

Orden alineado al RFC y al bloqueo real del auditor:

| Prioridad | Ítem | Justificación |
|-----------|------|----------------|
| **P0** | Visor de certificado (adjuntos Storage) | **Hecho** — rama `feat/1919-p4-visor-auditor` @ `a3f00b5` |
| **P1** | Callable o ampliación de listado: **detalle aviso** (`ingreso_medico`, adjuntos metadata, tipo ingreso) | Sustituir ida a Console |
| **P2** | Selector artículo + versión (Art. 14 / 16) y edición de fechas en clasificación | **En curso** — selector + `articulo_id` en clasificar/preview; fechas editables pendiente |
| **P3** | Preview consumo anual + tramos 35/70 antes de confirmar | Reduce error normativo; motor ya existe |
| **P4** | Panel historial LM aprobadas del titular (año calendario) | Contexto normativo, no clínico |
| **P5** | Señales §5.8 ampliadas (countdown incompleta, RRHH) | Operación mesa |

**Fuera de alcance explícito (salvo nueva definición RRHH):** historia clínica ambulatoria, interoperabilidad HC, OCR de certificados.

---

## 5. Decisiones para comité RRHH (priorización)

Antes de estimar la oleada, conviene cerrar:

1. ¿El **visor PDF** basta en V1 o se exige descarga/archivo en expediente?
2. ¿El auditor **debe** poder cambiar fechas respecto al reposo estimado del agente, o solo confirmar?
3. ¿**Historial** = solo días Art. 14 consumidos + listado de `sol_*` aprobadas, o incluye otro reporte institucional?
4. ¿Junta y auditor comparten el **mismo panel de detalle** o dos layouts?
5. ¿Piloto sigue con **auto-resolve Art. 14** hasta tener selector, o se bloquea clasificación sin elección explícita?

---

## 6. Criterios de “cerrado” para la herramienta del médico (propuesta)

- [x] Auditor abre certificado desde la bandeja sin Console. *(P0 — validar en piloto con checklist §6.1)*
- [ ] Ve tipo de ingreso, contacto y comentario del agente (lectura).
- [ ] Clasificación favorable con artículo y fechas visibles y editables según política RRHH.
- [x] Preview de tramos/consumo mostrado cuando el artículo es corta anual (P3).
- [x] Selector de artículo imputado por auditor (P2 — fechas editables pendiente).
- [ ] Dictamen desfavorable sin regresiones MDC (smoke rechazo vigente).
- [ ] Junta reutiliza visor + contexto del tramo derivado.

### 6.1 Checklist UAT — P0 visor certificado (piloto)

Validación rápida para medicina laboral / RRHH (sin acta formal):

| # | Paso | OK |
|---|------|-----|
| 1 | Ingresar como auditor a `/portal/medico/solicitudes` | [ ] |
| 2 | Abrir un aviso **completo** (filtro Completas) con certificado cargado por el agente | [ ] |
| 3 | En el detalle, sección **Certificado médico**: carga PDF o imagen sin abrir Firebase Console | [ ] |
| 4 | **Abrir en pestaña nueva** funciona si el iframe del navegador falla | [ ] |
| 5 | Aviso **provisorio** (incompleta): mensaje “Sin certificado” coherente, sin error de consola | [ ] |

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

Referencia: `sol_01KWHASRGSX2W154CEGSW57R1Y` (17 días, sin `articulo_id` en alta).

| # | Verificación | OK |
|---|--------------|-----|
| 1 | Abrir solicitud: selector muestra Art. 14 por defecto; preview `modo_preview=corta_anual` | [ ] |
| 2 | Cambiar select a Art. 16 (u otra larga): preview pasa a `larga_episodio`; aviso CIE-10 si falta | [ ] |
| 3 | Dictamen favorable con Art. 14: Firestore `sol_*` tiene `articulo_id` / `version_id_aplicada` elegidos | [ ] |
| 4 | Grilla `vis_*`: chip del agente refleja `codigo_grilla` del artículo imputado (no solo `LM`) | [ ] |
| 5 | Libro `asi_*`: aportes normativos alineados al artículo consolidado (smoke post-clasificación) | [ ] |

---

## 7. Enlaces técnicos rápidos

| Recurso | Ruta |
|---------|------|
| Ruta auditor | `/portal/medico/solicitudes` |
| Callable clasificar | `clasificarSolicitudMedicaAuditor` |
| Callable listado | `listarSolicitudesBandejaAuditorMedica` |
| Callable preview P3 | `previsualizarClasificacionMedicaAuditor` |
| Callable catálogo LM auditor | `listarArticulosLicenciaMedicaAuditor` |
| Storage certificados | `web/src/services/avisosMedicoStorage.js` (patrón de subida agente) |
| RFC ítem 4 pendiente | `RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md` §9 |

---

## Changelog documento

| Fecha | Cambio |
|-------|--------|
| 2026-07-02 | P2 imputación artículo §6.3–6.4; P3 preview checklist |
| 2026-07-02 | P0 visor + checklist §6.1; diseño DTO P3 §6.2 |
| 2026-07-02 | Borrador inicial — brechas post-UAT piloto bandeja auditor (P4 + P4.4 motor) |
