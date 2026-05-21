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

### 5.1bis Oleada B — validación prod ✅ (misma `sol_01KS57Y…`)

Evidencia MDC/RDA sin regresión con Oleada A: [`TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md`](./TICKETERA_EVIDENCIA_2026-05-21_OLEADA_B_MDC_SOL_01KS57Y.md). Worker/fan-out **no requiere cambio** para el flujo limpio; siguiente foco backend = B3 cola (opcional) u Oleada C.

### 5.2 Hardening UI RRHH (aseguramiento operativo) — ✅ (21-may)

Deploy hosting: copy bandeja RRHH + toast alta Patrón B (`b928606`). Smoke pendiente en https://portal-hospital-v2.web.app .

---

### 5.3 Otros (encadenados, no bloquean A)

| Ítem | Doc / notas |
|------|-------------|
| Grilla RDA deploy functions | Verificar `onSolicitudArticuloPatronBOnCreate` en prod si hubo cambio pendiente |
| Deuda create § C (días mínimos, género) | Menor |
| Ticketera F3a / F5 / delegación | [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) |

### 5.4 Deuda eventos × bandeja RRHH — **próxima sesión (prioridad)**

**Problema:** `persistEventoV21` proyecta **todos** los eventos a `eventos_bandeja_rrhh` con default `cfg_ebr_pend_rev` si el contexto no trae `estado_bandeja_rrhh_id`. Los de `modulo_origen: articulos` (p. ej. `rrhh_toma_conocimiento`, `jefe_aprobar`) **no** son toma de conocimiento de ficha personal, pero ensucian el read model y el doc canónico en consola.

**UI hoy:** `/portal/rrhh/notificaciones-datos-personales` filtra cliente con `isEventoDatosPersonales` (`cfg_tev_datos_*`, auth, ddjj) — **no** lista `cfg_tev_art_*`. El riesgo es auditoría/consultas RRHH sin filtro y datos “fantasma” en colección bandeja.

**Fix (implementado en código):**

1. ✅ `eventosV2.js` · `debeProyectarBandejaRrhh` + `persistEventoV21`: **no escribe** `eventos_bandeja_rrhh` si `modulo_origen === "articulos"`.
2. Test: `node --test functions/test/eventosV2.bandejaRrhh.test.js`
3. Pendiente prod: `npm run firebase:deploy:functions` (callables que usan `registrarEventoTicket` / `persistEventoV21`).
4. Opcional: script one-off para borrar proyecciones bandeja **históricas** con `modulo_origen: articulos`.

**Prueba post-deploy:** nuevo TC o `jefe_aprobar` → doc en `eventos_ticket` raíz + subcol; **no** crear doc en `eventos_bandeja_rrhh` con el mismo `evt_id`.

---

## 6. Histórico — grilla RDA en trigger ✅ (2026-05-21)

`validarGrillaHorariaParaSolicitud` integrado en `runPatronBAltaMotor` (`solicitudPatronBAltaMotor.js`) cuando `depende_rda === true`, antes del OK de saldo. El trigger `onSolicitudArticuloPatronBOnCreate` rechaza con `GRILLA_NO_AUTORIZADA` sin descontar. Preview usa el mismo motor (sin segunda pasada duplicada).

**Deploy pendiente (verificar en prod):** `onSolicitudArticuloPatronBOnCreate`, `previsualizarSolicitudPatronB` si hubo release posterior al 21-may.

---

## 7. Plan acordado — próxima sesión

Orden recomendado (**casa limpia** antes de Oleada C):

| Paso | Acción | Done |
|------|--------|------|
| 1 | **Smoke prod:** hosting + bandeja solicitudes RRHH + toast alta 64-A | ☐ |
| 2 | **Repo:** `git checkout -- functions/modules/shared/solicitudElegibilidadLaboral.js` (solo CRLF) | ✅ |
| 3 | **Deuda §5.4:** eventos `articulos` sin proyección bandeja RRHH + deploy functions | ✅ (21-may prod) |
| 4 | **Oleada C:** asistencia / GSO / grilla operativa (épica) | ☐ |

```text
Oleada A + B (MDC validado) → CERRADAS en prod.
No reabrir salvo regresión documentada.

Siguiente: smoke → deuda eventos (5.4) → Oleada C sobre base sólida.
```

**Repo:** rama `feature/ticketera-puente-campos-config` · hosting `b928606` desplegado.

---

*Handoff 2026-05-21 — Oleada A/B cerradas. Retomar § 7 paso 1.*
