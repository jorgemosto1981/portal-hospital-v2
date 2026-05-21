# Handoff sesión 2026-05-21 — Bloque A create Patrón B, deploy y continuidad

**Rama:** `feature/ticketera-puente-campos-config`  
**Firebase:** `portal-hospital-v2` · `southamerica-east1`  
**Estado:** Bloque A **cerrado en prod** · MDC + bandejas MVP **operativos**

> **Entrada evidencia:** [`TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md`](./TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md)  
> **Siguiente trabajo recomendado:** § 4 de este documento.

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

## 2. Estado runtime (AS-IS en prod)

| Capa | Estado |
|------|--------|
| Ticketera + preview + alta Patrón B | OK (regresión 21-may) |
| MDC emisor (`PROYECTAR_PENDIENTE`, `AUTORIZAR_JEFE`, `CONSOLIDAR_APROBADO`) | OK |
| Bandeja jefe → `en_revision_rrhh` | MVP (no cierra trámite) |
| Bandeja RRHH → `cfg_esa_aprobada` | MVP (“aprobar definitivo”) — **no** TO-BE |
| Superposición `cfg_ps_bloqueante` | OK (Oleada B 20-may) |
| Gate grilla `depende_rda` | **Hecho** en `runPatronBAltaMotor` — evidencia [`TICKETERA_EVIDENCIA_2026-05-21_GRILLA_RDA_REJECT.md`](./TICKETERA_EVIDENCIA_2026-05-21_GRILLA_RDA_REJECT.md) |

---

## 3. Documentación actualizada (índice)

| Archivo | Cambio |
|---------|--------|
| [`TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md`](./TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md) | Evidencia incidente + pilotos + checklist |
| [`RFC_TICKETERA_SLICE_64A_MVP_V2.md`](./RFC_TICKETERA_SLICE_64A_MVP_V2.md) §7.1 | `version_id_aplicada`, `grupo_trabajo_id_ancla`, Rules Bloque A |
| [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) | Fila F1-create / revisión 21-may |
| [`README.md`](./README.md) | Enlace evidencia 21-may |
| [`HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md`](./HANDOFF_TICKETERA_PAUSA_2026-05-19_FASE2-4.md) | Puntero a esta sesión |
| [`web/SCHEMA.md`](../web/SCHEMA.md) | Referencia schema create Patrón B |

---

## 4. Por dónde continuar (prioridad sugerida)

### A — Producto + código: **Oleada A autorización** (recomendado)

**Por qué primero:** el piloto `sol_01KS50G2…` demostró de nuevo el problema de **dos aprobaciones** (jefe + RRHH). El contrato TO-BE ya está redactado; falta implementación.

| Fuente | Contenido |
|--------|-----------|
| [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md) | Jefe cierra → `cfg_esa_aprobada`; RRHH **toma de conocimiento** |
| [`PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md`](./PLAN_IMPLEMENTACION_RFC_AUTORIZACION_TICKETERA_V2.md) | Oleadas A / B / C |

**Primeros pasos Oleada A (resumen):**

1. `resolverDecisionJefeSolicitud` → estado final **`cfg_esa_aprobada`** (no `en_revision_rrhh` en flujo nuevo).
2. Bandeja RRHH: acción **“Registrar toma de conocimiento”** (sin segunda aprobación sustantiva).
3. MDC: `CONSOLIDAR_APROBADO` al cierre jefe; RRHH dispara evento/registro distinto.
4. Quitar bypass RRHH en bandeja jefe (según plan).
5. Campos `sol_*` TO-BE: `autorizadores_elegibles_ids`, `grupo_autorizacion_id`, etc. (plan § A).

**Prueba de aceptación:** misma persona 27667499 / 28914247 — un solo “aprobar” sustantivo + RRHH solo TC + `asi`/`vis` coherentes.

---

### B — Integridad motor: **grilla RDA en trigger** ✅ (2026-05-21)

`validarGrillaHorariaParaSolicitud` integrado en `runPatronBAltaMotor` (`solicitudPatronBAltaMotor.js`) cuando `depende_rda === true`, antes del OK de saldo. El trigger `onSolicitudArticuloPatronBOnCreate` rechaza con `GRILLA_NO_AUTORIZADA` sin descontar. Preview usa el mismo motor (sin segunda pasada duplicada).

**Deploy pendiente en prod:** `onSolicitudArticuloPatronBOnCreate`, `previsualizarSolicitudPatronB`.

---

### C — Deuda menor create / validaciones

| Ítem | Notas |
|------|--------|
| `dias_minimos_por_evento` | No validado explícitamente en motor |
| `genero_ids` en versión | No evaluado en elegibilidad |
| `eventos_ticket` toma de conocimiento RRHH | Oleada A / plan eventos RRHH |
| Migración lectura `version_aplicada` → solo `version_id_aplicada` en UI de detalle | Opcional; motor ya acepta ambos |

---

### D — Ticketera producto (después de A)

| Ítem | Doc |
|------|-----|
| Shell LAO unificado | F3a parcial en [`PLAN_TICKETERA_V2.md`](./PLAN_TICKETERA_V2.md) |
| Licencias médicas + bandeja médico | F5 pendiente |
| Delegación jefe → subordinado | [`CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md`](./CUESTIONES_TICKET_SOLICITUD_POR_DELEGACION_JEFE_V2.md) |
| Matriz R3 rechazo RRHH | [`TICKETERA_SLICE_64A_MATRIZ_PRUEBAS_FASE4_RRHH.md`](./TICKETERA_SLICE_64A_MATRIZ_PRUEBAS_FASE4_RRHH.md) (sigue válida en MVP hasta Oleada A) |

---

### E — Operación repo

- **Commit** en rama: Bloque A + docs 21-may (si aún no commiteado en la PC que editó).
- **Push** para alinear otra máquina.
- No mezclar con refactor configurador artículos salvo PR aparte.

---

## 5. Decisión rápida para la próxima sesión

```text
¿Cerramos el modelo de autorizaciones (Oleada A)?
  → Sí: abrir PLAN_IMPLEMENTACION oleada A, tarea 1 = callable jefe + estados.
  → No, solo hardening: ítem B (grilla en trigger) + matriz superposición.
```

**Recomendación del equipo técnico (doc):** **A** primero; B en paralelo si hay dos personas; C y D encadenados tras A.

---

*Fin handoff 2026-05-21.*
