# Handoff sesión 2026-05-21 — Bloque A create Patrón B, deploy y continuidad

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · `southamerica-east1`  
**Estado:** **Oleada A = CERRADA** (prod, documentada, evidencia E2E) · Bloque A create Patrón B **cerrado**

> **Evidencia Oleada A (referencia):** [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md) · `sol_01KS57Y01GDWCZFAS2EFF4JKP7`  
> **Create Patrón B:** [`TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md`](./TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md)  
> **Siguiente sprint:** § 4 — bifurcación **Oleada B (MDC/fan-out)** vs **Hardening UI RRHH** (paralelizable).

---

## 1. Qué se hizo en la sesión

| Tema | Entregable |
|------|------------|
| Diagnóstico create | Fuga `grupo_trabajo_id_ancla` vs Rules `hasOnly`; nomenclatura `version_aplicada` vs `version_id_aplicada` |
| **Bloque A (código)** | `web/src/schemas/solicitudArticuloCreate.schema.js`, `solicitudesArticuloV2Service.js`, `useSolicitud64AAlta.js`, `firebase-v2/firestore.rules` |
| **Bloque A (motor)** | `solicitudPatronBAltaMotor.js` lee `version_id_aplicada` (+ alias legacy) |
| Evidencia piloto | `sol_01KS4ZG2…` (jun-21), `sol_01KS50G2…` (jul-21) cadena completa MVP |
| Deploy | `firestore:rules`, `hosting`, `onSolicitudArticuloPatronBOnCreate` (21-may); deploy completo previo en la misma línea de trabajo |

### Contrato create Patrón B (canónico desde 21-may)

| Campo | Obligatorio en create |
|-------|------------------------|
| `articulo_id`, `titular_persona_id`, `actor_alta_persona_id` | sí |
| **`version_id_aplicada`** | sí (`ver_*`) |
| **`grupo_trabajo_id_ancla`** | sí (`gdt_*`) — UI select si N>1 HLg; autoselección si N=1 |
| `fecha_desde`, `fecha_hasta` (= desde en MVP 1 día), `anio_ciclo_consumo`, `dias_solicitados` | sí |
| `patron_saldo` = `B`, `estado_solicitud_id` = borrador, `schema_version` = 2 | sí |

Docs legacy en Firestore pueden seguir con `version_aplicada` en raíz; **documentos nuevos** deben usar `version_id_aplicada`.

---

## 2. Estado runtime (prod tras Oleada A — 21-may)

| Capa | Estado |
|------|--------|
| Ticketera + preview + alta Patrón B | OK · snapshot A2 en alta |
| Autorización jefe (flujo nuevo) | **TO-BE:** aprueba → `cfg_esa_aprobada` + `CONSOLIDAR_APROBADO` |
| RRHH (flujo nuevo) | **TO-BE:** solo **toma de conocimiento** en `aprobada` (sin `rrhh_revision_*` en caso limpio) |
| Eventos `eventos_ticket` | Dual-write: `jefe_aprobar` + `rrhh_toma_conocimiento` (evidencia `evt_*` en doc dedicado) |
| MDC emisor | OK en bandejas; **worker / fan-out** = Oleada B (pendiente) |
| Superposición `cfg_ps_bloqueante` | OK |
| Gate grilla `depende_rda` | OK en motor — [`TICKETERA_EVIDENCIA_2026-05-21_GRILLA_RDA_REJECT.md`](./TICKETERA_EVIDENCIA_2026-05-21_GRILLA_RDA_REJECT.md) |

**Legacy en Firestore:** solicitudes con `cfg_esa_en_revision_rrhh` o `rrhh_revision_*` siguen existiendo; no son plantilla del flujo nuevo. Ver contraste `sol_01KS0896…` en evidencia Oleada A §2.

---

## 3. Documentación actualizada (índice)

