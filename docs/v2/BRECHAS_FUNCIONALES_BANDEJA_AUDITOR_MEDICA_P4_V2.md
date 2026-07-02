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
| **Visor clínico** | No: solo filas expand (`BandejaSolicitudExpandDatos`, variant `auditor`) | PDF certificado + ficha `ingreso_medico` (tipo ingreso, contacto, DDJJ, comentario agente) |
| **Adjuntos** | Existen en Firestore (`ingreso_medico.adjuntos[].storage_path`); **no** se listan ni abren en bandeja | Visor con URL firmada o callable de lectura; auditoría de descarga |
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
| **P0** | Visor de certificado (adjuntos Storage) | Insumo mínimo para cualquier dictamen |
| **P1** | Callable o ampliación de listado: **detalle aviso** (`ingreso_medico`, adjuntos metadata, tipo ingreso) | Sustituir ida a Console |
| **P2** | Selector artículo + versión (Art. 14 / 16) y edición de fechas en clasificación | §5.3; hoy parche backend auto-resolve Art. 14 en favorable |
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

- [ ] Auditor abre certificado desde la bandeja sin Console.
- [ ] Ve tipo de ingreso, contacto y comentario del agente (lectura).
- [ ] Clasificación favorable con artículo y fechas visibles y editables según política RRHH.
- [ ] Preview de tramos/consumo mostrado cuando el artículo es corta anual.
- [ ] Dictamen desfavorable sin regresiones MDC (smoke rechazo vigente).
- [ ] Junta reutiliza visor + contexto del tramo derivado.

---

## 7. Enlaces técnicos rápidos

| Recurso | Ruta |
|---------|------|
| Ruta auditor | `/portal/medico/solicitudes` |
| Callable clasificar | `clasificarSolicitudMedicaAuditor` |
| Callable listado | `listarSolicitudesBandejaAuditorMedica` |
| Storage certificados | `web/src/services/avisosMedicoStorage.js` (patrón de subida agente) |
| RFC ítem 4 pendiente | `RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md` §9 |

---

## Changelog documento

| Fecha | Cambio |
|-------|--------|
| 2026-07-02 | Borrador inicial — brechas post-UAT piloto bandeja auditor (P4 + P4.4 motor) |
