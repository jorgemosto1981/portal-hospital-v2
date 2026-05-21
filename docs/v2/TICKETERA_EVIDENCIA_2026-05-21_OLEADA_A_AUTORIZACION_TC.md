# Evidencia — Oleada A autorización + toma de conocimiento RRHH (21-may-2026)

**Proyecto:** `portal-hospital-v2` · **Rama:** `feature/ticketera-puente-campos-config`  
**Contrato:** [`RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md`](./RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md)  
**Campos:** [`SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md`](./SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md)

---

## 1. Caso de referencia TO-BE (flujo limpio)

**Solicitud:** `sol_01KS57Y01GDWCZFAS2EFF4JKP7`  
**Artículo / grilla:** `art_01KRNK10V10CH7W5M2W6V558GS` · **64-A**  
**Titular (legajo piloto):** `per_01KR3HD24AMJ6YX3N7B3GPAZJ4` (27667499)  
**Autorizador + TC RRHH:** `per_01KQN9WXFXF69Z9DCT5YNJ3TFZ` (28914247)  
**Fecha licencia:** `2026-03-21` (1 día · Patrón B)

### 1.1 Línea de tiempo (Firestore)

| Instante (UTC-3) | Acción | `estado_solicitud_id` | Otros campos / MDC |
|------------------|--------|------------------------|-------------------|
| 9:24:53 | Alta + trigger motor OK | `cfg_esa_en_revision_jefe` | Snapshot A2: `grupo_trabajo_id_ancla`, `version_id_aplicada`, `autorizadores_elegibles_ids`, `grupo_autorizacion_id`, `autorizacion_rrhh_sustituta: false` |
| 9:25:11 | Motor saldo | (sin cambio estado) | `motor_descuento_aplicado`, `_debito_origen` 1 día bolsa 2026 |
| 9:25:50 | Jefe **aprueba** (cierre sustantivo) | **`cfg_esa_aprobada`** | `jefe_revision_*`, `mdc_ultimo_comando: CONSOLIDAR_APROBADO`, `mdc_ultimo_resultado_ok: true` |
| 9:26:01 | RRHH **toma de conocimiento** | `cfg_esa_aprobada` (sin cambio) | `rrhh_toma_conocimiento_*` · **sin** `rrhh_revision_en` / `rrhh_revision_persona_id` |

Criterio TO-BE cumplido: **un solo acto sustantivo** (jefe) + **acuse RRHH** (no segunda aprobación en bandeja RRHH).

### 1.2 Eventos (`eventos_ticket` global + subcolección `solicitudes_articulo/{solId}/eventos_ticket`)

| `evt_*` | `accion` | `tipo_evento_id` (catálogo) | Resumen |
|---------|----------|-----------------------------|---------|
| *(alta — buscar en subcol si se audita)* | `patron_b_on_create_ok` / creación revisión jefe | `cfg_tev_art_…FAV` | Envío a jefatura |
| `evt_01KS57ZKCX6778J70A6TQ08HJA` | **`jefe_aprobar`** | `cfg_tev_art_01ARZ3NDEKTSV4RRFFQ69G5FB0` (`ART_SOLICITUD_ESTADO_CAMBIADO`) | `en_revision_jefe` → `aprobada` · `codigo_grilla: 64-A` · `decision: aprobar` |
| `evt_01KS57ZYHK00E8M5XYMY997QG6` | **`rrhh_toma_conocimiento`** | `cfg_tev_art_01ARZ3NDEKTSV4RRFFQ69G5FB8` (`ART_TOMA_CONOCIMIENTO_REGISTRADA`) | Mismo estado antes/después `cfg_esa_aprobada` |

**UI agente al alta:** toast «Solicitud aceptada … Estado: en revisión por jefe» (`TicketeraPatronB.jsx`) — correcto **en el momento del alta**; el estado final del doc es `cfg_esa_aprobada` tras jefe + TC.

---

## 2. Caso híbrido (no usar como plantilla TO-BE)

**Solicitud:** `sol_01KS0896610NA49M9G6VABMMEK`  
**Fecha licencia:** `2026-05-19`

| Instante | Qué pasó |
|----------|----------|
| 19-may | Jefe aprueba + **RRHH cierre legacy** (`rrhh_revision_en` / `rrhh_revision_persona_id`) — doble circuito MVP |
| 21-may 8:57 | TC formal (`rrhh_toma_conocimiento_en`) + evento `evt_01KS56C72XN0V03JZRNHR9Z6ED` |

Útil para validar que TC RRHH **no cambia estado** en solicitudes ya `aprobada`; **no** demuestra flujo nuevo sin `rrhh_revision_*`.

---

## 3. Otro piloto (pre-evidencia eventos detallados)

`sol_01KS52ZRQHF0MQBDM58XP9Y27Z` — misma semántica TO-BE documentada en [`SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md`](./SOLICITUD_ARTICULO_AUTORIZACION_CAMPOS_V2.md) § piloto (vis día 21/04/2026).

---

## 4. Prueba de aceptación (checklist)

- [x] Alta con `version_id_aplicada` y `grupo_trabajo_id_ancla`
- [x] Snapshot `autorizadores_elegibles_ids` / `grupo_autorizacion_id`
- [x] Jefe → `cfg_esa_aprobada` + MDC `CONSOLIDAR_APROBADO`
- [x] Sin `cfg_esa_en_revision_rrhh` en flujo normal
- [x] Sin `rrhh_revision_*` en caso limpio `sol_01KS57Y…`
- [x] Evento `jefe_aprobar` con cambio de estado en `payload.cambios`
- [x] Evento `rrhh_toma_conocimiento` con `tipo_evento_id` TC
- [ ] TC superiores (burbujeo por artículo) — **pendiente** RFC §2 ítem 9

---

*Registrado 2026-05-21 tras validación en consola Firestore (prod V2).*