| Archivo | Cambio |
|---------|--------|
| [`TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md`](./TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md) | Evidencia incidente + pilotos + checklist |
| [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_A_AUTORIZACION_TC.md) | E2E Oleada A limpio `sol_01KS57Y…` (jefe + TC, eventos) |
| [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §7.1 | `version_id_aplicada`, `grupo_trabajo_id_ancla`, Rules Bloque A |
| [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) | Fila F1-create / revisión 21-may |
| [`README.md`](./README.md) | Enlace evidencia 21-may |
| [`HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md`](./HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md) | Puntero a esta sesión |
| [`web/SCHEMA.md`](../web/SCHEMA.md) | Referencia schema create Patrón B |

---

## 4. Oleada A — cerrada ✅

Implementación y validación en prod completas. Contrato: [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) · plan: [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md) oleada A.

| Entregable Oleada A | Estado |
|---------------------|--------|
| Jefe cierra → `cfg_esa_aprobada` + MDC `CONSOLIDAR_APROBADO` | ✅ |
| Snapshot alta (`autorizadores_elegibles_ids`, ancla, versión) | ✅ |
| RRHH TC (`rrhh_toma_conocimiento_*`, callable A4) | ✅ |
| Eventos `jefe_aprobar` / `rrhh_toma_conocimiento` (A6 dual-write) | ✅ |
| Evidencia E2E sin doble aprobación RRHH | ✅ `sol_01KS57Y…` |

**Deuda Oleada A (no bloqueante — no reabrir la oleada):**

| Ítem | Notas |
|------|--------|
| Copy toast alta | «en revisión por jefe» correcto al crear; confunde si se lee tras cierre — `TicketeraPatronB.jsx` |
| Proyección `estado_bandeja_rrhh_id` en eventos `articulos` | Default `cfg_ebr_pend_rev` en capa global; no implica pendiente de licencia |
| TC superiores (burbujeo) | RFC §2 ítem 9 · `niveles_burbujeo` — módulo posterior |
| Filas legacy / híbridas en BD | Operación histórica; UI puede seguir mostrando modos `legacy_rrhh` |

---

## 5. Siguiente sprint — bifurcación de trabajo

Dos frentes **independientes** (misma rama posible, distinto tipo de esfuerzo):

### 5.1 Oleada B — MDC / fan-out (núcleo duro)

**Objetivo:** consistencia asistencial a escala — proyección `asi_*` → `vis_*`, worker MDC, idempotencia y concurrencia.

| Fuente | Contenido |
|--------|-----------|
| [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md) | Oleada B |
| [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) | §7 MDC, §10 oleada B |

**Foco mental:** workers, reintentos, gates grilla ya validados en alta — **no** mezclar con tweaks de copy.

**Prerrequisito:** Oleada A cerrada (este handoff).

---

### 5.2 Hardening UI RRHH (aseguramiento operativo)

**Objetivo:** que el operador **no** vea acciones sustantivas obsoletas cuando el backend ya está en TO-BE.

| Tarea | Código / notas |
|-------|----------------|
| Solo **Registrar toma de conocimiento** en `cfg_esa_aprobada` sin TC | `bandejaRrhhModoItem` en `solicitudBandejaRrhhCore.js` + `BandejaRrhhSolicitudes.jsx` |
| Aprobar/Rechazar RRHH solo en `legacy_rrhh` o `cierre_sustituta` | Ya modelado en backend; verificar deploy hosting y filtros lista |
| Mensajes alineados a modos (`toma_conocimiento`, `legacy_rrhh`) | Copy UI |

**Foco mental:** bajo riesgo si backend no se toca — **paz mental** del operador.

**Paralelizable** con 5.1 si hay dos personas; si una sola, recomendación doc: **5.2 rápido primero** (1 sesión) y luego **5.1**.

---

### 5.3 Otros (encadenados, no bloquean A)

| Ítem | Doc / notas |
|------|-------------|
| Grilla RDA deploy functions | Verificar `onSolicitudArticuloPatronBOnCreate` en prod si hubo cambio pendiente |
| Deuda create § C (días mínimos, género) | Menor |
| Ticketera F3a / F5 / delegación | [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) |

---

## 6. Histórico — grilla RDA en trigger ✅ (2026-05-21)

`validarGrillaHorariaParaSolicitud` integrado en `runPatronBAltaMotor` (`solicitudPatronBAltaMotor.js`) cuando `depende_rda === true`, antes del OK de saldo. El trigger `onSolicitudArticuloPatronBOnCreate` rechaza con `GRILLA_NO_AUTORIZADA` sin descontar. Preview usa el mismo motor (sin segunda pasada duplicada).

**Deploy pendiente (verificar en prod):** `onSolicitudArticuloPatronBOnCreate`, `previsualizarSolicitudPatronB` si hubo release posterior al 21-may.

---

## 7. Decisión rápida (próxima sesión)

```text
Oleada A → CERRADA. No reabrir salvo bug de regresión con evidencia nueva.

¿Qué abro?
  → Oleada B (MDC worker / fan-out): PLAN § oleada B — foco profundo backend.
  → Hardening UI RRHH: BandejaRrhh — ocultar “aprobar definitivo” salvo legacy/sustituta.
  → Ambos en paralelo si hay dos personas; si uno solo: hardening UI primero (corto), luego B.
```

**Repo:** evidencia Oleada A en `3c48899` (docs) — rama `feature/ticketera-puente-campos-config` alineada con `origin`.

---

*Handoff cerrado 2026-05-21 — Oleada A terminada. Retomar desde § 5.*
